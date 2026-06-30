import * as Tool from "./tool"
import DESCRIPTION from "./screenshot.txt"
import { Schema, Effect, Exit, Scope } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import * as fs from "fs/promises"
import * as os from "os"
import path from "path"

export const Parameters = Schema.Struct({
  description: Schema.optional(Schema.String),
  include_annotations: Schema.optional(Schema.Boolean),
})

type ScreenshotMetadata = {
  width?: number
  height?: number
  size?: number
}

export const ScreenshotTool = Tool.define<
  typeof Parameters,
  ScreenshotMetadata,
  ChildProcessSpawner | Scope.Scope
>(
  "screenshot",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<ScreenshotMetadata>) =>
        Effect.gen(function* () {
          if (process.platform !== "darwin") {
            return {
              title: "unsupported platform",
              output: "Screenshot capture is only supported on macOS.",
              metadata: {},
            }
          }

          yield* ctx.ask({
            permission: "screenshot",
            patterns: [params.description ?? "desktop screenshot"],
            always: ["*"],
            metadata: {
              description: params.description,
              include_annotations: params.include_annotations,
            },
          })

          const tmpDir = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "opencode-screenshot-")))
          const tmpFile = path.join(tmpDir, "screenshot.png")

          const captureResult = yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(ChildProcess.make("screencapture", ["-x", tmpFile]))
              const exit = yield* handle.exitCode.pipe(Effect.exit)
              return Exit.isSuccess(exit)
            }),
          )

          if (!captureResult) {
            return { title: "screenshot failed", output: "Failed to capture screenshot.", metadata: {} }
          }

          const bytes = yield* Effect.promise(() => fs.readFile(tmpFile))
          const stat = yield* Effect.promise(() => fs.stat(tmpFile))
          const cleanup = Effect.promise(() =>
            fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
          )

          yield* cleanup.pipe(Effect.ignore)

          const base64Content = Buffer.from(bytes).toString("base64")
          const mime = "image/png"

          return {
            title: params.description ?? "Screenshot captured",
            output: `Captured screenshot (${stat.size} bytes, PNG).`,
            metadata: {},
            attachments: [
              {
                type: "file" as const,
                mime,
                filename: "screenshot.png",
                url: `data:${mime};base64,${base64Content}`,
              },
            ],
          }
        }).pipe(Effect.orDie),
    }
  }),
)
