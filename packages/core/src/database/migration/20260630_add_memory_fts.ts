import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260630_add_memory_fts",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          path,
          scope,
          scope_id,
          type,
          body,
          fingerprint,
          tokenize='porter unicode61'
        )
      `)

    })
  },
} satisfies DatabaseMigration.Migration
