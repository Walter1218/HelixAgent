# HelixAgent 能力集成开发计划

> 版本: 1.3
> 创建日期: 2026-07-01
> 最后更新: 2026-07-02
> 目标: 将未实现/未集成的能力完成开发并接入主链路

---

## 一、总体概览

### 1.1 开发阶段

| 阶段 | 内容 | 工时 | 优先级 | 依赖 | 状态 |
|------|------|------|--------|------|------|
| **TUI 外化** | Token/Mode/Goal 指示器 + Task/Actor 面板 | 3-4 天 | P0 | 底层 API | ✅ 已完成 |
| **阶段一** | Memory Vector Store 启用 | 1-2 天 | P0 | Config.Service | ✅ 已完成 |
| **阶段二** | History Service | 2-3 天 | P0 | Database.Service | ✅ 已完成 |
| **阶段三** | Inbox + Distill Agent | 3 天 | P1 | 无 | ✅ 已完成 |
| **阶段四** | Judge + Max 模式 | 3-4 天 | P1 | 无 | ✅ 已完成 |
| **暂缓** | Shadow Worktree | - | P3 | 无明确动机 | 暂缓 |
| **暂缓** | Auto-Dev Scheduler | - | P3 | 外部依赖 | 暂缓 |

**总计**: 9-12 天（不含已完成的 TUI 外化）

### 1.2 能力状态矩阵

| 能力 | 当前状态 | 目标状态 | 阶段 | 状态 |
|------|---------|---------|------|------|
| TUI 外化 | 已完成 Token/Mode/Goal/Task/Actor | 完全可用 | TUI | ✅ 已完成 |
| Memory Vector Store | 已实现 FTS + Vector 混合检索，默认启用 | 完全可用 | 一 | ✅ 已完成 |
| History Service | 已实现 FTS 搜索，默认启用 | 完全可用 | 二 | ✅ 已完成 |
| Inbox 系统 | 已实现 send/list/markRead/markAllRead | 完全可用 | 三 | ✅ 已完成 |
| Distill Agent | 已实现 shouldAutoDistill + 独立 agent | 完全可用 | 三 | ✅ 已完成 |
| Judge System | 已实现 8 项启发式检查 | 完全可用 | 四 | ✅ 已完成 |
| Max 模式 | 已实现候选生成 + Judge 评估 | 完全可用 | 四 | ✅ 已完成 |
| Shadow Worktree | 纯函数实现，未转 Effect Service | 暂缓 | - | 暂缓 |
| Auto-Dev Scheduler | 未实现 | 暂缓 | - | 暂缓 |

---

## 二、阶段一：Memory Vector Store 启用

### 2.1 目标

通过配置开启向量检索，使用本地 LM Studio 的 embedding 模型，实现 FTS + Vector 混合检索。

### 2.2 当前代码现状

**已有实现**:
- `packages/core/src/memory/embedder.ts` (56 行) - Embedder 类，支持 HTTP embedding API 调用
- `packages/core/src/memory/vec-store.ts` (44 行) - VecStore 类，**骨架实现**，search() 返回空数组
- `packages/core/src/memory/service.ts` (180 行) - Memory.Service，仅 FTS 搜索
- `packages/core/src/memory/semantic-hash.ts` - 内容哈希
- `packages/core/src/memory/fts-query.ts` - FTS 查询构建

**关键问题**:
1. `VecStore` 构造函数只接受 `Embedder`，不接受 `db`
2. `VecStore.indexOne/indexMany` 只调用 embed() 但不存储结果
3. `VecStore.search` 返回空数组 `[]`
4. `Memory.Service` 没有 Config 依赖，无法读取 embedding 配置
5. `memory_vec` 表未创建（schema 定义存在但无迁移）

### 2.3 配置方案

```jsonc
// opencode.jsonc
{
  "memory": {
    "embedding": {
      "enabled": true,
      "baseUrl": "http://localhost:1234/v1/embeddings",
      "model": "text-embedding-nomic-embed-text-v1.5"
    }
  }
}
```

**配置项说明**:

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 是否启用向量检索 |
| `baseUrl` | string | `http://localhost:1234/v1/embeddings` | LM Studio embedding API 地址 |
| `model` | string | `text-embedding-nomic-embed-text-v1.5` | embedding 模型名称 |

