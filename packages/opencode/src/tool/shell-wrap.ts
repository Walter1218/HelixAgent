export interface ShellInput {
  script: string
}

export interface ShellResult {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export function shellWrap(execute: (args: ShellInput) => Promise<ShellResult>): (args: ShellInput) => Promise<ShellResult> {
  return async (args: ShellInput) => {
    if (typeof args.script !== "string" || args.script.trim() === "") {
      return {
        title: "missing script",
        output: "This tool requires a `script` string parameter.",
        metadata: { commands: 0, success: 0 },
      }
    }

    return execute(args)
  }
}
