import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Truncate } from "../../src/tool/truncate"
import { Agent } from "../../src/agent/agent"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { ScreenshotTool } from "../../src/tool/screenshot"
import * as Tool from "../../src/tool/tool"
import { SessionID, MessageID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const baseCtx: Omit<Tool.Context, "ask"> = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
}

const it = testEffect(Layer.mergeAll(CrossSpawnSpawner.defaultLayer, Truncate.defaultLayer, Agent.defaultLayer))

const exec = Effect.fn("ScreenshotToolTest.exec")(function* (args: Tool.InferParameters<typeof ScreenshotTool>) {
  const info = yield* ScreenshotTool
  const tool = yield* info.init()
  return yield* tool.execute(args, {
    ...baseCtx,
    ask: () => Effect.void,
  } as Tool.Context)
})

describe("tool.screenshot", () => {
  it.instance("captures screenshot on darwin or reports unsupported", () =>
    Effect.gen(function* () {
      const result = yield* exec({ description: "test" })
      if (process.platform === "darwin") {
        expect(result.attachments?.length).toBe(1)
        expect(result.attachments?.[0].mime).toBe("image/png")
      } else {
        expect(result.output).toContain("only supported on macOS")
      }
    }))
})