**实现方式**: 在 `packages/core/src/v1/config/config.ts` 的 `ConfigV1.Info` 中添加：

```typescript
memory: Schema.optional(Schema.Struct({
  embedding: Schema.optional(Schema.Struct({
    enabled: Schema.optional(Schema.Boolean),
    baseUrl: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
  })),
})),
```

### 2.4 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/v1/config/config.ts` | 修改 | 添加 memory 配置 schema |
| `packages/core/src/database/migration/20260701_add_memory_vec.ts` | 新建 | memory_vec 表迁移 |
| `packages/core/src/database/schema.gen.ts` | 修改 | 添加 memory_vec 表定义 |
| `packages/core/src/memory/vec-store.ts` | 重写 | 添加 db 参数，实现实际存储/检索 |
| `packages/core/src/memory/service.ts` | 修改 | 添加 Config 依赖，集成 VecStore，混合排序 |
| `packages/opencode/test/memory/vec-store.test.ts` | 新建 | 单元测试 |
| `packages/opencode/test/memory/hybrid-search.test.ts` | 新建 | 集成测试 |

### 2.5 数据库设计

```sql
-- memory_vec 表：存储向量嵌入
CREATE TABLE memory_vec (
  memory_path TEXT PRIMARY KEY,        -- 对应 memory_fts.path
  embedding   BLOB NOT NULL,           -- float32[] 序列化
  hash        TEXT NOT NULL,            -- 内容哈希（用于增量更新）
  dimension   INTEGER NOT NULL DEFAULT 768,  -- 向量维度
  updated_at  INTEGER NOT NULL         -- unix timestamp
);

CREATE INDEX idx_memory_vec_hash ON memory_vec(hash);
```

### 2.6 核心算法：混合检索

#### 算法流程

```
用户 query
    │
    ├──→ FTS 搜索 ──→ BM25 排序 ──→ top-K_FTS (带 rank)
    │
    └──→ Vector 搜索 ──→ cosine 排序 ──→ top-K_VEC (带 cosine_score)
            │
            ▼
        结果合并
            │
    ┌───────┴───────┐
    │  对每个结果:   │
    │  1. 排名归一化  │
    │  2. 加权求和    │
    │  3. 共存项 boost│
    └───────┬───────┘
            │
            ▼
        最终排序 ──→ 返回 top-N
```

#### 分数计算

```typescript
// 权重配置
const FTS_WEIGHT = 0.6
const VEC_WEIGHT = 0.4
const CO_OCCURRENCE_BOOST = 1.3

// 融合计算
function mergeScores(
  ftsResults: Array<{ path: string; snippet: string; scope: string; scope_id: string; type: string }>,
  vecResults: VecSearchRow[],
  limit: number
): Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }> {
  // 排名归一化（FTS5 rank 是负数，越小越好）
  const ftsRankMap = new Map(
    ftsResults.map((r, i) => [r.path, 1 - i / Math.max(ftsResults.length, 1)])
  )

  // Vec 分数归一化（cosine 范围 [-1, 1] -> [0, 1]）
  const vecMax = Math.max(...vecResults.map(r => r.score), 0.001)
  const vecNormMap = new Map(
    vecResults.map(r => [r.memory_path, (r.score + 1) / 2])  // cosine -> [0, 1]
  )

  // 合并所有 path
  const allPaths = new Set([...ftsRankMap.keys(), ...vecNormMap.keys()])

  // 构建 snippet 映射
  const snippetMap = new Map(ftsResults.map(r => [r.path, r.snippet]))
  const metaMap = new Map(ftsResults.map(r => [r.path, r]))

  // 计算融合分数
  const merged = [...allPaths].map(path => {
    const fts = ftsRankMap.get(path) ?? 0
    const vec = vecNormMap.get(path) ?? 0
    const base = fts * FTS_WEIGHT + vec * VEC_WEIGHT
    const boost = (fts > 0 && vec > 0) ? CO_OCCURRENCE_BOOST : 1.0
    const meta = metaMap.get(path)
    return {
      path,
      snippet: snippetMap.get(path) ?? "",
      score: base * boost,
      scope: meta?.scope ?? "",
      scope_id: meta?.scope_id ?? "",
      type: meta?.type ?? "",
    }
  })

  return merged.sort((a, b) => b.score - a.score).slice(0, limit)
}
```

#### 权重选择理由

