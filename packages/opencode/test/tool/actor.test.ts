import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ActorRegistry } from "../../src/actor/registry"
import { ActorSpawn } from "../../src/actor/spawn"
import { ActorWaiter } from "../../src/actor/waiter"
import { ActorTool } from "../../src/tool/actor"
import * as Tool from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"
import { Agent } from "../../src/agent/agent"
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

const ctx = {
  ...baseCtx,
  ask: () => Effect.void,
} as Tool.Context

const it = testEffect(
  Layer.mergeAll(
    ActorRegistry.defaultLayer,
    ActorSpawn.defaultLayer,
    ActorWaiter.defaultLayer,
    Truncate.defaultLayer,
    Agent.defaultLayer,
  ),
)

const exec = Effect.fn("ActorToolTest.exec")(function* (args: Tool.InferParameters<typeof ActorTool>) {
  const info = yield* ActorTool
  const tool = yield* info.init()
  return yield* tool.execute(args, ctx)
})

describe("tool.actor", () => {
  it.instance("spawns and returns actor", () =>
    Effect.gen(function* () {
      const result = yield* exec({ operation: "spawn", subagent_type: "build", prompt: "do something" })
      expect(result.metadata.actor_id).toBeDefined()
      expect(result.metadata.status).toBe("pending")
      expect(result.output).toContain("build")
    }))

  it.instance("status returns unknown for missing actor", () =>
    Effect.gen(function* () {
      const result = yield* exec({ operation: "status", actor_id: "missing" })
      expect(result.metadata.status).toBe("unknown")
    }))

  it.instance("cancel updates actor status", () =>
    Effect.gen(function* () {
      const spawnResult = yield* exec({ operation: "spawn", subagent_type: "build", prompt: "task" })
      const actorID = spawnResult.metadata.actor_id
      expect(actorID).toBeDefined()
      const result = yield* exec({ operation: "cancel", actor_id: actorID })
      expect(result.metadata.status).toBe("cancelled")
    }))

  it.instance("send requires actor_id", () =>
    Effect.gen(function* () {
      const result = yield* exec({ operation: "send", content: "hello" })
      expect(result.output).toContain("actor_id or to_actor_id required")
    }))
})
