# 基于 HelixAgent 实现 CreatorHelix 的集成方案

## 一、HelixAgent 能力盘点

HelixAgent（仓库名）本质上是一个 **AI Agent 应用框架 + opencode 编程助手产品**。其底层基础设施非常通用，可以直接支撑 CreatorHelix。

| 能力 | 所在位置 | CreatorHelix 是否可复用 |
|---|---|---|
| Effect v4 beta 运行时 | 全仓库 | ✅ 复用 |
| Schema 定义（Effect Schema） | `packages/schema` | ✅ 复用 |
| LLM 统一调用（stream/generate/generateObject） | `packages/llm` | ✅ 复用 |
| Tool 定义与调用 | `packages/llm/src/tool.ts` | ✅ 复用 |
| Agent 配置抽象 | `packages/schema/src/agent.ts` | ✅ 复用 |
| 内存 State 管理 | `packages/core/src/state.ts` | ⚠️ 参考，视频项目需持久化 |
| SQLite + Drizzle ORM | `packages/core/src/database` | ✅ 复用 |
| 异步 BackgroundJob | `packages/core/src/background-job.ts` | ⚠️ 复用但需补充持久化队列 |
| Project / Location 抽象 | `packages/core/src/project.ts` | ⚠️ 语义不同，需扩展 |
| HTTP Server / API 路由 | `packages/server` | ✅ 复用 |
| Web 前端 | `packages/app` | ⚠️ 可复用构建方式，但需新 UI |
| TUI 前端 | `packages/opencode` | ❌ 不适合视频创作场景 |

## 二、推荐架构：新增 `packages/creator-helix`

最推荐的方式是把 CreatorHelix 作为 HelixAgent monorepo 中的一个新 package，和 opencode 平行。

```
HelixAgent/
├── packages/
│   ├── opencode/              # 现有 AI 编程助手
│   ├── core/                  # 共享核心基础设施
│   ├── schema/                # 共享 Schema
│   ├── llm/                   # 共享 LLM 调用
│   ├── server/                # 共享 HTTP 服务
│   ├── app/                   # 现有 Web 前端
│   └── creator-helix/         # 新增：视频生成 Agent
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── schema/        # VideoProject, Shot, Asset 等 Schema
│       │   ├── state-machine/ # 项目状态机
│       │   ├── planner/       # 规划器
│       │   ├── context/       # 上下文组装
│       │   ├── tools/         # 视频/音频/TTS/剪辑工具
│       │   ├── executor/      # DAG 执行器
│       │   ├── review/        # 人工回环接口
│       │   ├── memory/        # 用户偏好与项目记忆
│       │   ├── persistence/   # 数据库 repository
│       │   └── server/        # CreatorHelix 专属 API handlers
│       └── test/
```

## 三、关键复用点详解

### 1. 复用 Schema 系统定义业务模型

```typescript
// packages/creator-helix/src/schema/video-project.ts
import { Schema } from "effect"

export const ID = Schema.String.pipe(Schema.brand("CreatorHelix.ProjectID"))
export type ID = typeof ID.Type

export const State = Schema.Literal(
  "PROJECT_INIT",
  "REQUIREMENT_ANALYSIS",
  "PLANNING",
  "SCRIPT_GENERATION",
  "SCRIPT_REVIEW",
  "STORYBOARD_GENERATION",
  "STORYBOARD_REVIEW",
  "ASSET_GENERATION",
  "ASSET_REVIEW",
  "EDITING",
  "FINAL_REVIEW",
  "EXPORT",
  "COMPLETED",
  "ERROR",
  "PAUSED"
)

export const Info = Schema.Struct({
  id: ID,
  userId: Schema.String,
  title: Schema.String,
  state: State,
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}).annotate({ identifier: "CreatorHelix.Project" })

export interface Info extends Schema.Schema.Type<typeof Info> {}
```

### 2. 复用 LLM.generateObject 做结构化生成

```typescript
// packages/creator-helix/src/planner/script-planner.ts
import { Effect, Schema } from "effect"
import { LLM } from "@opencode-ai/llm"

const ScriptPlan = Schema.Struct({
  scenes: Schema.Array(Schema.Struct({
    sequence: Schema.Number,
    description: Schema.String,
    durationSeconds: Schema.Number,
    visualPrompt: Schema.String,
    narration: Schema.String,
  })),
  totalDurationSeconds: Schema.Number,
})

export const generateScriptPlan = (requirement: string) =>
  Effect.gen(function* () {
    const response = yield* LLM.generateObject({
      model: { provider: "openai", model: "gpt-4o" }, // 或从配置读取
      system: "你是一位短视频导演。根据用户需求生成脚本和分镜规划。",
      prompt: requirement,
      schema: ScriptPlan,
    })
    return response.object
  })
```

### 3. 复用 Tool 系统封装视频生成能力

```typescript
// packages/creator-helix/src/tools/generate-video-tool.ts
import { Effect, Schema } from "effect"
import { Tool } from "@opencode-ai/llm/tool"

export const GenerateVideoTool = Tool.make({
  description: "根据 prompt 生成一段视频",
  parameters: Schema.Struct({
    prompt: Schema.String,
    durationSeconds: Schema.Number,
    resolution: Schema.Literal("720p", "1080p"),
    styleReference: Schema.optional(Schema.String),
  }),
  success: Schema.Struct({
    assetId: Schema.String,
    url: Schema.String,
  }),
  execute: (params) =>
    Effect.gen(function* () {
      // 调用 HunyuanVideo / Wan / 第三方 API
      const asset = yield* videoGenerationService.generate(params)
      return { assetId: asset.id, url: asset.url }
    }),
})
```

### 4. 复用 BackgroundJob 执行异步任务

