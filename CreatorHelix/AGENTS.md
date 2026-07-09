# CreatorHelix Agent 开发规范

## 1. 项目定位

CreatorHelix 是一个**视频自动化生成的编排系统**（Video Generation Orchestration System）。

它不是视频编辑工具，也不是 ComfyUI 的复刻，而是一个让 AI Agent 自动把"用户创意"编排成"可执行视频生成工作流"的系统。底层模型、生成工具、剪辑工具都应该是可插拔的。

## 2. 核心设计原则

### 2.1 禁止 Hand Code

- 禁止在业务代码中写死状态转换逻辑、工具调用顺序、参数模板。
- 所有编排意图必须由 LLM 生成结构化输出，harness 负责解释执行。
- 允许的规则代码只限于：schema 校验、IO 适配、资源限制、兜底策略。

### 2.2 LLM 决策

LLM 负责决策以下事项：

- 工作流拆分：需求 → 脚本 → 分镜 → 素材 → 剪辑 → 导出
- Prompt 优化：根据风格、目标受众、参考案例优化每个 shot 的生成 prompt
- 工具选择：选择用哪个视频/图像/TTS/音乐模型
- 参数生成：分辨率、时长、运动强度、转场类型等
- 质检决策：一致性、风格偏离、缺失镜头
- 回滚/重试决策：失败后如何修复

LLM 输出必须绑定 Effect Schema，禁止解析自由文本。

### 2.3 Harness 兜底

Harness 层是系统的执行骨架，对 LLM 决策做兜底：

- **Schema 兜底**：LLM 输出必须 decode，失败则重试或 fallback
- **超时/重试兜底**：每个自动步骤有超时和重试策略
- **规则兜底**：无 OPENAI_API_KEY 或 LLM 不可用时，使用 rule-based 等价实现
- **人工兜底**：关键节点（脚本、分镜、成片）必须支持人工审批或修改
- **状态兜底**：任意步骤失败可回滚到上一稳定状态，不丢上下文

### 2.4 泛化性

- 不假设底层只有一个视频模型；通过 Tool Registry 注册多个生成器
- 不假设固定工作流；工作流由 Planner 根据需求动态生成
- 不假设输出格式；通过 schema 定义输入输出，适配不同前端

## 3. Harness 层职责

Harness 层位于 `packages/creator-helix/src/harness/`，包含：

| 模块 | 职责 |
|---|---|
| `harness/workflow.ts` | 解析 LLM 生成的 workflow DAG，调度执行 |
| `harness/tool-registry.ts` | 注册生成器、剪辑器、TTS、字幕等工具 |
| `harness/executor.ts` | 执行节点、管理依赖、并行、重试、超时 |
| `harness/observer.ts` | 记录执行轨迹、成本、耗时、中间产物 |
| `harness/fallback.ts` | 统一处理 LLM 失败、工具失败、超时 |
| `harness/human-loop.ts` | 在审批节点暂停并暴露等待人工事件 |

Harness 不感知业务语义，只认识：

- Node：输入 schema + 输出 schema + tool reference + config
- Edge：数据依赖关系
- Event：状态推进信号

## 4. Agent 角色与边界

当前 Agent 按创作角色拆分，每个 Agent 只负责生成决策，不直接执行：

| Agent | 决策输出 | 执行交给 |
|---|---|---|
| Director | 项目目标、风格一致性要求 | Harness |
| Scriptwriter | `Script` schema | Harness |
| StoryboardArtist | `Storyboard` schema | Harness |
| Cinematographer | 优化后的 `Shot[]` prompts | Harness + Tool Registry |
| Editor | `EditingPlan` schema | Harness + Tool Registry |
| QA | `ReviewOutput` schema（passed/reason/failedAssetId） | Harness |

Agent 实现必须是：

```
system prompt + schema + LLM.generateObject + fallback
```

禁止在 Agent 内部直接调用外部 API 或写死规则树。

## 5. 链路优化策略

### 5.1 DAG 化

把视频生成链路表达为有向无环图：

```
需求 → 脚本 → 分镜 → [shot1, shot2, ...] → 剪辑 → 导出
```

独立 shot 可并行生成。

### 5.2 增量更新

- 每个 shot 计算内容 hash
- 用户修改脚本/分镜后，只重跑 hash 变化的 shot
- 下游剪辑、配音自动触发

### 5.3 缓存

- LLM 规划结果按输入 hash 缓存
- 生成成功的 asset 按 prompt hash 缓存
- 避免重复调用昂贵的视频模型

### 5.4 热路径优化

- 脚本、分镜、成片审批是热路径，必须快速响应
- 素材生成是冷路径，可异步排队

## 6. 当前实现状态

| 组件 | 状态 | 说明 |
|---|---|---|
| 状态机 | ✅ | 15 状态持久化状态机 |
| 多 Agent | ✅ | Director / Scriptwriter / StoryboardArtist / Cinematographer / Editor / QA |
| LLM Planner | ✅ | Script / Storyboard / Cinematographer / Editor / QA 已接入 LLM（OpenAI / LongCat fallback） |
| Harness | 🚧 | 当前用 runner + service 模拟，需迁移到 harness 抽象 |
| Tool Registry | 🚧 | 当前 service 硬编码，需改为可注册工具 |
| DAG Executor | 🚧 | 当前串行执行，需支持并行与增量 |
| 真实视频生成 | ⏳ | 保留 mock，待接入 HunyuanVideo / Wan / LTX / 第三方 API |

## 7. 开发约定

### 7.1 新增 Agent

1. 在 `src/agent/` 新增 `{role}.ts`
2. 导出 `ID`、`info`、`SYSTEM_PROMPT`
3. 在 `src/planner/` 新增 `{role}-planner.ts`，只输出 schema
4. 在 `src/harness/tool-registry.ts` 注册所需工具（如果存在）
5. 更新 `src/agent/index.ts` 和 `src/planner/index.ts`
6. 更新本文档第 4 节

### 7.2 禁止事项

- 禁止在 `runner.ts` 中新增 `case "SOME_STATE": ... 手工处理 ...`
- 禁止在 service 中写死模型参数或路径
- 禁止新增状态而不更新状态机 schema 和 transition 表
- 禁止让 Agent 直接调用外部 API

### 7.3 推荐做法

- 优先用 LLM.generateObject 生成结构化决策
- 所有 LLM 调用必须有 schema + fallback
- 所有耗时操作必须走 harness 执行器，支持取消/重试
- 所有中间产物必须可观测、可回放

## 8. 下一步迁移方向

1. **引入 Workflow DAG**：把当前状态机映射为 DAG 节点，LLM 可动态增删节点
2. **工具注册化**：把 `asset-generation.ts` / `editing.ts` / `export.ts` 改为 Tool Registry 中的工具
3. **Harness 替换 runner**：`runner.ts` 只负责事件路由，具体执行交给 harness
4. **LLM 动态规划**：让 Director Agent 根据需求输出完整 workflow DAG，而不是固定 15 状态
5. **Human-in-the-loop 统一化**：所有审批节点通过 harness/human-loop.ts 暂停并暴露事件
