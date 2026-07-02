import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260701_add_spec_library",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS spec_library (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          domain TEXT,
          feature TEXT,
          file_path TEXT NOT NULL,
          content TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          tags TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_spec_library_domain ON spec_library(domain)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_spec_library_status ON spec_library(status)`)
    })
  },
} satisfies DatabaseMigration.Migration
