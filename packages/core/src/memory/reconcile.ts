import * as fs from "fs/promises"
import path from "path"
import { parsePath, parseCcPath, parseCcFrontmatterType, type MemoryLocator } from "./paths"

export async function walkMemoryDir(root: string): Promise<string[]> {
  const out: string[] = []
  async function recurse(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return [] as import("fs").Dirent[]
      throw e
    })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await recurse(full)
      else if (entry.isFile() && full.endsWith(".md")) out.push(full)
    }
  }
  await recurse(root)
  return out
}

export async function walkCcRoot(base: string): Promise<string[]> {
  const slugs = await fs.readdir(base, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [] as import("fs").Dirent[]
    throw e
  })
  const out: string[] = []
  for (const entry of slugs) {
    if (!entry.isDirectory()) continue
    const memoryDir = path.join(base, entry.name, "memory")
    const exists = await fs.stat(memoryDir).then(() => true).catch(() => false)
    if (!exists) continue
    const files = await walkMemoryDir(memoryDir)
    for (const f of files) out.push(f)
  }
  return out
}

export async function reconcileMemory(
  roots: { mimo: string; cc?: string; onNewIndex?: (path: string, body: string) => void },
): Promise<{ indexed: number; pruned: number }> {
  const mimoFiles = await walkMemoryDir(roots.mimo)
  const ccFiles = roots.cc ? await walkCcRoot(roots.cc) : []
  
  return { indexed: mimoFiles.length + ccFiles.length, pruned: 0 }
}
