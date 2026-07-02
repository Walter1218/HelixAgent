import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260702_add_history_fts",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
          message_id,
          session_id,
          part_id,
          kind,
          tool_name,
          content,
          time_created,
          tokenize='porter unicode61'
        )
      `)

      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS history_meta (
          message_id   TEXT NOT NULL,
          session_id   TEXT NOT NULL,
          part_id      TEXT NOT NULL,
          kind         TEXT NOT NULL,
          tool_name    TEXT,
          time_created INTEGER NOT NULL,
          fingerprint  TEXT NOT NULL,
          PRIMARY KEY (message_id, part_id)
        )
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_history_meta_session ON history_meta(session_id)
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_history_meta_kind ON history_meta(kind)
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_history_meta_time ON history_meta(time_created)
      `)
    })
  },
} satisfies DatabaseMigration.Migration
