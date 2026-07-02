import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260701_add_memory_vec",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS memory_vec (
          memory_path TEXT PRIMARY KEY,
          embedding   BLOB NOT NULL,
          hash        TEXT NOT NULL,
          dimension   INTEGER NOT NULL DEFAULT 768,
          updated_at  INTEGER NOT NULL
        )
      `)

      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS idx_memory_vec_hash ON memory_vec(hash)
      `)
    })
  },
} satisfies DatabaseMigration.Migration
