# CreatorHelix

> 以 Agent 自动编排为主、人工修改为辅的视频生成软件方案。

## 项目定位

CreatorHelix 是一个面向创作者的视频生成平台，核心由 AI Agent 自动完成从创意到成片的完整流程，同时在关键节点（脚本、分镜、成片）允许人工介入修改。

## 核心借鉴

本方案大量借鉴了 **ComfyUI** 的设计哲学：

- **节点化 / 步骤化**：把视频生成拆解为可复用、可组合的原子步骤
- **DAG 执行**：按依赖关系调度任务，支持并行与增量重算
- **可复现性**：每个项目保存完整工作流快照，结果可追溯
- **模型解耦**：底层模型可插拔，便于替换和升级

但与 ComfyUI 不同，CreatorHelix 不暴露节点图给普通用户，而是让 Agent 在后台编排，用户面对的是更自然的**剧本 + 时间轴 + 预览**界面。

## 落地底座

本方案计划基于当前仓库 **HelixAgent** 实现：

- 复用 `packages/schema` 做数据建模
- 复用 `packages/llm` 做 LLM 调用与 Tool Calling
- 复用 `packages/core/src/database` 做 SQLite + Drizzle 持久化
- 复用 `packages/server` 做 API 层
- 在 `packages/` 下新建 `packages/creator-helix` 承载业务逻辑

## 文档结构

| 文件 | 内容 |
|---|---|
| `docs/01-comfyui-research.md` | ComfyUI 调研及可借鉴点 |
| `docs/02-agent-architecture.md` | 智能体核心模块划分 |
| `docs/03-state-machine.md` | 项目状态机设计与代码实现 |
| `docs/04-database-schema.md` | 数据库表结构 |
| `docs/05-implementation-notes.md` | 实现要点与下一步建议 |
| `docs/06-integration-with-helixagent.md` | 基于本地 HelixAgent 仓库的集成方案 |
| `docs/07-api.md` | API 层设计（Hono） |
| `docs/08-main-chain.md` | 端到端主链路说明 |

## 当前状态

- 端到端主链路已跑通，测试覆盖 `PROJECT_INIT → COMPLETED` 完整流程。
- Agent 已按创作角色拆分：导演、编剧、场景布局师、摄影师、剪辑师、质检员。
- 编剧/场景布局师在 `ScriptPlanner` 中调用 LLM。
- 摄影师/剪辑师/质检员在各自 Planner 中调用 LLM：
  - 优先读取 `OPENAI_API_KEY`（OpenAI `gpt-4o-mini`）
  - 其次读取 `LONGCAT_API_KEY` / `LONGCAT_BASE_URL`（LongCat OpenAI-compatible）
  - 无 key 或 LLM 输出不稳定时自动 fallback 到 rule-based
- 已用 **三体水滴袭击地球舰队** 剧本跑通 e2e：`test/sanse-waterdrop.e2e.test.ts`
- 视频文件生成仍使用 mock URL，重点验证结构化输出（脚本、分镜、prompts、剪辑计划、质检结果）。

## 快速概览

```
用户创意
  ↓
需求分析 → 规划器生成执行计划
  ↓
脚本生成 → 人工审批
  ↓
分镜生成 → 人工审批
  ↓
素材并行生成 → 自动质检
  ↓
自动剪辑合成
  ↓
成片预览 → 人工审批
  ↓
导出成片
```