| 场景 | FTS 更优 | Vector 更优 |
|------|---------|------------|
| 精确关键词匹配 | ✅ | |
| 同义词/语义相似 | | ✅ |
| 代码/技术术语 | ✅ | |
| 自然语言描述 | | ✅ |

**0.6 FTS 偏重**：记忆文件多为技术文档，关键词匹配更重要。Vector 作为补充，捕获语义相近但措辞不同的情况。

### 2.7 VecStore 实现

```typescript
// packages/core/src/memory/vec-store.ts

import { Embedder } from "./embedder"
import { Database } from "../database/database"
import { hashContent } from "./semantic-hash"
import { sql } from "drizzle-orm"

export interface VecSearchRow {
  memory_path: string
  score: number
}

export class VecStore {
  constructor(
    private embedder: Embedder,
    private db: Database.Service
  ) {}

  get isEmbeddingEnabled(): boolean {
    return this.embedder.enabled
  }

  async indexOne(memoryPath: string, body: string): Promise<void> {
    if (!this.embedder.enabled) return

    const hash = hashContent(body)
    const existing = await this.db.all<{ hash: string }>(
      sql`SELECT hash FROM memory_vec WHERE memory_path = ${memoryPath}`
    )

    // 增量更新：内容未变化则跳过
    if (existing[0]?.hash === hash) return

    const embedding = await this.embedder.embed(body.slice(0, 8000))
    const blob = Buffer.from(new Float32Array(embedding).buffer)

    await this.db.run(sql`
      INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
      VALUES (${memoryPath}, ${blob}, ${hash}, ${embedding.length}, ${Date.now()})
    `)
  }

  async indexMany(items: Array<{ memoryPath: string; body: string }>): Promise<void> {
    if (!this.embedder.enabled || items.length === 0) return

    // 批量 embedding
    const bodies = items.map(i => i.body.slice(0, 8000))
    const embeddings = await this.embedder.embedBatch(bodies)

    // 批量写入
    for (let i = 0; i < items.length; i++) {
      const hash = hashContent(items[i].body)
      const blob = Buffer.from(new Float32Array(embeddings[i]).buffer)
      await this.db.run(sql`
        INSERT OR REPLACE INTO memory_vec (memory_path, embedding, hash, dimension, updated_at)
        VALUES (${items[i].memoryPath}, ${blob}, ${hash}, ${embeddings[i].length}, ${Date.now()})
      `)
    }
  }

  async search(queryText: string, limit = 10): Promise<VecSearchRow[]> {
    if (!this.embedder.enabled) return []

    // 查询向量化
    const queryVec = await this.embedder.embed(queryText)

    // 加载所有向量（内存计算，适合小规模数据 < 10000 条）
    const rows = await this.db.all<{ memory_path: string; embedding: Buffer }>(
      sql`SELECT memory_path, embedding FROM memory_vec`
    )

    // 计算 cosine 相似度
    const scores = rows.map(row => {
      const vec = new Float32Array(row.embedding.buffer)
      const score = Embedder.cosine(queryVec, Array.from(vec))
      return { memory_path: row.memory_path, score }
    })

    // 排序返回 top-K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
```

### 2.8 Memory.Service 集成

```typescript
// packages/core/src/memory/service.ts (关键改动)

import { Config } from "../config"  // 新增

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const globalPaths = yield* Global.Service
    const config = yield* Config.Service  // 新增

    // 读取 embedding 配置
    const cfg = yield* config.get()
    const memCfg = cfg.memory?.embedding
    const embedder = new Embedder({
      enabled: memCfg?.enabled ?? false,
      baseUrl: memCfg?.baseUrl ?? "http://localhost:1234/v1/embeddings",
      model: memCfg?.model ?? "text-embedding-nomic-embed-text-v1.5",
    })
    const vecStore = new VecStore(embedder, db)  // 传入 db

    const reconcile = Effect.fn("Memory.reconcile")(function* () {
      // ... 现有 FTS reconcile 逻辑 ...

      // 新增：向量索引
      if (vecStore.isEmbeddingEnabled) {
        const vecItems = [...paths].map(absPath => ({
          memoryPath: absPath,
          body: fs.readFileSync(absPath, "utf8"),
        }))
        yield* Effect.promise(() => vecStore.indexMany(vecItems))
      }

      return { indexed: totalIndexed, pruned }
    })

    const search = Effect.fn("Memory.search")(function* (input) {
      const limit = input.limit ?? 10
      const topK = limit * 2  // 候选池放大

      // FTS 搜索
      const ftsResults = yield* ftsSearch(input, topK)

      // Vector 搜索（如果启用）
      let vecResults: VecSearchRow[] = []
      if (vecStore.isEmbeddingEnabled) {
        vecResults = yield* Effect.promise(() =>
          vecStore.search(input.query, topK)
        )
      }

      // 混合排序
      if (vecResults.length === 0) {
        return ftsResults.slice(0, limit)
      }

      return mergeScores(ftsResults, vecResults, limit)
    })

    return Service.of({ reconcile, search })
  }),
)

// 更新 defaultLayer 添加 Config 依赖
export const defaultLayer = layer.pipe(
  Layer.provide(Database.defaultLayer),
  Layer.provide(Global.defaultLayer),
  Layer.provide(Config.defaultLayer),  // 新增
)

// 更新 node deps
export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [Database.node, Global.node, Config.node]  // 新增 Config.node
})
```

