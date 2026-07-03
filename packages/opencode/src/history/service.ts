export * as History from "./service"

import { Context, Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { makeGlobalNode } from "@opencode-ai/core/effect/app-node"
import { hashContent } from "@opencode-ai/core/memory/semantic-hash"
import type { HistoryKind, SearchHit } from "./schema"

export interface Interface {
  readonly ingest: (message: {
    message_id: string
    session_id: string
    part_id: string
    kind: HistoryKind
    tool_name?: string
    content: string
    time_created: number
  }) => Effect.Effect<void>
  readonly search: (input: {
    query: string
    kind?: HistoryKind | HistoryKind[]
    time_after?: number
    time_before?: number
    limit?: number
  }) => Effect.Effect<SearchHit[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/History") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const ingest = Effect.fn("History.ingest")(function* (message) {
      const fingerprint = hashContent(message.content)

      // 检查是否已存在
      const existing = yield* db
        .all<{ fingerprint: string }>(sql`SELECT fingerprint FROM history_meta WHERE message_id = ${message.message_id} AND part_id = ${message.part_id}`)
        .pipe(Effect.orDie)

      if (existing[0]?.fingerprint === fingerprint) return

      // 写入 FTS
      yield* db.run(sql`
        INSERT OR REPLACE INTO history_fts (message_id, session_id, part_id, kind, tool_name, content, time_created)
        VALUES (${message.message_id}, ${message.session_id}, ${message.part_id}, ${message.kind}, ${message.tool_name ?? null}, ${message.content}, ${message.time_created})
      `).pipe(Effect.orDie)

      // 写入 meta
      yield* db.run(sql`
        INSERT OR REPLACE INTO history_meta (message_id, session_id, part_id, kind, tool_name, time_created, fingerprint)
        VALUES (${message.message_id}, ${message.session_id}, ${message.part_id}, ${message.kind}, ${message.tool_name ?? null}, ${message.time_created}, ${fingerprint})
      `).pipe(Effect.orDie)
    })

    const search = Effect.fn("History.search")(function* (input: {
      query: string
      kind?: HistoryKind | HistoryKind[]
      time_after?: number
      time_before?: number
      limit?: number
    }) {
      const limit = input.limit ?? 10
      const conditions: string[] = []

      if (input.kind) {
        if (Array.isArray(input.kind)) {
          const kindList = input.kind.map((k: string) => `'${k}'`).join(", ")
          conditions.push(`kind IN (${kindList})`)
        } else {
          conditions.push(`kind = '${input.kind}'`)
        }
      }

      if (input.time_after !== undefined) {
        conditions.push(`time_created >= ${input.time_after}`)
      }
      if (input.time_before !== undefined) {
        conditions.push(`time_created <= ${input.time_before}`)
      }

      const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1"

      // Clean FTS5 special characters and wrap in quotes for phrase search
      // unicode61 tokenizer treats .,;,:/ etc as separators, remove them to avoid syntax errors
      const cleanedQuery = input.query
        .replace(/["'*:^()[\]{}<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      const escapedQuery = cleanedQuery ? `"${cleanedQuery.replace(/"/g, '""')}"` : ""

      const rows = yield* db
        .all<{
          message_id: string
          session_id: string
          part_id: string
          kind: string
          tool_name: string | null
          content: string
          time_created: number
        }>(sql`
          SELECT
            message_id,
            session_id,
            part_id,
            kind,
            tool_name,
            content,
            time_created
          FROM history_fts
          WHERE ${sql.raw(whereClause)}
            AND history_fts MATCH ${escapedQuery}
          ORDER BY rank
          LIMIT ${limit}
        `)
        .pipe(
          Effect.catch(() =>
            Effect.gen(function* () {
              // Log concise warning with query snippet for debugging
              const querySnippet = input.query.length > 100
                ? input.query.substring(0, 100) + "..."
                : input.query
              yield* Effect.logWarning(`History search failed, skipping (query: "${querySnippet}")`)
              return [] as SearchHit[]
            })
          )
        )

      return rows.map((row: any) => ({
        message_id: row.message_id,
        session_id: row.session_id,
        part_id: row.part_id,
        project_id: "",
        kind: row.kind as HistoryKind,
        tool_name: row.tool_name,
        snippet: row.content.substring(0, 240) + (row.content.length > 240 ? "..." : ""),
        score: 0,
        time_created: row.time_created,
      }))
    }, Effect.scoped)

    return Service.of({ ingest, search })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })

import { sql } from "drizzle-orm"
