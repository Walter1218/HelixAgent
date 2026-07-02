import { Effect, Context, Layer, Option } from "effect"
import path from "path"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

export type SpecStatus = "pending" | "in_progress" | "implemented" | "failed"

export type VerificationType = "grep" | "ast" | "test" | "script" | "manual"

export interface SpecVerification {
  readonly type: VerificationType
  readonly target: string
}

export interface SpecRequirement {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly acceptanceCriteria: string[]
  readonly verification: SpecVerification
  readonly status: SpecStatus
}

export interface SpecDoc {
  readonly title: string
  readonly overview: string
  readonly filePath: string
  readonly requirements: SpecRequirement[]
}

export interface OpenSpecConfig {
  readonly directory: string
}

export interface Interface {
  readonly getConfig: () => Effect.Effect<OpenSpecConfig>
  readonly parseSpecFile: (path: string) => Effect.Effect<SpecDoc, Error>
  readonly parseAllSpecs: (dir?: string) => Effect.Effect<SpecDoc[], Error>
  readonly findSpecForTask: (taskDescription: string, specs: SpecDoc[]) => Effect.Effect<Option.Option<SpecDoc>>
  readonly checkRequirement: (req: SpecRequirement) => Effect.Effect<boolean, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpec") {}

const DEFAULT_OPEN_SPEC_CONFIG: OpenSpecConfig = {
  directory: "openspec/specs",
}

function parseSpecMarkdown(filePath: string, content: string): SpecDoc {
  const lines = content.split("\n")
  let title = ""
  let overview = ""
  let inOverview = false
  let inRequirements = false
  const requirements: SpecRequirement[] = []

  let currentRequirement: {
    id?: string
    title?: string
    description?: string
    verification?: SpecVerification
    status?: SpecStatus
  } | null = null
  let currentAcceptanceCriteria: string[] = []

  const flushRequirement = () => {
    if (currentRequirement?.id && currentRequirement.title) {
      requirements.push({
        id: currentRequirement.id,
        title: currentRequirement.title,
        description: currentRequirement.description ?? "",
        acceptanceCriteria: currentAcceptanceCriteria,
        verification: currentRequirement.verification ?? { type: "manual", target: "" },
        status: currentRequirement.status ?? "pending",
      })
    }
    currentRequirement = null
    currentAcceptanceCriteria = []
  }

  for (const line of lines) {
    const titleMatch = line.match(/^#\s+(.+)$/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      inOverview = true
      continue
    }

    if (line.match(/^##\s+Overview/i)) {
      inOverview = true
      inRequirements = false
      continue
    }

    if (line.match(/^##\s+Requirements/i)) {
      flushRequirement()
      inOverview = false
      inRequirements = true
      continue
    }

    if (inOverview && line.startsWith("## ")) {
      inOverview = false
    }

    if (inOverview && line.trim() && !line.startsWith("#")) {
      overview = overview ? `${overview}\n${line.trim()}` : line.trim()
    }

    const reqMatch = line.match(/^###\s+(Requirement\s+\d+)\s*[:\s]\s*(.*)$/i)
    if (reqMatch && inRequirements) {
      flushRequirement()
      currentRequirement = {
        id: reqMatch[1].trim(),
        title: reqMatch[2].trim(),
        description: "",
      }
      continue
    }

    if (currentRequirement && inRequirements) {
      const statusMatch = line.match(/\*\*Status\*\*\s*:\s*(pending|in_progress|implemented|failed)/i)
      if (statusMatch) {
        currentRequirement.status = statusMatch[1].toLowerCase() as SpecStatus
        continue
      }

      const verificationMatch = line.match(/\*\*Verification\*\*\s*:\s*(\w+)\s+(.+)/i)
      if (verificationMatch) {
        currentRequirement.verification = {
          type: verificationMatch[1].toLowerCase() as VerificationType,
          target: verificationMatch[2].trim(),
        }
        continue
      }

      const criteriaMatch = line.match(/^\s*-\s+(.+)$/)
      if (criteriaMatch) {
        currentAcceptanceCriteria.push(criteriaMatch[1].trim())
        continue
      }

      if (line.trim() && !line.startsWith("#") && !line.includes(":") && !currentRequirement.description) {
        currentRequirement.description = line.trim()
      }
    }
  }

  flushRequirement()

  return {
    title,
    overview,
    filePath,
    requirements,
  }
}

const readConfigFile = (fs: FSUtil.Interface, filePath: string) =>
  fs.readFileStringSafe(filePath).pipe(
    Effect.map((text) => {
      if (text === undefined) return DEFAULT_OPEN_SPEC_CONFIG
      try {
        const parsed = JSON.parse(text)
        return {
          directory: typeof parsed.openspec?.directory === "string"
            ? parsed.openspec.directory
            : DEFAULT_OPEN_SPEC_CONFIG.directory,
        }
      } catch {
        return DEFAULT_OPEN_SPEC_CONFIG
      }
    }),
    Effect.catch(() => Effect.succeed(DEFAULT_OPEN_SPEC_CONFIG)),
  )

const findProjectRoot = Effect.fn("OpenSpec.findProjectRoot")(function* (fs: FSUtil.Interface, startDir: string) {
  let current = startDir
  while (true) {
    const packageJson = yield* fs.readFileStringSafe(path.join(current, "package.json"))
    if (packageJson !== undefined) {
      try {
        const parsed = JSON.parse(packageJson)
        if (parsed.name === "@opencode-ai/opencode" || parsed.name === "HelixAgent" || parsed.workspaces) {
          return current
        }
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return startDir
    current = parent
  }
})

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const spawner = yield* ChildProcessSpawner
    const projectRoot = yield* findProjectRoot(fs, process.cwd())

    const getConfig = Effect.fn("OpenSpec.getConfig")(function* () {
      const cfg = yield* readConfigFile(fs, path.join(projectRoot, "opencode.json"))
      const jsonc = yield* readConfigFile(fs, path.join(projectRoot, "opencode.jsonc"))
      return {
        directory: path.resolve(projectRoot, cfg.directory ?? jsonc.directory ?? DEFAULT_OPEN_SPEC_CONFIG.directory),
      }
    })

    const parseSpecFile = Effect.fn("OpenSpec.parseSpecFile")(function* (filePath: string) {
      const content = yield* fs.readFileStringSafe(filePath).pipe(
        Effect.matchEffect({
          onFailure: () => Effect.fail(new Error(`Spec file not found: ${filePath}`)),
          onSuccess: (text) => {
            if (text === undefined) return Effect.fail(new Error(`Spec file not found: ${filePath}`))
            return Effect.succeed(parseSpecMarkdown(filePath, text))
          },
        }),
      )
      return content
    })

    const parseAllSpecs = Effect.fn("OpenSpec.parseAllSpecs")(function* (dir?: string) {
      const cfg = yield* getConfig()
      const specDir = dir ?? cfg.directory
      const entries = yield* fs.readDirectoryEntries(specDir).pipe(
        Effect.matchEffect({
          onFailure: () => Effect.succeed([] as FSUtil.DirEntry[]),
          onSuccess: (items) => Effect.succeed(items),
        }),
      )
      const specFiles: string[] = []
      for (const entry of entries) {
        const entryPath = path.join(specDir, entry.name)
        if (entry.type === "directory") {
          const nestedEntries = yield* fs.readDirectoryEntries(entryPath).pipe(
            Effect.matchEffect({
              onFailure: () => Effect.succeed([] as FSUtil.DirEntry[]),
              onSuccess: (items) => Effect.succeed(items),
            }),
          )
          for (const nested of nestedEntries) {
            if (nested.type === "file" && nested.name.endsWith(".md")) {
              specFiles.push(path.join(entryPath, nested.name))
            }
          }
        } else if (entry.name.endsWith(".md")) {
          specFiles.push(entryPath)
        }
      }
      return yield* Effect.forEach(specFiles, (filePath) => parseSpecFile(filePath), {
        concurrency: 5,
        discard: false,
      })
    })

    const findSpecForTask = Effect.fn("OpenSpec.findSpecForTask")(function* (
      taskDescription: string,
      specs: SpecDoc[],
    ) {
      const lowerDesc = taskDescription.toLowerCase()
      const scored = specs
        .map((spec) => {
          const titleScore = spec.title.toLowerCase().split(" ").filter((word) => lowerDesc.includes(word)).length
          const reqScore = spec.requirements.reduce((sum, req) => {
            const words = req.title.toLowerCase().split(" ")
            return sum + words.filter((word) => lowerDesc.includes(word)).length
          }, 0)
          return { spec, score: titleScore + reqScore }
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
      const best = scored[0]?.spec
      return best ? Option.some(best) : Option.none()
    })

    const runVerification = (command: string, args: string[]) =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(ChildProcess.make(command, args, { cwd: projectRoot }))
          const code = yield* handle.exitCode
          return code === 0
        }).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.succeed(false),
            onSuccess: (passed) => Effect.succeed(passed),
          }),
        ),
      )

    const checkRequirement = Effect.fn("OpenSpec.checkRequirement")(function* (req: SpecRequirement) {
      if (req.verification.type === "manual") {
        return req.status === "implemented"
      }

      if (req.verification.type === "grep") {
        return yield* runVerification("sh", ["-c", `grep ${req.verification.target}`])
      }

      if (req.verification.type === "test") {
        return yield* runVerification("sh", ["-c", req.verification.target])
      }

      if (req.verification.type === "script") {
        return yield* runVerification("bun", ["run", req.verification.target])
      }

      if (req.verification.type === "ast") {
        const target = req.verification.target
        const colonIndex = target.indexOf(":")
        if (colonIndex === -1) {
          yield* Effect.logWarning("openspec: ast verification target must be in format file:pattern", { target })
          return false
        }
        const filePath = target.slice(0, colonIndex)
        const patternStr = target.slice(colonIndex + 1)
        const fullPath = path.resolve(projectRoot, filePath)

        const content = yield* fs.readFileStringSafe(fullPath)
        if (content === undefined) {
          yield* Effect.logWarning("openspec: ast verification file not found", { file: fullPath })
          return false
        }

        // Check if pattern is regex (wrapped in /.../)
        const regexMatch = patternStr.match(/^\/(.+)\/([gimsuy]*)$/)
        if (regexMatch) {
          const regex = new RegExp(regexMatch[1], regexMatch[2])
          return regex.test(content)
        }

        // Default: string contains match
        return content.includes(patternStr)
      }

      return false
    })

    return Service.of({
      getConfig,
      parseSpecFile,
      parseAllSpecs,
      findSpecForTask,
      checkRequirement,
    })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(CrossSpawnSpawner.defaultLayer),
  ),
)

export * as OpenSpec from "./spec"
