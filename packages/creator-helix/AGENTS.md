# CreatorHelix 开发指南

## 产品定位

CreatorHelix 是**通用视频编排生成智能体**——基于知识图谱驱动 LLM 创意决策，生成高质量 prompt 驱动下游视频模型产出最终视频。

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                     API Layer (Hono)                              │
│  /api/creator-helix/v2/studios    → Studio CRUD                  │
│  /api/creator-helix/v2/projects   → Project CRUD + Generate      │
│  /api/creator-helix/v2/tasks      → Task status query            │
├──────────────────────────────────────────────────────────────────┤
│                     V2 Pipeline (主链路)                          │
│  full-pipeline.ts                                                 │
│    ├── LlmDecisions.decideGlobalStyle()  → LLM 全局风格决策      │
│    ├── LlmDecisions.decideShotBatch()    → LLM 逐镜头创意决策    │
│    ├── PromptBuilder.buildShotPrompt()   → 上下文感知 prompt 组装 │
│    └── SeedDanceClient.generateVideo()   → SeedDance 视频生成     │
├──────────────────────────────────────────────────────────────────┤
│                     Data Layer                                    │
│  StudioRepository / ProjectRepository / AssetTaskRepository       │
│  Drizzle ORM: StudioTable / KnowledgeProjectTable / AssetTaskTable│
├──────────────────────────────────────────────────────────────────┤
│                     Shared Services                               │
│  llm/longcat.ts (LLM) / services/seeddance-client.ts (视频生成)  │
│  v2/config/index.ts (集中配置)                                    │
└──────────────────────────────────────────────────────────────────┘
```

## 数据模型：四层架构

### Studio（全局资产库）

跨项目共享，确保实体一致性。

```
Studio
├── Characters[]          // 角色库
│   ├── baseIdentity      // 姓名/性别/种族/辨识特征
│   ├── stateTimeline[]   // 年龄/造型/状态随时间变化
│   │   ├── appearance    // 面部/头发/眼睛/体型/服装
│   │   ├── portrait      // 标准肖像图
│   │   └── relations     // 当前状态下的角色关系
│   └── expressionSheet   // 表情库
├── Locations[]           // 场景库
│   ├── baseDefinition    // 名称/类型/建筑/地理/规模
│   └── stateTimeline[]   // 不同时期的状态
│       ├── atmosphere    // 时间/天气/光照
│       └── conceptImage  // 场景概念图
├── Props[]               // 道具库
├── StylePresets[]        // 视觉风格预设
├── WorldRules[]          // 世界观规则
└── CrowdPresets[]        // 群演预设
```

### Project（项目）

```
Project
├── meta { title, logline, theme, targetDuration }
├── stylePresetId → StylePreset
├── worldRules[] → WorldRule[]
└── scripts[]
    ├── characterUsages[] → Character (可覆盖全局属性)
    ├── locationUsages[] → Location
    ├── propUsages[] → Prop
    └── sequences[]
        ├── narrativeBeat { setup, conflict, climax, resolution }
        ├── dialogue[]
        └── shots[]
            ├── camera { type, framing, angle, movementSpeed, lens }
            ├── subjects[] → Character
            ├── references { characters[], location, props[] }
            ├── continuity { eyelineMatch, costumeState, ... }
            └── prompt { subjectDesc, visualDesc, ... }
```

## V2 主链路（默认）

### 创意决策（LLM 驱动）

| 决策项 | 旧 V1（关键词匹配） | 新 V2（LLM 驱动） |
|---|---|---|
| 模板选择 | 6 个 if/else 分支 | LLM 分析叙事功能 + 模板目录 |
| 情绪推导 | 4 个关键词检查 | LLM 从剧本上下文推断 |
| 色调 | `includes("cold")` | LLM 生成 hex palette |
| 灯光 | 统一 `high-contrast-key` | LLM 根据场景描述生成 |
| 后处理 | 永远 `bloom-vignette` | LLM 根据情绪选择效果 |
| 画质 | 永远 `8K film grain` | 5 种 tier 跟随情绪变化 |

### 配置管理

所有配置集中在 `v2/config/index.ts`，通过 Effect Config 读取环境变量：

```typescript
// 示例
export const LlmModelId = Config.string("LONGCAT_MODEL").pipe(Config.withDefault("LongCat-2.0"))
export const SeedDanceApiKey = Config.redacted("SEEDANCE_API_KEY")
export const RenderWidth = Config.integer("RENDER_WIDTH").pipe(Config.withDefault(1920))
```

### 画质层级

```typescript
QualityTiers = {
  cinematic: "photorealistic, 8K, film grain, volumetric lighting, ...",
  moody: "atmospheric, cinematic color grading, soft shadows, ...",
  minimal: "clean, sharp focus, natural lighting, ...",
  epic: "epic scale, dramatic lighting, 8K detail, volumetric fog, ...",
  chaotic: "dynamic motion blur, high contrast, gritty texture, ...",
}
```

### API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/v2/studios` | 创建工作室 |
| GET | `/v2/studios` | 列出所有工作室 |
| GET/PUT/DELETE | `/v2/studios/:id` | 工作室 CRUD |
| POST/PUT/DELETE | `/v2/studios/:id/characters` | 角色 CRUD |
| POST/PUT/DELETE | `/v2/studios/:id/locations` | 场景 CRUD |
| POST/PUT/DELETE | `/v2/studios/:id/props` | 道具 CRUD |
| POST/PUT/DELETE | `/v2/studios/:id/style-presets` | 风格预设 CRUD |
| POST | `/v2/projects` | 创建项目 |
| GET/PUT/DELETE | `/v2/projects/:id` | 项目 CRUD |
| POST | `/v2/projects/:id/generate` | 触发生成管线 |
| GET | `/v2/projects/:id/tasks` | 查询生成任务 |
| GET | `/v2/tasks/:taskId` | 查询单个任务 |