### 2.9 验收标准

#### 单元测试

```typescript
// test/memory/vec-store.test.ts
describe("VecStore", () => {
  it("should store and retrieve embeddings", async () => {
    await vecStore.indexOne("/test/path.md", "Hello world")
    const results = await vecStore.search("greeting", 5)
    expect(results).toContainEqual(
      expect.objectContaining({ memory_path: "/test/path.md" })
    )
  })

  it("should skip re-indexing unchanged content", async () => {
    await vecStore.indexOne("/test/path.md", "Hello world")
    const spy = vi.spyOn(embedder, "embed")
    await vecStore.indexOne("/test/path.md", "Hello world")
    expect(spy).not.toHaveBeenCalled()
  })
})
```

#### 集成测试

```typescript
// test/memory/hybrid-search.test.ts
describe("Hybrid Search", () => {
  it("should boost co-occurring results", async () => {
    await writeFile("/memory/test.md", "Use REST conventions for APIs")
    await memoryService.reconcile()

    const results = await memoryService.search({
      query: "HTTP endpoint naming",
      limit: 5,
    })

    expect(results[0].path).toContain("test.md")
    expect(results[0].score).toBeGreaterThan(0)
  })
})
```

#### 手动验收

```bash
# 1. 启动 LM Studio，加载 embedding 模型
# 2. 配置 opencode.jsonc
# 3. 启动 opencode
bun dev

# 4. 在对话中测试
# 用户: "Search memory for API design rules"
# 验证: 返回包含 "REST conventions" 的结果
```

---

## 三、阶段二：History Service

### 3.1 目标

实现跨会话历史搜索，支持 FTS5 全文检索。

### 3.2 当前代码现状

**已有实现**:
- `packages/opencode/src/history/schema.ts` (47 行) - 完整的接口定义
- `packages/opencode/src/history/index.ts` (3 行) - barrel exports
- `packages/opencode/src/tool/history.ts` - history 工具实现

**关键问题**:
1. 没有 `service.ts` - 无 Effect Service 实现
2. 没有 `fts.sql.ts` - 无 FTS5 schema
3. 没有数据库表 - 无 history_fts 迁移
4. 没有消息写入 - processor.ts 未调用 ingest

### 3.3 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/history/service.ts` | 新建 | Effect Service 实现 |
| `packages/opencode/src/history/fts.sql.ts` | 新建 | FTS5 schema |
| `packages/core/src/database/migration/20260701_add_history_fts.ts` | 新建 | history_fts 表迁移 |
| `packages/core/src/database/schema.gen.ts` | 修改 | 添加 history_fts 表定义 |
| `packages/opencode/src/session/processor.ts` | 修改 | tool-result 后写入 history |
| `packages/opencode/src/effect/app-runtime.ts` | 修改 | 注册 History.Service |

**注意**: `schema.ts` 和 `index.ts` 已有完整定义，不需要修改。

### 3.4 数据库设计

