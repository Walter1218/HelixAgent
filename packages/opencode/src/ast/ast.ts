import { Effect, Context, Layer, Ref } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"

export interface BlastRadius {
  file: string
  dependents: string[]
  depth: number
}

export interface Contract {
  file: string
  classes: ClassInfo[]
  functions: FunctionInfo[]
  exports: string[]
}

export interface ClassInfo {
  name: string
  methods: string[]
  properties: string[]
}

export interface FunctionInfo {
  name: string
  params: string[]
  returnType: string
}

export function calculateBlastRadius(file: string, dependencies: Map<string, string[]>): BlastRadius {
  const visited = new Set<string>()
  const dependents: string[] = []

  function dfs(currentFile: string, depth: number) {
    if (visited.has(currentFile)) return
    visited.add(currentFile)

    const deps = dependencies.get(currentFile) || []
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dependents.push(dep)
        dfs(dep, depth + 1)
      }
    }
  }

  dfs(file, 0)

  return {
    file,
    dependents,
    depth: Math.max(...dependents.map((_, i) => i + 1), 0),
  }
}

export function extractContract(content: string): Contract {
  const classes: ClassInfo[] = []
  const functions: FunctionInfo[] = []
  const exports: string[] = []

  const classRegex = /class\s+(\w+)/g
  const functionRegex = /(?:export\s+)?(?:function|const)\s+(\w+)/g
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g

  let match

  while ((match = classRegex.exec(content)) !== null) {
    classes.push({
      name: match[1],
      methods: [],
      properties: [],
    })
  }

  while ((match = functionRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      params: [],
      returnType: "unknown",
    })
  }

  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1])
  }

  return { file: "", classes, functions, exports }
}

export function formatBlastRadius(radius: BlastRadius): string {
  const lines = [`Blast Radius for ${radius.file}:`]
  lines.push(`  Dependents: ${radius.dependents.length}`)
  lines.push(`  Depth: ${radius.depth}`)
  if (radius.dependents.length > 0) {
    lines.push(`  Files:`)
    for (const dep of radius.dependents.slice(0, 10)) {
      lines.push(`    - ${dep}`)
    }
    if (radius.dependents.length > 10) {
      lines.push(`    ... and ${radius.dependents.length - 10} more`)
    }
  }
  return lines.join("\n")
}

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"]

function parseImports(content: string, filePath: string): string[] {
  const imports: string[] = []
  const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const exportFromRegex = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g

  const dir = path.dirname(filePath)

  const extractRelative = (specifier: string) => {
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(dir, specifier)
      for (const ext of TS_EXTENSIONS) {
        imports.push(resolved + ext)
        imports.push(path.join(resolved, "index" + ext))
      }
    }
  }

  let match
  while ((match = importRegex.exec(content)) !== null) extractRelative(match[1])
  while ((match = requireRegex.exec(content)) !== null) extractRelative(match[1])
  while ((match = exportFromRegex.exec(content)) !== null) extractRelative(match[1])

  return imports
}

async function scanTsFiles(rootPath: string): Promise<string[]> {
  const files: string[] = []
  const { readdirSync, statSync } = await import("fs")

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (TS_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath)
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  walk(rootPath)
  return files
}

export interface Interface {
  readonly calculateBlastRadius: (file: string, dependencies: Map<string, string[]>) => Effect.Effect<BlastRadius>
  readonly extractContract: (content: string) => Effect.Effect<Contract>
  readonly formatBlastRadius: (radius: BlastRadius) => Effect.Effect<string>
  readonly buildDependencyGraph: (rootPath: string) => Effect.Effect<Map<string, string[]>, Error>
  readonly analyzeChangedFiles: (changedFiles: string[], rootPath: string) => Effect.Effect<BlastRadius[], Error>
  readonly recordChangedFiles: (sessionID: string, files: string[]) => Effect.Effect<void>
  readonly getChangedFiles: (sessionID: string) => Effect.Effect<string[]>
  readonly clearChangedFiles: (sessionID: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AST") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const dependencyCache = yield* Ref.make<Map<string, string[]> | null>(null)
    const changedFilesCache = yield* Ref.make<Map<string, Set<string>>>(new Map())

    const buildDependencyGraph = Effect.fn("AST.buildDependencyGraph")(function* (rootPath: string) {
      const cached = yield* Ref.get(dependencyCache)
      if (cached) return cached

      const files = yield* Effect.tryPromise({
        try: () => scanTsFiles(rootPath),
        catch: (err) => new Error(`Failed to scan TS files: ${err}`),
      })

      const graph = new Map<string, string[]>()

      for (const file of files) {
        const content = yield* fs.readFileStringSafe(file).pipe(
          Effect.catch(() => Effect.succeed(undefined)),
        )
        if (content === undefined) continue

        const imports = parseImports(content, file)
        graph.set(file, imports.filter((imp) => files.some((f) => f === imp || f.startsWith(imp))))
      }

      yield* Ref.set(dependencyCache, graph)
      return graph
    })

    const analyzeChangedFiles = Effect.fn("AST.analyzeChangedFiles")(function* (
      changedFiles: string[],
      rootPath: string,
    ) {
      const graph = yield* buildDependencyGraph(rootPath)
      return changedFiles.map((file) => calculateBlastRadius(file, graph))
    })

    const recordChangedFiles = Effect.fn("AST.recordChangedFiles")(function* (
      sessionID: string,
      files: string[],
    ) {
      const cache = yield* Ref.get(changedFilesCache)
      const existing = cache.get(sessionID)
      if (existing) {
        for (const file of files) existing.add(file)
      } else {
        cache.set(sessionID, new Set(files))
      }
    })

    const getChangedFiles = Effect.fn("AST.getChangedFiles")(function* (sessionID: string) {
      const cache = yield* Ref.get(changedFilesCache)
      const files = cache.get(sessionID)
      return files ? Array.from(files) : []
    })

    const clearChangedFiles = Effect.fn("AST.clearChangedFiles")(function* (sessionID: string) {
      const cache = yield* Ref.get(changedFilesCache)
      cache.delete(sessionID)
    })

    return Service.of({
      calculateBlastRadius: (file, deps) => Effect.succeed(calculateBlastRadius(file, deps)),
      extractContract: (content) => Effect.succeed(extractContract(content)),
      formatBlastRadius: (radius) => Effect.succeed(formatBlastRadius(radius)),
      buildDependencyGraph,
      analyzeChangedFiles,
      recordChangedFiles,
      getChangedFiles,
      clearChangedFiles,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(FSUtil.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [FSUtil.node] })

export * as AST from "./ast"

