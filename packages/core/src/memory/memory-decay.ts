import { hashContent, hashFile } from "./semantic-hash"
import * as path from "path"
import * as fs from "fs/promises"

export function filterDecayed(content: string, baseDir: string): Promise<string> {
  if (!content.includes("[hash:")) return Promise.resolve(content)

  const lines = content.split("\n")
  const validLines: string[] = []
  let decayedCount = 0

  const processLines = async () => {
    for (const line of lines) {
      const match = line.match(/\[file:\s*([^\]]+)\]\s*\[hash:\s*([a-f0-9]+)\]/)
      if (match) {
        const filepath = match[1]
        const expectedHash = match[2]
        const fullPath = path.resolve(baseDir, filepath)
        
        try {
          await fs.access(fullPath)
          const currentHash = await hashFile(fullPath)
          if (currentHash !== expectedHash) {
            decayedCount++
            continue
          }
        } catch {
          decayedCount++
          continue
        }
      }
      validLines.push(line)
    }
    return validLines.join("\n")
  }

  return processLines()
}

export * as MemoryDecay from "./memory-decay"