```sql
-- history_fts 表：存储消息历史
CREATE VIRTUAL TABLE history_fts USING fts5(
  message_id,        -- 关联 session_message.id
  session_id,        -- 所属会话
  part_id,           -- 消息 part ID
  kind,              -- 消息类型
  tool_name,         -- 工具名称
  content,           -- 消息内容
  time_created,      -- 创建时间
  tokenize='porter unicode61'
);

-- 普通索引表（用于精确查询）
CREATE TABLE history_meta (
  message_id   TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  part_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  tool_name    TEXT,
  time_created INTEGER NOT NULL
);

CREATE INDEX idx_history_meta_session ON history_meta(session_id);
CREATE INDEX idx_history_meta_kind ON history_meta(kind);
CREATE INDEX idx_history_meta_time ON history_meta(time_created);
```

### 3.5 History.Service 实现

```typescript
// packages/opencode/src/history/service.ts

import { Context, Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { sql } from "drizzle-orm"
import type { SearchHit, MessageContext, HistorySearchInput, HistoryAroundInput, HistoryKind } from "./schema"

export interface Interface {
  readonly search: (input: HistorySearchInput) => Effect.Effect<SearchHit[]>
  readonly around: (input: HistoryAroundInput) => Effect.Effect<MessageContext[]>
  readonly ingest: (message: {
    message_id: string
    session_id: string
    part_id: string
    kind: HistoryKind
    tool_name?: string
    content: string
    time_created: number
  }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/History") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const ingest = Effect.fn("History.ingest")(function* (message) {
      // 写入 FTS
      yield* db.run(sql`
        INSERT OR REPLACE INTO history_fts (message_id, session_id, part_id, kind, tool_name, content, time_created)
        VALUES (${message.message_id}, ${message.session_id}, ${message.part_id}, ${message.kind}, ${message.tool_name ?? null}, ${message.content}, ${message.time_created})
      `).pipe(Effect.orDie)

      // 写入 meta
      yield* db.run(sql`
        INSERT OR REPLACE INTO history_meta (message_id, session_id, part_id, kind, tool_name, time_created)
        VALUES (${message.message_id}, ${message.session_id}, ${message.part_id}, ${message.kind}, ${message.tool_name ?? null}, ${message.time_created})
      `).pipe(Effect.orDie)
    })

    const search = Effect.fn("History.search")(function* (input) {
      // 构建查询...
      // 返回 SearchHit[]
    })

    const around = Effect.fn("History.around")(function* (input) {
      // 获取上下文...
      // 返回 MessageContext[]
    })

    return Service.of({ ingest, search, around })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
```

### 3.6 消息写入集成

在 `processor.ts` 的 `tool-result` 处写入 history：

```typescript
// packages/opencode/src/session/processor.ts

// 依赖注入添加
const history = yield* History.Service

// case "tool-result" 处（约 line 496 之后）
yield* history.ingest({
  message_id: ctx.assistantMessage.id,
  session_id: ctx.sessionID,
  part_id: value.id,
  kind: "tool_output",
  tool_name: value.name,
  content: output.output,
  time_created: Date.now(),
}).pipe(Effect.ignore)  // 不阻塞主流程
```

### 3.7 验收标准

```typescript
// test/history/service.test.ts
describe("History Service", () => {
  it("should ingest and search messages", async () => {
    await history.ingest({
      message_id: "msg-1",
      session_id: "session-1",
      part_id: "part-1",
      kind: "user_text",
      content: "Implement OAuth2 authentication",
      time_created: Date.now(),
    })

    const results = await history.search({ query: "OAuth2" })
    expect(results).toHaveLength(1)
    expect(results[0].snippet).toContain("OAuth2")
  })
})
```

---

## 四、阶段三：Inbox + Distill Agent

### 4.1 Inbox 系统

#### 当前状态

**完全未实现** - 无目录、无文件、无引用。

#### 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/inbox/inbox.sql.ts` | 新建 | inbox 表 schema |
| `packages/opencode/src/inbox/inbox.ts` | 新建 | Inbox Service |
| `packages/opencode/src/inbox/inbox-ref.ts` | 新建 | late-bound 引用 |
| `packages/opencode/src/inbox/render.ts` | 新建 | 消息渲染 |
| `packages/opencode/src/inbox/index.ts` | 新建 | barrel exports |
| `packages/core/src/database/migration/20260701_add_inbox.ts` | 新建 | inbox 表迁移 |
| `packages/opencode/src/observability/alignment-guard.ts` | 修改 | 接入 inbox 发送 |
| `packages/opencode/src/effect/app-runtime.ts` | 修改 | 注册 Inbox.Service |

#### 数据库设计

