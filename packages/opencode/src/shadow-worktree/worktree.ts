import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs/promises"

const execAsync = promisify(exec)

export interface WorktreeOptions {
  repoPath: string
  branchName: string
  slug: string
}

export interface Worktree {
  path: string
  branch: string
  slug: string
  createdAt: number
}

export async function createWorktree(options: WorktreeOptions): Promise<Worktree> {
  const { repoPath, branchName, slug } = options
  const worktreePath = path.join(repoPath, ".worktrees", slug)
  
  // Create worktree directory
  await fs.mkdir(path.dirname(worktreePath), { recursive: true })
  
  // Create git worktree
  await execAsync(`git worktree add --no-checkout -b ${branchName} ${worktreePath}`, { cwd: repoPath })
  
  // Create lock file
  const lockFile = path.join(worktreePath, ".helixagent-lock")
  await fs.writeFile(lockFile, JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
  
  return {
    path: worktreePath,
    branch: branchName,
    slug,
    createdAt: Date.now(),
  }
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  try {
    await execAsync(`git worktree remove --force ${worktreePath}`, { cwd: repoPath })
  } catch (error) {
    // Try to remove manually if git worktree fails
    await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {})
  }
  
  // Remove branch
  const branchName = path.basename(worktreePath)
  await execAsync(`git branch -D ${branchName}`, { cwd: repoPath }).catch(() => {})
}

export async function resetWorktree(worktreePath: string, defaultBranch: string): Promise<void> {
  await execAsync(`git reset --hard ${defaultBranch}`, { cwd: worktreePath })
  await execAsync(`git clean -ffdx`, { cwd: worktreePath })
}

export async function commitChanges(worktreePath: string, message: string): Promise<void> {
  await execAsync("git add -A", { cwd: worktreePath })
  await execAsync(`git commit -m "${message}"`, { cwd: worktreePath })
}

export async function cleanWorktree(worktreePath: string): Promise<void> {
  await execAsync("git clean -ffdx", { cwd: worktreePath })
  await execAsync("git checkout -- .", { cwd: worktreePath })
}

export async function listWorktrees(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync("git worktree list --porcelain", { cwd: repoPath })
    const worktrees: string[] = []
    const lines = stdout.split("\n")
    
    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        worktrees.push(line.slice(9))
      }
    }
    
    return worktrees
  } catch {
    return []
  }
}

export async function isWorktreeLocked(worktreePath: string): Promise<boolean> {
  try {
    const lockFile = path.join(worktreePath, ".helixagent-lock")
    const content = await fs.readFile(lockFile, "utf-8")
    const { pid } = JSON.parse(content)
    
    // Check if process is still running
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
}

export function generateSlug(): string {
  const adjectives = ["happy", "brave", "calm", "eager", "fair"]
  const nouns = ["otter", "eagle", "panda", "tiger", "wolf"]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj}-${noun}-${Date.now().toString(36)}`
}

export * as Worktree from "./worktree"
