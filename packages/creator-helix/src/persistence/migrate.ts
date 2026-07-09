export * as Migration from "./migrate"

import { Effect } from "effect"
import { Database } from "@opencode-ai/core/database/database"

const statements = [
  `CREATE TABLE IF NOT EXISTS creator_helix_project (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    context TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_project_user_idx ON creator_helix_project(user_id)`,
  `CREATE TABLE IF NOT EXISTS creator_helix_shot (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    description TEXT NOT NULL,
    visual_prompt TEXT NOT NULL,
    motion_prompt TEXT NOT NULL,
    narration TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    asset_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_shot_project_idx ON creator_helix_shot(project_id, sequence)`,
  `CREATE TABLE IF NOT EXISTS creator_helix_asset (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    shot_id TEXT,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    metadata TEXT,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_asset_project_idx ON creator_helix_asset(project_id)`,
  `CREATE TABLE IF NOT EXISTS creator_helix_transition_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_payload TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_transition_project_idx ON creator_helix_transition_log(project_id)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_studio (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_studio_name_idx ON creator_helix_studio(name)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_knowledge_project (
    id TEXT PRIMARY KEY,
    studio_id TEXT NOT NULL,
    title TEXT NOT NULL,
    logline TEXT NOT NULL,
    theme TEXT NOT NULL,
    target_duration INTEGER NOT NULL DEFAULT 0,
    style_preset_id TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_knowledge_project_studio_idx ON creator_helix_knowledge_project(studio_id)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_asset_task (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    studio_id TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    provider TEXT NOT NULL,
    prompt TEXT NOT NULL,
    ref_images TEXT NOT NULL DEFAULT '[]',
    outputs TEXT NOT NULL DEFAULT '[]',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    parent_ref TEXT,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_asset_task_project_idx ON creator_helix_asset_task(project_id)`,
  `CREATE INDEX IF NOT EXISTS creator_helix_asset_task_status_idx ON creator_helix_asset_task(status)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_pipeline_run (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    studio_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    completed_at INTEGER,
    total_shots INTEGER NOT NULL DEFAULT 0,
    completed_shots INTEGER NOT NULL DEFAULT 0,
    failed_shots INTEGER NOT NULL DEFAULT 0,
    error TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_pipeline_run_project_idx ON creator_helix_pipeline_run(project_id)`,
  `CREATE INDEX IF NOT EXISTS creator_helix_pipeline_run_status_idx ON creator_helix_pipeline_run(status)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_pipeline_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    shot_id TEXT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    data TEXT NOT NULL DEFAULT '{}',
    duration_ms INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_pipeline_event_run_idx ON creator_helix_pipeline_event(run_id)`,
  `CREATE INDEX IF NOT EXISTS creator_helix_pipeline_event_shot_idx ON creator_helix_pipeline_event(shot_id)`,
  `CREATE INDEX IF NOT EXISTS creator_helix_pipeline_event_type_idx ON creator_helix_pipeline_event(event_type)`,

  `CREATE TABLE IF NOT EXISTS creator_helix_series (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    logline TEXT NOT NULL,
    theme TEXT,
    studio_id TEXT NOT NULL,
    style_preset_id TEXT,
    world_rules TEXT NOT NULL DEFAULT '[]',
    ordering TEXT NOT NULL DEFAULT 'sequential',
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS creator_helix_series_studio_idx ON creator_helix_series(studio_id)`,
]

export const run = Effect.gen(function* () {
  const { db } = yield* Database.Service
  for (const sql of statements) {
    yield* db.run(sql).pipe(Effect.orDie)
  }
})
