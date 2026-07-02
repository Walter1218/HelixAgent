import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260701_add_trace_event",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS trace_event (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          parent_id TEXT,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          duration INTEGER,
          metadata TEXT,
          time_created INTEGER NOT NULL
        )
      `)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_trace_event_session ON trace_event(session_id)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_trace_event_time ON trace_event(time_created)`)
    })
  },
} satisfies DatabaseMigration.Migration
