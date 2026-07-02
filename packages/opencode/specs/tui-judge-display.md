# TUI Judge Display

外化展示 judge 类能力（GoalJudge、JudgeAgent、OpenSpecJudge）的评估结果到 TUI 界面。

## 背景

当前 judge 相关服务已在运行但结果未展示给用户：

- **GoalJudge** (`session/goal-judge.ts`): preflight 判定 goal 可行性，verdict 写入 Trace 但 TUI 无消费
- **JudgeAgent** (`agent/judge-agent.ts`): max-mode 多候选评分，结果存在 candidate 上但无展示
- **OpenSpecJudge** (`openspec/judge.ts`): spec 合规判定，无 TUI 展示

Goal 事件 schema 已预留 `lastVerdict` 字段（`goal.ts:23-28`），TUI 侧未消费。

## 目标

让用户在聊天过程中实时看到 judge 的评估结果，提升对 AI 决策过程的理解和信任。

## 设计原则

- 不新增服务层，不改 `AppLayer`，不加新 lazy load
- 改动限定在 API 返回值 + TUI 渲染层
- 不影响 TUI 启动链路（避免黑屏风险）

## 分阶段实施

### P0: GoalJudge verdict → GoalIndicator ✅ 已完成

**改动范围：**

1. `session.goal` API 返回值扩展：
   - 当前：`{ condition: string, react: number }`
   - 目标：增加 `verdict?: { ok: boolean, impossible?: boolean, reason: string }`

2. TUI sync state 扩展（`tui/src/context/sync.tsx`）：
   - goal 类型增加 `verdict` 字段

3. `GoalIndicator` 组件更新（`tui/src/component/indicator-goal.tsx`）：
   - `verdict.ok === false` → 红色 + `✗` 图标 + reason 截断显示
   - `verdict.ok === true` → 绿色 + `✓` 图标
   - 无 verdict → 保持现有 `🎯` 显示

**风险评估：** 零。纯数据透传 + 条件渲染，不涉及服务层。

### P1: Sidebar Context 区 Judge 状态行 ✅ 已完成

**改动范围：**

1. `sidebar-context` 插件（`tui/src/feature-plugins/sidebar/context.tsx`）新增一行：
   - 显示当前 session 的 judge verdict 状态
   - `verdict.ok === true` → "Judge: ✓ approved"（绿色）
   - `verdict.ok === false` → "Judge: ✗ rejected"（红色）

2. 通过 `api.state.session.goal(sessionID)` 获取 verdict 数据
   - 需要在 `TuiState.session` 类型中新增 `goal()` 方法
   - 在 `adapters.tsx` 中实现透传

**风险评估：** 零。仅在已有 sidebar 插件中增加条件渲染。

### P2: Trace panel 展示 judge 决策链路 ⚠️ 部分完成

**已完成：**

1. 新增 `sidebar-trace` 插件（`tui/src/feature-plugins/sidebar/trace.tsx`）
   - 展示 goal verdict 的 reason 和 impossible 标记
   - 注册在 builtins 中，order=150（在 Context 之后）

2. Server 端新增 `session.trace` API 端点
   - 路径：`/session/:sessionID/trace`
   - Schema：`{ id, type, name, status, duration?, timestamp, parentId?, metadata? }`
   - Handler 调用 `Trace.getTraces(sessionID)`

**未完成（需后续处理）：**

3. SDK codegen 未生成 `session.trace()` 方法
   - 原因：trace endpoint 定义在 server 的 experimental HttpApi（`groups/session.ts`），
     而 SDK codegen 从 `@opencode-ai/protocol/api` 生成，protocol 的 session group 不含此端点
   - 解决方案：需要在 `packages/protocol/src/groups/session.ts` 中添加 trace endpoint 定义，
     然后运行 `bun run generate` from `packages/client`
   - 当前 workaround：trace 插件复用 goal verdict 数据展示

**风险评估：** 低。sidebar 插件是纯渲染层，不影响启动。

## 架构约束（后续开发必读）

### TUI 新增 sidebar 展示模块的正确路径

```
1. 数据层：确保 API 返回所需数据
   - 如果数据已在服务端存在 → 扩展 API schema + handler
   - 如果数据不存在 → 在服务层新增存储，再扩展 API

2. SDK 层：确保 TUI 能获取数据
   - 如果 endpoint 在 protocol groups/ 中 → `bun run generate` 自动生成
   - 如果 endpoint 在 server experimental HttpApi 中 → 需要先迁移到 protocol

3. Plugin API 层：确保插件能访问数据
   - 在 `plugin/src/tui.ts` 的 `TuiState` 类型中新增方法
   - 在 `tui/plugin/adapters.tsx` 中实现透传

4. 渲染层：创建 sidebar 插件
   - 在 `tui/src/feature-plugins/sidebar/` 下新建文件
   - 在 `builtins.ts` 中注册
   - 使用 `api.state.session.xxx()` 获取数据
```

### 关键约束

- **不要直接在 sidebar 组件中发 HTTP 请求**，数据必须通过 sync 层获取
- **不要修改 `AppLayer` 或新增 lazy load**，避免黑屏风险
- **新增 API endpoint 时**，如果需要 SDK 支持，必须在 `packages/protocol/src/groups/` 中定义，
  不能只在 server 的 experimental HttpApi 中定义
- **sidebar 插件的 order 值**决定展示顺序：Context(100) > Trace(150) > MCP(200) > LSP(300) > Todo(400) > Files(500)

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/session/goal-judge.ts` | GoalJudge 服务定义 |
| `src/session/goal.ts` | Goal 服务，含 `setVerdict` 方法 |
| `src/session/mode-registry.ts` | Mode 的 judgeEnabled 配置 |
| `src/server/routes/instance/httpapi/groups/session.ts` | session.goal + session.trace API 端点 |
| `src/server/routes/instance/httpapi/handlers/session.ts` | goal + trace handler |
| `plugin/src/tui.ts` | `TuiState.session.goal()` 类型定义 |
| `tui/plugin/adapters.tsx` | `goal()` 方法实现 |
| `tui/src/component/indicator-goal.tsx` | Goal footer indicator（P0） |
| `tui/src/feature-plugins/sidebar/context.tsx` | Sidebar Context 插件（P1） |
| `tui/src/feature-plugins/sidebar/trace.tsx` | Sidebar Trace 插件（P2） |
| `tui/src/feature-plugins/builtins.ts` | 内置插件注册 |
| `tui/src/context/sync.tsx` | TUI 数据同步层 |
