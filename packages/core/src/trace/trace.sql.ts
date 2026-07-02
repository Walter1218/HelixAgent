import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const TraceEventTable = sqliteTable("trace_event", {
  id: text().primaryKey(),
  session_id: text().notNull(),
  parent_id: text(),
  type: text().notNull(),
  name: text().notNull(),
  status: text().notNull(),
  duration: integer(),
  metadata: text({ mode: "json" }),
  time_created: integer()
    .notNull()
    .$default(() => Date.now()),
})
