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
  
  // 简化的提取逻辑
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

export * as AST from "./ast"
