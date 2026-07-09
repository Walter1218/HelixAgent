# 数据库表结构设计

## 设计说明

基于 HelixAgent 现有基础设施，采用 **SQLite + Drizzle ORM** 实现持久化。项目上下文以 JSON 字段存储在 `creator_helix_project` 表中，镜头和素材拆分为独立表。

代码位置：`packages/creator-helix/src/persistence/sql.ts`

## 表结构

### 1. 项目主表

```typescript
export const ProjectTable = sqliteTable(
  "creator_helix_project",
  {
    id: text().primaryKey(),
    user_id: text().notNull(),
    title: text().notNull(),
    state: text().notNull(),
    context: text({ mode: "json" }).notNull(),
    created_at: integer().notNull().$default(() => Date.now()),
    updated_at: integer().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (table) => [index("creator_helix_project_user_idx").on(table.user_id)],
)
```

**字段说明**：
- `state`：当前项目状态
- `context`：项目上下文，包含需求、脚本、分镜、素材数组、暂停来源、错误信息

### 2. 分镜/镜头表

```typescript
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
```

### 3. 素材表

```typescript
export const AssetTable = sqliteTable(
  "creator_helix_asset",
  {
    id: text().primaryKey(),
    project_id: text().notNull(),
    shot_id: text(),
    type: text().notNull(), // video / image / audio / tts / music
    url: text().notNull(),
    metadata: text({ mode: "json" }),
    status: text().notNull(), // pending / generating / done / failed
    retry_count: integer().notNull().default(0),
    error_message: text(),
    created_at: integer().notNull().$default(() => Date.now()),
    updated_at: integer().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (table) => [index("creator_helix_asset_project_idx").on(table.project_id)],
)
```

### 4. 状态转换日志

```typescript
export const TransitionLogTable = sqliteTable(
  "creator_helix_transition_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    project_id: text().notNull(),
    from_state: text().notNull(),
    to_state: text().notNull(),
    event_type: text().notNull(),
    event_payload: text({ mode: "json" }),
    created_at: integer().notNull().$default(() => Date.now()),
  },
  (table) => [index("creator_helix_transition_project_idx").on(table.project_id)],
)
```

## Repository 层

代码位置：`packages/creator-helix/src/persistence/repository.ts`

核心接口：

```typescript
export interface Interface {
  readonly get: (id: VideoProject.ID) => Effect.Effect<VideoProject.Info | undefined>
  readonly create: (input: {
    id?: VideoProject.ID
    userId: string
    title: string
    state?: VideoProject.State
    context?: VideoProject.Context
  }) => Effect.Effect<VideoProject.Info>
  readonly save: (project: VideoProject.Info) => Effect.Effect<void>
  readonly logTransition: (input: {
    projectId: VideoProject.ID
    fromState: VideoProject.State
    toState: VideoProject.State
    event: Event
  }) => Effect.Effect<void>
}
```

实现要点：
- 使用 `@opencode-ai/core/database/database` 的 `Database.Service` 获取 drizzle 客户端
- `context` 字段通过 `Schema.encodeUnknownSync(VideoProject.Context)` / `Schema.decodeUnknownSync(VideoProject.Context)` 与 domain model 互转
- `state` 以字符串形式存储，读取时 as 为 `VideoProject.State`

## Migration

代码位置：`packages/creator-helix/src/persistence/migrate.ts`

CreatorHelix 采用自管 migration：启动时调用 `Migration.run`，执行 `CREATE TABLE IF NOT EXISTS` 语句。不侵入 `packages/core` 的 migration 系统。

## 关键 JSON 结构示例

### creator_helix_project.context

```json
{
  "requirement": {
    "topic": "新品手机发布",
    "durationSeconds": 30,
    "style": "科技感、快节奏",
    "targetAudience": "年轻男性",
    "referenceUrls": ["..."]
  },
  "script": {
    "title": "新品发布",
    "summary": "展示核心卖点",
    "totalDurationSeconds": 30,
    "narration": "这是新一代..."
  },
  "storyboard": {
    "shots": [
      {
        "id": "shot-1",
        "sequence": 1,
        "description": "产品全景",
        "visualPrompt": "futuristic product shot",
        "motionPrompt": "slow rotate",
        "narration": "这是新品",
        "durationSeconds": 5
      }
    ]
  },
  "assets": [],
  "pausedFrom": "STORYBOARD_REVIEW",
  "error": null
}
```

## 扩展建议

1. **向量检索**：产品化后迁移到 PostgreSQL + pgvector，存储风格、素材、参考案例的 embedding。
2. **对象存储**：视频/图片等大文件存 S3 / OSS，`assets.url` 指向对象存储地址。
3. **审批记录**：后续可新增 `creator_helix_review` 表保存人工审批历史。
4. **用户偏好**：后续可新增 `creator_helix_user_preference` 表保存长期记忆。
