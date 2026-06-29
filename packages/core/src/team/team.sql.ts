import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const TeamTable = sqliteTable("team", {
  id: text().primaryKey(),
  owner_session_id: text().notNull(),
  name: text().notNull(),
  created_at: integer()
    .notNull()
    .$default(() => Date.now()),
})

export const TeamMemberTable = sqliteTable("team_member", {
  id: text().primaryKey(),
  team_id: text().notNull(),
  session_id: text().notNull(),
  agent: text().notNull(),
  role: text().notNull(),
  joined_at: integer()
    .notNull()
    .$default(() => Date.now()),
})
