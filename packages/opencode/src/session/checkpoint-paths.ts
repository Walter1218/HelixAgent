import path from "path"

export function metaDir(sessionID: string): string {
  return path.join("~/.local/share/opencode/memory/sessions", sessionID)
}

export function checkpointPath(sessionID: string): string {
  return path.join(metaDir(sessionID), "checkpoint.md")
}

export function memoryPath(projectID: string): string {
  return path.join("~/.local/share/opencode/memory/projects", projectID, "MEMORY.md")
}

export function globalMemoryPath(): string {
  return path.join("~/.local/share/opencode/memory/global/MEMORY.md")
}

export function notesPath(sessionID: string): string {
  return path.join(metaDir(sessionID), "notes.md")
}

export function tasksDir(sessionID: string): string {
  return path.join(metaDir(sessionID), "tasks")
}

export function progressPath(sessionID: string, taskID: string): string {
  return path.join(tasksDir(sessionID), taskID, "progress.md")
}
