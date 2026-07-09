export * as CreatorHelixSql from "./sql"

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const ProjectTable = sqliteTable(
  "creator_helix_project",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    title: text().notNull(),
    state: text().notNull(),
    context: text({ mode: "json" }).notNull(),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
    updated_at: integer()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  (table) => [index("creator_helix_project_user_idx").on(table.user_id)],
)

export const ShotTable = sqliteTable(
  "creator_helix_shot",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    sequence: integer().notNull(),
    description: text().notNull(),
    visual_prompt: text().notNull(),
    motion_prompt: text().notNull(),
    narration: text().notNull(),
    duration_seconds: integer().notNull(),
    asset_id: text(),
  },
  (table) => [index("creator_helix_shot_project_idx").on(table.project_id, table.sequence)],
)

export const AssetTable = sqliteTable(
  "creator_helix_asset",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    shot_id: text(),
    type: text().notNull(),
    url: text().notNull(),
    metadata: text({ mode: "json" }),
    status: text().notNull(),
    retry_count: integer().notNull().default(0),
    error_message: text(),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
    updated_at: integer()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  (table) => [index("creator_helix_asset_project_idx").on(table.project_id)],
)

export const TransitionLogTable = sqliteTable(
  "creator_helix_transition_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    project_id: text().notNull(),
    from_state: text().notNull(),
    to_state: text().notNull(),
    event_type: text().notNull(),
    event_payload: text({ mode: "json" }),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [index("creator_helix_transition_project_idx").on(table.project_id)],
)
