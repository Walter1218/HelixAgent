export { 
  type WorktreeOptions, 
  type Worktree, 
  createWorktree, 
  removeWorktree, 
  resetWorktree, 
  commitChanges, 
  cleanWorktree, 
  listWorktrees, 
  isWorktreeLocked, 
  generateSlug 
} from "./worktree"

export { garbageCollect, type GCResult } from "./gc"

export * as ShadowWorktree from "./worktree"
