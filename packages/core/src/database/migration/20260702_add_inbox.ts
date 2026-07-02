import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260702_add_inbox",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS inbox (
          id               TEXT PRIMARY KEY,
          receiver_session TEXT NOT NULL,
          receiver_actor   TEXT NOT NULL,
          sender_actor     TEXT NOT NULL,
          content          TEXT NOT NULL,
          type             TEXT NOT NULL,
          read             INTEGER NOT NULL DEFAULT 0,
          time_created     INTEGER NOT NULL
        )
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_receiver ON inbox(receiver_session, receiver_actor)
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox(receiver_session, read)
      `)
    })
  },
} satisfies DatabaseMigration.Migration
