export * as StudioSql from "./studio.sql"

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const StudioTable = sqliteTable(
  "creator_helix_studio",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    data: text({ mode: "json" }).notNull(),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
    updated_at: integer()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  (table) => [index("creator_helix_studio_name_idx").on(table.name)],
)

export const KnowledgeProjectTable = sqliteTable(
  "creator_helix_knowledge_project",
  {
    id: text().primaryKey(),
    studio_id: text().notNull(),
    title: text().notNull(),
    logline: text().notNull(),
    theme: text().notNull(),
    target_duration: integer().notNull().default(0),
    style_preset_id: text(),
    data: text({ mode: "json" }).notNull(),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
    updated_at: integer()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  (table) => [
    index("creator_helix_knowledge_project_studio_idx").on(table.studio_id),
  ],
)

export const AssetTaskTable = sqliteTable(
  "creator_helix_asset_task",
  {
    id: text().primaryKey(),
    project_id: text(),
    studio_id: text(),
    type: text().notNull(),
    status: text().notNull().default("queued"),
    provider: text().notNull(),
    prompt: text().notNull(),
    ref_images: text({ mode: "json" }).notNull().default("[]"),
    outputs: text({ mode: "json" }).notNull().default("[]"),
    retry_count: integer().notNull().default(0),
    max_retries: integer().notNull().default(3),
    parent_ref: text(),
    error: text(),
    created_at: integer()
      .notNull()
      .$default(() => Date.now()),
    updated_at: integer()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  (table) => [
    index("creator_helix_asset_task_project_idx").on(table.project_id),
    index("creator_helix_asset_task_status_idx").on(table.status),
  ],
)

// ─── V2 Pipeline Trace ───

export const PipelineRunTable = sqliteTable(
  "creator_helix_pipeline_run",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    studio_id: text().notNull(),
    status: text().notNull().default("pending"),
    started_at: integer().notNull().$default(() => Date.now()),
    completed_at: integer(),
    total_shots: integer().notNull().default(0),
    completed_shots: integer().notNull().default(0),
    failed_shots: integer().notNull().default(0),
    error: text(),
  },
  (table) => [
    index("creator_helix_pipeline_run_project_idx").on(table.project_id),
    index("creator_helix_pipeline_run_status_idx").on(table.status),
  ],
)

export const PipelineEventTable = sqliteTable(
  "creator_helix_pipeline_event",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    run_id: text().notNull(),
    shot_id: text(),
    event_type: text().notNull(),
    status: text().notNull().default("started"),
    data: text({ mode: "json" }).notNull().default("{}"),
    duration_ms: integer(),
    error: text(),
    created_at: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    index("creator_helix_pipeline_event_run_idx").on(table.run_id),
    index("creator_helix_pipeline_event_shot_idx").on(table.shot_id),
    index("creator_helix_pipeline_event_type_idx").on(table.event_type),
  ],
)

// ─── Series (剧集) ───

export const SeriesTable = sqliteTable(
  "creator_helix_series",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    logline: text().notNull(),
    theme: text(),
    studio_id: text().notNull(),
    style_preset_id: text(),
    world_rules: text({ mode: "json" }).notNull().default("[]"),
    ordering: text().notNull().default("sequential"),
    data: text({ mode: "json" }).notNull(),
    created_at: integer().notNull().$default(() => Date.now()),
    updated_at: integer().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (table) => [
    index("creator_helix_series_studio_idx").on(table.studio_id),
  ],
)
