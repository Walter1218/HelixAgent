import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const WorkflowRunTable = sqliteTable("workflow_run", {
  id: text().primaryKey(),
  run_id: text().notNull().unique(),
  session_id: text().notNull(),
  name: text(),
  status: text().notNull(),
  started_at: integer()
    .notNull()
    .$default(() => Date.now()),
  completed_at: integer(),
  error: text(),
})
