import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { WebSearchTool } from "../../src/tool/web_search"
import * as Tool from "../../src/tool/tool"
import { it } from "../lib/effect"
import { Truncate } from "@/tool/truncate"
import { Config } from "@/config/config"
import { Agent } from "@/agent/agent"
import { SessionID, MessageID } from "@/session/schema"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"

const json = (req: Parameters<typeof HttpClientResponse.fromWeb>[0], body: unknown, status = 200) =>
  HttpClientResponse.fromWeb(
    req,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )

const fakeHttpLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const url = new URL(request.url)
        expect(url.pathname).toBe("/v1/chat/completions")

        const responseBody = {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Tomorrow will be sunny.",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://example.com/weather",
                    title: "Weather Forecast",
                    summary: "Sunny tomorrow",
                    publish_time: "2026-06-30T00:00:00Z",
                  },
                ],
              },
            },
          ],
        }

        return json(request, responseBody)
      }),
    )
  }),
)

const stubConfigLayer = Layer.succeed(
  Config.Service,
  Config.Service.of({
    get: () => Effect.succeed({} as ConfigV1.Info),
    getGlobal: () => Effect.succeed({} as ConfigV1.Info),
    getConsoleState: () => Effect.succeed({} as any),
    update: () => Effect.void,
    updateGlobal: () => Effect.succeed({ info: {} as ConfigV1.Info, changed: false }),
    invalidate: () => Effect.void,
    directories: () => Effect.succeed([]),
    waitForDependencies: () => Effect.void,
  }),
)

const stubAgentLayer = Layer.succeed(
  Agent.Service,
  Agent.Service.of({
    get: () =>
      Effect.succeed({
        name: "build",
        mode: "primary",
        permission: [],
        options: {},
      } as Agent.Info),
    list: () => Effect.succeed([]),
    defaultInfo: () => Effect.die(new Error("unimplemented")),
    defaultAgent: () => Effect.die(new Error("unimplemented")),
    generate: () => Effect.die(new Error("unimplemented")),
  }),
)

const stubTruncateLayer = Layer.succeed(
  Truncate.Service,
  Truncate.Service.of({
    cleanup: () => Effect.void,
    write: () => Effect.succeed(""),
    output: (content: string) => Effect.succeed({ content, truncated: false }),
    limits: () => Effect.succeed({ maxLines: 2000, maxBytes: 51200 }),
  }),
)

const testLayer = Layer.mergeAll(fakeHttpLayer, stubConfigLayer, stubAgentLayer, stubTruncateLayer)

describe("web_search tool", () => {
  it.effect("parses MiMo response into sources and answer", () =>
    Effect.gen(function* () {
      const info = yield* WebSearchTool
      const tool = yield* Tool.init(info)
      const result = yield* tool.execute(
        { query: "Beijing weather tomorrow" },
        {
          sessionID: "ses_test" as SessionID,
          messageID: "msg_test" as MessageID,
          agent: "build",
          abort: new AbortController().signal,
          messages: [],
          metadata: () => Effect.void,
          ask: () => Effect.void,
        },
      )

      expect(result.output).toContain("Sources:")
      expect(result.output).toContain("[Weather Forecast](https://example.com/weather)")
      expect(result.output).toContain("Tomorrow will be sunny.")
      expect(result.metadata.provider).toBe("mimo")
      expect(result.metadata.resultCount).toBe(1)
    }).pipe(Effect.provide(testLayer)),
  )
})
