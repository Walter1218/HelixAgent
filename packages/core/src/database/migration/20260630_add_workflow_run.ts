import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260630_add_workflow_run",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS workflow_run (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL UNIQUE,
          session_id TEXT NOT NULL,
          name TEXT,
          status TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          error TEXT
        )
      `)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_workflow_run_session ON workflow_run(session_id)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_workflow_run_status ON workflow_run(status)`)
    })
  },
} satisfies DatabaseMigration.Migration
