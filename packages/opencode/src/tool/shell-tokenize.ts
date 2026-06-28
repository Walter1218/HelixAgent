export interface Argv {
  line: number
  tokens: string[]
}

export interface ParseError {
  kind: "unclosed-quote" | "unsupported-operator" | "unclosed-heredoc" | "internal"
  line: number
  detail: string
}

export function tokenize(script: string): { ok: true; result: Argv[] } | { ok: false; error: ParseError } {
  if (script.trim() === "") return { ok: true, result: [] }

  const lines = script.split("\n").filter((l) => l.trim() !== "")
  const result: Argv[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith("#")) continue
    result.push({ line: i + 1, tokens: line.split(/\s+/) })
  }

  return { ok: true, result }
}
