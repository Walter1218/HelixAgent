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
      yield* tx.run(`CREATE INDEX IF NOT EXISTS memory_fts_scope_idx ON memory_fts(scope, scope_id)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS memory_fts_type_idx ON memory_fts(type)`)
    })
  },
} satisfies DatabaseMigration.Migration
