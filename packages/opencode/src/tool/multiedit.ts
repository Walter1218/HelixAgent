import * as Tool from "./tool"
import { Schema, Effect } from "effect"
import { readFile, writeFile } from "fs/promises"

export const Parameters = Schema.Struct({
  filePath: Schema.String,
  edits: Schema.Array(
    Schema.Struct({
      oldString: Schema.String,
      newString: Schema.String,
      replaceAll: Schema.optional(Schema.Boolean),
    }),
  ),
})

export const MultiEditTool = Tool.define(
  "multiedit",
  Effect.gen(function* () {
    return {
      description: "Make multiple edits to a file in a single operation.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx) =>
        Effect.gen(function* () {
          const content = yield* Effect.promise(() => readFile(params.filePath, "utf-8"))
          let result: string = content
          for (const edit of params.edits) {
            if (edit.replaceAll) {
              result = result.replaceAll(edit.oldString, edit.newString)
            } else {
              result = result.replace(edit.oldString, edit.newString)
            }
          }
          yield* Effect.promise(() => writeFile(params.filePath, result, "utf-8"))
          return {
            title: `${params.edits.length} edits applied`,
            output: `Applied ${params.edits.length} edits to ${params.filePath}`,
            metadata: { edits: params.edits.length },
          }
        }),
    }
  }),
)