### Generate 流程

```
POST /v2/projects/:id/generate?studio_id=xxx
  │
  ▼
BackgroundJob.schedule (异步)
  │
  ▼
V2FullPipeline.runFullPipeline()
  │
  ├── 1. StudioRepository.get(studioId)     → 全局资产库
  │    ProjectRepository.get(projectId)      → 项目数据
  │
  ├── 2. decideGlobalStyle()                → LLM 全局风格
  │
  ├── 3. decideShotBatch()                  → LLM 逐镜头决策
  │    └── 输入: description + visualPrompt + sequenceContext
  │    └── 输出: template, mood, palette, lighting, postProcessing, qualityTier
  │
  ├── 4. buildShotPrompt()                  → Prompt 组装
  │    └── 角色肖像图 + 场景概念图 + LLM 决策 → prompt + references
  │
  └── 5. SeedDanceClient.generateVideo()    → 视频生成
       └── 输入: prompt + references
       └── 输出: videoUrl
```

## V1 Legacy 管线（保留但不再维护）

路径前缀：`/api/creator-helix`（不含 `/v2`）

基于状态机（15 状态）驱动，使用关键词匹配选择模板。代码保留在：
- `src/executor/runner.ts`
- `src/state-machine/`
- `src/planner/storyboard-intent-planner.ts`
- `src/services/asset-generation.ts`

**已知问题**：
- 模板选择使用英文关键词匹配（中文输入全部 fall through 到 default）
- `editing.ts` 和 `export.ts` 返回 mock URL（未真正实现）
- 无知识图谱支持

## 外部服务集成

### SeedDance（视频生成）

```
API: https://ark.cn-beijing.volces.com/api/v3
模型: doubao-seedance-2-0-mini-260615 (默认)
认证: SEEDANCE_API_KEY 环境变量
```

### LongCat（LLM）

```
API: https://api.longcat.chat/openai
模型: LongCat-2.0 (默认)
认证: LONGCAT_API_KEY 环境变量
```

## 文件结构

```
src/
├── v2/                               // 主链路
│   ├── config/index.ts               // 集中配置
│   ├── llm/decisions.ts              // LLM 创意决策
│   ├── prompt/builder.ts             // Prompt 组装
│   ├── pipeline/full-pipeline.ts     // 管线编排入口
│   └── test/                         // 15 tests
│
├── studio/                           // Studio 数据层
│   ├── schema/                       // 8 个 schema 文件
│   └── repository.ts                 // StudioRepository
│
├── project/                          // Project 数据层
│   ├── schema/                       // 4 个 schema 文件
│   └── repository.ts                 // ProjectRepository
│
├── generation/                       // AssetTask 数据层
│   ├── asset-task.ts                 // AssetTask Schema + createAssetTask
│   └── repository.ts                 // AssetTaskRepository
│
├── server/                           // API 层
│   ├── app.ts                        // Hono app (v1 legacy + v2 mount)
│   ├── studio-api.ts                 // Studio CRUD API
│   ├── project-api.ts                // Project CRUD + Generate API
│   └── start.ts                      // 入口
│
├── services/
│   └── seeddance-client.ts           // SeedDance HTTP 客户端
│
├── llm/
│   ├── longcat.ts                    // LongCat HTTP 客户端
│   └── model.ts                      // Config-aware LLM wrapper
│
├── persistence/                      // Drizzle 表定义 + Migration
│   ├── sql.ts                        // V1 表 (ProjectTable, ShotTable, ...)
│   ├── studio.sql.ts                 // V2 表 (StudioTable, KnowledgeProjectTable, ...)
│   ├── repository.ts                 // V1 ProjectRepository
│   └── migrate.ts                    // DDL
│
└── [V1 Legacy]                       // 旧管线（保留）
    ├── executor/runner.ts
    ├── state-machine/
    ├── planner/
    ├── renderer/
    ├── services/asset-generation.ts
    └── schema/project.ts
```

## 注意事项

1. **Schema 验证** — 所有 Repository 的 `fromRow` 使用 `Schema.decodeUnknownOption` 验证 JSON 数据
2. **配置优先** — 所有模型 ID、API 端点通过环境变量配置，代码中无硬编码凭据
3. **画质跟随情绪** — QualityTier 由 LLM 根据镜头情绪选择，非固定值
4. **角色一致性** — 同一角色的所有镜头引用同一 `CharacterState.portrait`
5. **跨项目复用** — Studio 资产库可在多个 Project 间共享
6. **异步生成** — Generate API 通过 BackgroundJob 异步执行，返回 jobId