```sql
CREATE TABLE inbox (
  id               TEXT PRIMARY KEY,
  receiver_session TEXT NOT NULL,
  receiver_actor   TEXT NOT NULL,
  sender_actor     TEXT NOT NULL,
  content          TEXT NOT NULL,
  type             TEXT NOT NULL,
  read             INTEGER NOT NULL DEFAULT 0,
  time_created     INTEGER NOT NULL
);

CREATE INDEX idx_inbox_receiver ON inbox(receiver_session, receiver_actor);
CREATE INDEX idx_inbox_unread ON inbox(receiver_session, read);
```

### 4.2 Distill Agent

#### 当前状态

- `packages/opencode/src/session/auto-dream.ts` 已有 `DISTILL_TASK` prompt
- `shouldAutoDistill()` 函数已实现
- **缺少**: 独立的 `distill.txt` prompt 文件
- **缺少**: agent.ts 中注册 distill agent

#### 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/agent/prompt/distill.txt` | 新建 | Distill agent prompt |
| `packages/opencode/src/agent/agent.ts` | 修改 | 注册 distill agent |
| `packages/opencode/src/agent/system-agents.ts` | 新建 | 系统 agent 集合 |

#### Distill Agent Prompt 结构

```markdown
# Distill Agent

You are a workflow distillation agent. Your job is to:
1. Review past sessions and identify repeated manual workflows
2. Package high-confidence patterns into reusable assets

## Workflow

### Phase 1: Locate Data
- Read SQLite database for session history
- Read memory files for cross-session patterns

### Phase 2: Inventory Existing Assets
- Glob `.opencode/skills/*/SKILL.md`
- Glob `.opencode/agents/*.md`
- Glob `.opencode/commands/*.md`

### Phase 3: Discover Repeated Workflows
- Query: `SELECT tool_name, input_preview, count(*) FROM ... GROUP BY ... HAVING count > 3`

### Phase 4: Produce Shortlist
- Sort by frequency and confidence
- Filter out already-covered patterns

### Phase 5: Create Missing Assets
- For each high-confidence pattern:
  - If skill missing → create `.opencode/skills/{name}/SKILL.md`
  - If agent missing → create `.opencode/agents/{name}.md`
  - If command missing → create `.opencode/commands/{name}.md`

## Output Format

**Status**: success | partial | failed
**Summary**: <one sentence>
**Assets created**: <list or "(none)">
**Files touched**: <paths>
```

### 4.3 验收标准

```typescript
// test/inbox/inbox.test.ts
describe("Inbox", () => {
  it("should send and receive messages", async () => {
    await inbox.send({
      receiverSessionID: "session-1",
      receiverActorID: "actor-1",
      senderActorID: "alignment-guard",
      content: "<alignment-guard>Rabbit hole detected</alignment-guard>",
      type: "actor_notification",
    })

    const messages = await inbox.list("session-1")
    expect(messages).toHaveLength(1)
  })
})
```

---

## 五、阶段四：Judge + Max 模式

### 5.1 Judge System

#### 当前状态

- `packages/opencode/src/agent/system-agents.ts` 中只有 "judge" 类型标记
- 无独立的 `judge-agent.ts` 实现

#### 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/opencode/src/agent/judge-agent.ts` | 新建 | 启发式 Judge |
| `packages/opencode/src/session/max-mode.ts` | 新建 | Max 模式实现 |
| `packages/opencode/src/session/candidate-scorer.ts` | 新建 | 候选评分 |
| `packages/opencode/src/session/mode-registry.ts` | 修改 | 注册 max 模式 |
| `packages/opencode/src/session/prompt.ts` | 修改 | 添加 max 模式判断 |
| `packages/opencode/src/config/mode.ts` | 新建 | 模式配置 schema |

#### Judge 8 项检查

| # | 检查项 | 触发条件 | 决策 |
|---|--------|---------|------|
| 1 | 断言减少 | expect/assert 行数减少 > 30% | reject |
| 2 | 结构性变更 | 删除 test/it/describe 块 | reject |
| 3 | 琐碎化 | `.toBe(x)` → `.toBeTruthy()` | reject |
| 4 | 安全 | eval/exec/key 泄露 | reject |
| 5 | 回归风险 | DROP TABLE/TRUNCATE/移除 export | reject |
| 6 | 一致性 | camelCase/snake_case 混用 | warn |
| 7 | 规格对齐 | 变更是否符合 spec | evaluate |
| 8 | 声明门控 | "我修好了" 但无功能验证 | reject |

### 5.2 Max 模式

#### 核心流程

```
用户输入
    │
    ▼
prompt.ts runLoop 检测 agent === "max"
    │
    ▼
调用 maxMode.runMaxStep() 替代 processor.process()
    │
    ▼
生成 N 个候选（并行 LLM 调用）
    │
    ├──→ Candidate 1: reasoning + text + tool_calls
    ├──→ Candidate 2: reasoning + text + tool_calls
    ├──→ ...
    └──→ Candidate N: reasoning + text + tool_calls
    │
    ▼
Judge 评估所有候选
    │
    ▼
选择获胜者 → 执行其 tool_calls
```

#### 集成点

在 `packages/opencode/src/session/prompt.ts` 的 `runLoop` 中：

```typescript
// 判断是否为 max 模式
const agent = yield* agents.get(lastUser.agent)
if (agent.name === "max") {
  const maxMode = yield* MaxMode.Service
  const result = yield* maxMode.runMaxStep({
    sessionID,
    messages: msgs,
    model: mdl,
    tools: toolList,
  })
  // 处理 result...
} else {
  // 默认处理...
}
```

#### 候选评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| Judge 批准 | 40% | LLM Judge 评估 |
| 文件数 | 20% | 越少越好 |
| 测试通过率 | 30% | 运行测试结果 |
| 风格一致性 | 10% | 与代码库风格匹配 |

### 5.3 验收标准

```typescript
// test/judge/judge-agent.test.ts
describe("Judge Agent", () => {
  it("should reject code with reduced assertions", async () => {
    const diff = `
- expect(1 + 1).toBe(2)
- expect(2 + 2).toBe(4)
- expect(3 + 3).toBe(6)
+ expect(result).toBeTruthy()
`
    const verdict = await judgeAgent.evaluate(diff)
    expect(verdict.action).toBe("reject")
    expect(verdict.reason).toContain("assertion reduction")
  })
})
```

---

## 六、暂缓项

### 6.1 Shadow Worktree

**暂缓原因**: 无明确集成动机，纯 Git 操作可用 shell 工具替代。

**当前状态**: `packages/opencode/src/shadow-worktree/` 有纯函数实现 (239 行)，但：
- 未转 Effect Service
- 未注册到 app-runtime.ts
- 无生产消费者

**如果需要实现**:
- 工作量: 2-3 天
- 主要工作: 转 Effect Service + 替换 exec 为 ChildProcessSpawner + 修复 shell 注入
- 关键依赖: ChildProcessSpawner, FileSystem, InstanceState

### 6.2 Auto-Dev Scheduler

**暂缓原因**: P3 优先级，需要外部流水线配合，当前非核心。

**当前状态**: 完全未实现，`script/auto-dev/` 目录不存在。

**如果需要实现**:
- 工作量: 2-3 天
- 主要工作: scheduler.ts, pipeline.ts, roadmap.ts, notify.ts
- 关键依赖: Phase 4 Evolution Flywheel

---

## 七、验收检查清单

### 7.1 每阶段通用验收

```bash
# 1. 类型检查
cd packages/opencode && bun typecheck

# 2. 单元测试
bun test test/<module>/

# 3. 集成测试
bun test test/<module>/integration/

# 4. 主链路调用验证
rg -n "yield\* <Service>\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts
```

### 7.2 阶段一验收

| 检查项 | 验收标准 | 命令 |
|--------|----------|------|
| VecStore 存储 | indexOne 写入 memory_vec | `bun test test/memory/vec-store.test.ts` |
| VecStore 检索 | search 返回 cosine 排序结果 | `bun test test/memory/vec-store.test.ts` |
| 混合排序 | FTS + Vector 结果正确融合 | `bun test test/memory/hybrid-search.test.ts` |
| 配置生效 | embedding.enabled 控制开关 | 手动验证 |
| 降级行为 | LM Studio 不可用时 FTS 仍工作 | 手动验证 |

### 7.3 阶段二验收

| 检查项 | 验收标准 | 命令 |
|--------|----------|------|
| 消息写入 | processor.ts 写入 history_fts | `rg -n "history.ingest" src/session/processor.ts` |
| 搜索功能 | search 返回相关结果 | `bun test test/history/service.test.ts` |
| 过滤功能 | kind/time/session 过滤正确 | `bun test test/history/service.test.ts` |

### 7.4 阶段三验收

| 检查项 | 验收标准 | 命令 |
|--------|----------|------|
| Inbox 收发 | send/list 正常工作 | `bun test test/inbox/inbox.test.ts` |
| AlignmentGuard 接入 | 偏离检测发送 inbox | `rg -n "inbox.send" src/observability/alignment-guard.ts` |
| Distill Agent | agent 注册可用 | `rg -n "distill" src/agent/agent.ts` |

### 7.5 阶段四验收

| 检查项 | 验收标准 | 命令 |
|--------|----------|------|
| Judge 启发式 | 8 项检查正确触发 | `bun test test/judge/judge-agent.test.ts` |
| Max 模式 | 5 个候选 + Judge 选择 | `bun test test/e2e/max-mode-e2e.test.ts` |
| prompt.ts 集成 | max 模式判断正确 | `rg -n "max" src/session/prompt.ts` |

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LM Studio 未启动 | 向量检索不可用 | Embedder 降级返回零向量，FTS 仍可用 |
| embedding API 延迟高 | 搜索变慢 | 批量 embedding + 缓存 |
| memory_vec 表过大 | 内存计算慢 | 限制向量数量，定期清理过期数据 |
| History 写入影响性能 | 主链路变慢 | 异步写入，Effect.ignore 不阻塞 |
| Judge 误判 | 阻止正常操作 | 仅 warn 级别不阻断，用户可覆盖 |
| Max 模式成本增加 | LLM 调用 5 倍 | 可配置 candidates 数量，默认 5 个 |

---

## 九、配置示例

```jsonc
// opencode.jsonc
{
  "memory": {
    "embedding": {
      "enabled": true,
      "baseUrl": "http://localhost:1234/v1/embeddings",
      "model": "text-embedding-nomic-embed-text-v1.5"
    }
  },
  "modes": {
    "max": {
      "enabled": true,
      "candidates": 5
    }
  },
  "distill": {
    "auto": true,
    "interval_days": 30
  },
  "dream": {
    "auto": true,
    "interval_days": 7
  }
}
```

---

## 十、文件清单汇总

### 新建文件 (17)

```
# 阶段一
packages/core/src/database/migration/20260701_add_memory_vec.ts
packages/opencode/test/memory/vec-store.test.ts
packages/opencode/test/memory/hybrid-search.test.ts

# 阶段二
packages/opencode/src/history/service.ts
packages/opencode/src/history/fts.sql.ts
packages/core/src/database/migration/20260701_add_history_fts.ts
packages/opencode/test/history/service.test.ts

# 阶段三
packages/opencode/src/inbox/inbox.sql.ts
packages/opencode/src/inbox/inbox.ts
packages/opencode/src/inbox/inbox-ref.ts
packages/opencode/src/inbox/render.ts
packages/opencode/src/inbox/index.ts
packages/core/src/database/migration/20260701_add_inbox.ts
packages/opencode/src/agent/prompt/distill.txt
packages/opencode/src/agent/system-agents.ts

# 阶段四
packages/opencode/src/agent/judge-agent.ts
packages/opencode/src/session/max-mode.ts
packages/opencode/src/session/candidate-scorer.ts
packages/opencode/src/config/mode.ts
```

### 修改文件 (10)

```
packages/core/src/v1/config/config.ts              # 添加 memory 配置 schema
packages/core/src/memory/vec-store.ts               # 添加 db 参数，实现存储/检索
packages/core/src/memory/service.ts                 # 添加 Config 依赖 + 混合检索
packages/core/src/database/schema.gen.ts            # 添加 memory_vec/history_fts/inbox 表
packages/opencode/src/session/processor.ts          # 添加 history 写入
packages/opencode/src/session/prompt.ts             # 添加 max 模式判断
packages/opencode/src/agent/agent.ts                # 注册 distill agent
packages/opencode/src/observability/alignment-guard.ts  # 接入 inbox
packages/opencode/src/effect/app-runtime.ts         # 注册新 Service
packages/opencode/src/session/mode-registry.ts      # 注册 max 模式
```

---

*本文档基于 2026-07-01 代码审查，如有架构更新需同步更新。*
