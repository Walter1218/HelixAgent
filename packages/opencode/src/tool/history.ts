import * as Tool from "./tool"
import DESCRIPTION from "./history.txt"
import { Schema, Effect } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { SessionMessageTable, SessionTable } from "@opencode-ai/core/session/sql"
import { desc, eq, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { Session } from "@/session/session"

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20
const DEFAULT_AROUND = 5

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["search", "around"]),
  query: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.Literals(["project", "global"])),
  session_id: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.Array(Schema.String)),
  tool_name: Schema.optional(Schema.String),
  time_after: Schema.optional(Schema.Number),
  time_before: Schema.optional(Schema.Number),
  limit: Schema.optional(Schema.Number),
  message_id: Schema.optional(Schema.String),
  before: Schema.optional(Schema.Number),
  after: Schema.optional(Schema.Number),
})

type MessageData = {
  text?: string
  content?: Array<{ text?: string; name?: string }>
  command?: string
  summary?: string
}

function extractText(data: MessageData): string | undefined {
  if (data.text) return data.text
  if (data.content?.length) {
    return data.content
      .map((part) => {
        if (part.text) return part.text
        if (part.name) return `[tool: ${part.name}]`
        return ""
      })
      .join(" ")
  }
  if (data.command) return `$ ${data.command}`
  if (data.summary) return data.summary
  return undefined
}

function truncate(text: string, max = 240) {
  if (text.length <= max) return text
  return text.slice(0, max - 3) + "..."
}

function escapeLike(input: string) {
  return input.replace(/[%_]/g, "\\$&")
}

export const HistoryTool = Tool.define(
  "history",
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const sessions = yield* Session.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const session = yield* sessions.get(ctx.sessionID).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const projectID = session?.projectID

          if (params.operation === "around") {
            if (!params.message_id) {
              return { title: "error", output: "message_id is required for around operation", metadata: {} }
            }

            const anchor = yield* db
              .select({ session_id: SessionMessageTable.session_id, seq: SessionMessageTable.seq })
              .from(SessionMessageTable)
              .where(sql`${SessionMessageTable.id} = ${params.message_id}`)
              .get()
              .pipe(Effect.orDie)

            if (!anchor) {
              return { title: "not found", output: `Message ${params.message_id} not found`, metadata: {} }
            }

            const before = params.before ?? DEFAULT_AROUND
            const after = params.after ?? DEFAULT_AROUND

            const beforeRows = yield* db
              .all<typeof SessionMessageTable.$inferSelect>(sql`
                SELECT * FROM ${SessionMessageTable}
                WHERE ${SessionMessageTable.session_id} = ${anchor.session_id}
                  AND ${SessionMessageTable.seq} < ${anchor.seq}
                ORDER BY ${SessionMessageTable.seq} DESC
                LIMIT ${before}
              `)
              .pipe(Effect.orDie)

            const afterRows = yield* db
              .all<typeof SessionMessageTable.$inferSelect>(sql`
                SELECT * FROM ${SessionMessageTable}
                WHERE ${SessionMessageTable.session_id} = ${anchor.session_id}
                  AND ${SessionMessageTable.seq} > ${anchor.seq}
                ORDER BY ${SessionMessageTable.seq} ASC
                LIMIT ${after}
              `)
              .pipe(Effect.orDie)

            const anchorRow = yield* db
              .select()
              .from(SessionMessageTable)
              .where(sql`${SessionMessageTable.id} = ${params.message_id}`)
              .get()
              .pipe(Effect.orDie)

            const rows = [...beforeRows.reverse(), anchorRow, ...afterRows].filter(
              (row): row is NonNullable<typeof row> => row !== undefined,
            )
            return formatRows(rows, `Context around ${params.message_id}`)
          }

          const query = params.query?.trim()
          if (!query) {
            return { title: "error", output: "query is required for search operation", metadata: {} }
          }

          const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
          const conditions: SQL[] = []

          if (params.session_id) {
            conditions.push(sql`${SessionMessageTable.session_id} = ${params.session_id}`)
          } else if (params.scope === "project" && projectID) {
            const sessionIDs = db
              .select({ id: SessionTable.id })
              .from(SessionTable)
              .where(eq(SessionTable.project_id, projectID))
            conditions.push(sql`${SessionMessageTable.session_id} IN ${sessionIDs}`)
          }

          if (params.kind?.length) {
            const kindList = params.kind.map((k) => `'${k}'`).join(", ")
            conditions.push(sql`${SessionMessageTable.type} IN (${sql.raw(kindList)})`)
          }

          if (params.tool_name) {
            conditions.push(
              sql`json_extract(${SessionMessageTable.data}, '$.content') LIKE ${`%"name":"${escapeLike(params.tool_name)}"%`}`,
            )
          }

          if (params.time_after !== undefined) {
            conditions.push(sql`${SessionMessageTable.time_created} >= ${params.time_after}`)
          }
          if (params.time_before !== undefined) {
            conditions.push(sql`${SessionMessageTable.time_created} <= ${params.time_before}`)
          }

          const likePattern = `%${escapeLike(query)}%`
          conditions.push(
            sql`(
              ${SessionMessageTable.data} LIKE ${likePattern}
              OR json_extract(${SessionMessageTable.data}, '$.text') LIKE ${likePattern}
              OR json_extract(${SessionMessageTable.data}, '$.command') LIKE ${likePattern}
              OR json_extract(${SessionMessageTable.data}, '$.summary') LIKE ${likePattern}
            )`,
          )

          const whereClause = conditions.length ? sql.join(conditions, sql` AND `) : sql`1=1`

          const rows = yield* db
            .all<typeof SessionMessageTable.$inferSelect>(sql`
              SELECT * FROM ${SessionMessageTable}
              WHERE ${whereClause}
              ORDER BY ${SessionMessageTable.time_created} DESC
              LIMIT ${limit}
            `)
            .pipe(Effect.orDie)

          return formatRows(rows, `Search results for "${query}"`)
        }),
    }
  }),
)

function formatRows(rows: (typeof SessionMessageTable.$inferSelect)[], title: string) {
  const items = rows.map((row) => {
    const data = row.data as MessageData
    const text = extractText(data) ?? ""
    return {
      session_id: row.session_id,
      message_id: row.id,
      type: row.type,
      time_created: row.time_created,
      snippet: truncate(text),
    }
  })

  const output =
    items.length === 0
      ? "No matching messages found."
      : [
          `Found ${items.length} message(s):`,
          "",
          ...items.map(
            (item) =>
              `- [${item.type}] ${new Date(item.time_created).toISOString()} | session=${item.session_id} msg=${item.message_id}\n  ${item.snippet}`,
          ),
        ].join("\n")

  return {
    title,
    output,
    metadata: { count: items.length },
  }
}
