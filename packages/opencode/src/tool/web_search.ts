import { Duration, Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"
import DESCRIPTION from "./web_search.txt"
import { Config } from "@/config/config"

const MiMoSearchArgs = Schema.Struct({
  query: Schema.String,
  numResults: Schema.optional(Schema.Number),
  forceSearch: Schema.optional(Schema.Boolean),
})

const MiMoAnnotation = Schema.Struct({
  type: Schema.Literal("url_citation"),
  url: Schema.String,
  title: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  publish_time: Schema.optional(Schema.String),
})

const MiMoChoice = Schema.Struct({
  finish_reason: Schema.optional(Schema.String),
  message: Schema.Struct({
    role: Schema.Literal("assistant"),
    content: Schema.String,
    annotations: Schema.optional(Schema.Array(MiMoAnnotation)),
  }),
})

const MiMoResponse = Schema.Struct({
  choices: Schema.Array(MiMoChoice),
})

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Web search query" }),
  numResults: Schema.optional(Schema.Number).annotate({
    description: "Number of search results to return (default: 8)",
  }),
  forceSearch: Schema.optional(Schema.Boolean).annotate({
    description: "Force web search instead of letting the model decide (default: false)",
  }),
})

type WebSearchProvider = "mimo" | "exa" | "parallel" | undefined

const mimoDefaults = {
  baseUrl: "https://api.xiaomimimo.com/v1",
  model: "mimo-v2.5-pro",
}

function callMiMo(
  http: HttpClient.HttpClient,
  config: { apiKey?: string; baseUrl?: string },
  params: Schema.Schema.Type<typeof Parameters>,
) {
  return Effect.gen(function* () {
    const body = {
      model: mimoDefaults.model,
      messages: [{ role: "user", content: params.query }],
      tools: [
        {
          type: "web_search",
          max_keyword: 3,
          force_search: params.forceSearch ?? false,
          limit: params.numResults ?? 8,
        } as const,
      ],
      max_completion_tokens: 1024,
      temperature: 1,
      top_p: 0.95,
      stream: false,
      thinking: { type: "disabled" as const },
    }

    const request = yield* HttpClientRequest.post(`${config.baseUrl ?? mimoDefaults.baseUrl}/chat/completions`).pipe(
      HttpClientRequest.setHeader("Content-Type", "application/json"),
      HttpClientRequest.setHeader("api-key", config.apiKey ?? ""),
      HttpClientRequest.bodyJson(body),
    )

    const response = yield* HttpClient.filterStatusOk(http)
      .execute(request)
      .pipe(
        Effect.timeoutOrElse({
          duration: Duration.seconds(25),
          orElse: () => Effect.die(new Error("MiMo web search request timed out")),
        }),
      )

    const text = yield* response.text
    const parsed = yield* Schema.decodeUnknownEffect(MiMoResponse)(JSON.parse(text))
    const choice = parsed.choices[0]
    if (!choice) return { answer: undefined, results: [] as SearchResult[] }

    const results =
      choice.message.annotations
        ?.filter((a) => a.type === "url_citation")
        .map((a) => ({
          title: a.title ?? "",
          url: a.url,
          summary: a.summary ?? "",
          publishTime: a.publish_time,
        })) ?? []

    return { answer: choice.message.content, results }
  })
}

interface SearchResult {
  title: string
  url: string
  summary: string
  publishTime?: string
}

function formatOutput(answer: string | undefined, results: SearchResult[]) {
  const lines: string[] = []
  if (results.length > 0) {
    lines.push("Sources:")
    for (const result of results) {
      lines.push(`- [${result.title}](${result.url})`)
      if (result.summary) lines.push(`  ${result.summary}`)
    }
  }
  if (answer) {
    if (lines.length > 0) lines.push("")
    lines.push(answer)
  }
  return lines.join("\n") || "No search results found. Please try a different query."
}

function selectProvider(config: { webSearch?: { provider?: string } }): WebSearchProvider {
  const override = process.env.OPENCODE_WEBSEARCH_PROVIDER
  if (override === "mimo" || override === "exa" || override === "parallel") return override
  const provider = config.webSearch?.provider
  if (provider === "mimo" || provider === "exa" || provider === "parallel") return provider
  return undefined
}

export const WebSearchTool = Tool.define(
  "web_search",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const config = yield* Config.Service

    return {
      get description() {
        return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
      },
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          const provider = selectProvider(cfg) ?? "mimo"

          yield* ctx.metadata({ title: `Web Search "${params.query}"`, metadata: { provider } })

          yield* ctx.ask({
            permission: "web_search",
            patterns: [params.query],
            always: ["*"],
            metadata: {
              query: params.query,
              numResults: params.numResults,
              forceSearch: params.forceSearch,
              provider,
            },
          })

          const { answer, results } =
            provider === "mimo"
              ? yield* callMiMo(http, {
                  apiKey: cfg.webSearch?.mimo?.apiKey ?? process.env.MIMO_WEBSEARCH_API_KEY,
                  baseUrl: cfg.webSearch?.mimo?.baseUrl,
                }, params)
              : { answer: undefined, results: [] as SearchResult[] }

          return {
            output: formatOutput(answer, results),
            title: `Web Search: ${params.query}`,
            metadata: { provider, resultCount: results.length },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