```typescript
// packages/creator-helix/src/executor/project-runner.ts
import { Effect } from "effect"
import { BackgroundJob } from "@opencode-ai/core/background-job"

export const runProject = (projectId: string) =>
  Effect.gen(function* () {
    const job = yield* BackgroundJob.Service
    return yield* job.start({
      type: "creator-helix-project",
      title: `生成视频项目 ${projectId}`,
      metadata: { projectId },
      run: executeUntilHumanHalt(projectId),
    })
  })
```

> ⚠️ BackgroundJob 是进程内存中的，重启会丢失。对于视频生成这种长任务，需要额外做持久化队列（见下文）。

## 四、需要新建或扩展的部分

### 1. 持久化状态机

HelixAgent 的 `State` 是内存状态，不适合 CreatorHelix。需要基于 SQLite + Drizzle 做持久化状态机。

位置：`packages/creator-helix/src/persistence/`

### 2. 持久化任务队列

BackgroundJob 适合短时间任务。视频生成耗时数分钟，需要：

- 任务状态持久化到数据库
- worker 进程可独立运行
- 支持断点续跑

推荐：
- 方案 A：基于 `packages/core/src/background-job.ts` 包装一层持久化外壳
- 方案 B：引入 BullMQ / Temporal（如果团队熟悉）
- 方案 C：自研 SQLite 队列（最贴合现有栈）

### 3. 视频项目模型扩展

HelixAgent 的 `Project` 是代码仓库概念（worktree, vcs），CreatorHelix 需要自己的 `VideoProject` 模型。

可以在 `packages/schema` 新增 `creator-helix-project.ts`，或在 `packages/creator-helix` 内部定义。

推荐放在 `packages/creator-helix/src/schema/`，避免污染现有 schema。

### 4. 人工回环 API

在 `packages/server` 新增路由，或 `packages/creator-helix/src/server/` 自研 Hono 服务。

关键接口：
- `POST /creator-helix/projects`：创建项目
- `GET /creator-helix/projects/:id`：查询项目状态
- `POST /creator-helix/projects/:id/reviews/:stage`：提交审批
- `POST /creator-helix/projects/:id/pause`：暂停
- `POST /creator-helix/projects/:id/resume`：恢复
- `GET /creator-helix/projects/:id/assets`：获取素材列表

## 五、推荐的最小可行路径（MVP）

### Phase 1：基础设施搭建（1-2 周）

1. 创建 `packages/creator-helix` 包
2. 定义 VideoProject / Shot / Asset Schema
3. 创建 SQLite 表和 migrations
4. 实现基础持久化 repository
5. 接入 `LLM.generateObject`

### Phase 2：核心状态机跑通（2-3 周）

1. 实现项目状态机
2. 实现脚本生成 planner
3. 实现分镜生成 planner
4. 实现脚本/分镜审批接口
5. 前端基础审批界面

### Phase 3：视频生成闭环（3-4 周）

1. 接入一个视频生成模型（HunyuanVideo / Wan）
2. 实现素材并行生成
3. 实现自动质检与重试
4. 实现自动剪辑（基于 ffmpeg 或模板）
5. 成片导出

### Phase 4：体验优化（持续）

1. 暂停/恢复
2. 增量重算
3. 用户偏好记忆
4. 模板市场

## 六、代码示例：一个完整的项目创建到脚本生成流程

```typescript
// packages/creator-helix/src/project/lifecycle.ts
import { Effect, Schema } from "effect"
import { LLM } from "@opencode-ai/llm"
import { ProjectRepository } from "../persistence/project-repository"
import { StateMachine } from "../state-machine"

export const createProject = (input: { userId: string; title: string; requirement: string }) =>
  Effect.gen(function* () {
    const repo = yield* ProjectRepository.Service
    const project = yield* repo.create({
      userId: input.userId,
      title: input.title,
      state: "PROJECT_INIT",
      context: { requirement: input.requirement },
    })

    yield* StateMachine.transition(project.id, { type: "SUBMIT_REQUIREMENT", payload: input.requirement })
    return project
  })

export const runAutomaticSteps = (projectId: string) =>
  Effect.gen(function* () {
    const machine = yield* StateMachine.Service

    while (true) {
      const project = yield* machine.get(projectId)
      if (StateMachine.isHumanState(project.state)) break
      if (project.state === "COMPLETED" || project.state === "ERROR") break

      const event = yield* StateMachine.handleState(project)
      yield* machine.transition(projectId, event)
    }
  })
```

## 七、风险与建议

| 风险 | 建议 |
|---|---|
| HelixAgent 是编程助手，业务抽象不匹配 | 只复用基础设施，业务模型完全新建 |
| Effect v4 beta API 不稳定 | 关注官方升级，写封装层隔离 |
| BackgroundJob 不持久化 | 视频生成任务必须持久化队列 |
| 视频生成成本高、耗时长 | 先做云端推理，本地只做编排和预览 |
| 多模态一致性难保证 | 引入导演 Agent 做最终检查 |

## 八、决策建议

1. **是否把 CreatorHelix 放进 HelixAgent 仓库？**
   - 推荐：是。可以复用 Effect、LLM、Schema、Server 等基础设施。
   - 风险：HelixAgent 代码复杂，前期学习成本高。

2. **是否复用 opencode 的 Session 系统？**
   - 不推荐直接复用。Session 系统是为对话设计的，太重。
   - 可借鉴其持久化和事件机制。

3. **前端用 app 还是新建？**
   - 推荐新建 `packages/creator-helix-app`，但复用 `packages/ui` 组件。

4. **数据库用 SQLite 还是 PostgreSQL？**
   - MVP 用 SQLite（和 HelixAgent 一致）。
   - 产品化后迁移到 PostgreSQL + pgvector。
