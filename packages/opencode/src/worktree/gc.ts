import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs/promises"

const execAsync = promisify(exec)

export interface GCResult {
  cleaned: number
  errors: string[]
}

export async function garbageCollect(repoPath: string): Promise<GCResult> {
  const result: GCResult = { cleaned: 0, errors: [] }
  
  try {
    // List all worktrees
    const { stdout } = await execAsync("git worktree list --porcelain", { cwd: repoPath })
    const worktrees = parseWorktreeList(stdout)
    
    for (const worktree of worktrees) {
      try {
        // Check if worktree is locked
        const lockFile = path.join(worktree.path, ".helixagent-lock")
        const lockExists = await fileExists(lockFile)
        
        if (lockExists) {
          const content = await fs.readFile(lockFile, "utf-8")
          const { pid } = JSON.parse(content)
          
          // Check if process is still running
          const isRunning = await isProcessRunning(pid)
          
          if (!isRunning) {
            // Process is dead, clean up worktree
            await cleanupWorktree(repoPath, worktree.path)
            result.cleaned++
          }
        }
      } catch (error) {
        result.errors.push(`Failed to clean ${worktree.path}: ${error}`)
      }
    }
  } catch (error) {
    result.errors.push(`Failed to list worktrees: ${error}`)
  }
  
  return result
}

function parseWorktreeList(output: string): Array<{ path: string; branch: string }> {
  const worktrees: Array<{ path: string; branch: string }> = []
  const lines = output.split("\n")
  
  let currentPath = ""
  let currentBranch = ""
  
  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice(9)
    } else if (line.startsWith("HEAD ")) {
      // Skip
    } else if (line.startsWith("branch ")) {
      currentBranch = line.slice(7)
    } else if (line === "") {
      if (currentPath) {
        worktrees.push({ path: currentPath, branch: currentBranch })
        currentPath = ""
        currentBranch = ""
      }
    }
  }
  
  if (currentPath) {
    worktrees.push({ path: currentPath, branch: currentBranch })
  }
  
  return worktrees
}

async function cleanupWorktree(repoPath: string, worktreePath: string): Promise<void> {
  try {
    await execAsync(`git worktree remove --force ${worktreePath}`, { cwd: repoPath })
  } catch {
    // Try to remove manually
    await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {})
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export * as WorktreeGC from "./gc"
