import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260630_add_team",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS team (
          id TEXT PRIMARY KEY,
          owner_session_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS team_member (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          agent TEXT NOT NULL,
          role TEXT NOT NULL,
          joined_at INTEGER NOT NULL
        )
      `)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_team_owner ON team(owner_session_id)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS idx_team_member_team ON team_member(team_id)`)
    })
  },
} satisfies DatabaseMigration.Migration
