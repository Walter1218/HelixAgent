import * as crypto from "crypto"

export function hashContent(content: string): string {
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .replace(/(^|\s)#.*/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return crypto.createHash("sha256").update(stripped).digest("hex").slice(0, 12)
}

export function hashFile(filepath: string): Promise<string> {
  return Bun.file(filepath).text().then(hashContent).catch(() => "")
}

export * as SemanticHash from "./semantic-hash"
