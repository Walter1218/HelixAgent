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

### P0: GoalJudge verdict → GoalIndicator

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

### P1: Sidebar Context 区 Judge 状态行

**改动范围：**

1. `sidebar-context` 插件（`tui/src/feature-plugins/sidebar/context.tsx`）新增一行：
   - 显示当前 mode 的 judge 配置状态
   - `judgeEnabled: true` → "Judge: ✓ enabled"
   - `judgeEnabled: false` → 不显示

2. 可选：从 `session.goal` API 获取 verdict 后，在 Context 区显示最近一次 judge 结果

**风险评估：** 零。仅在已有 sidebar 插件中增加条件渲染。

### P2: Trace panel 展示 judge 决策链路

**改动范围：**

1. 新增 `sidebar-trace` 插件或扩展现有 sidebar
2. 消费 `Trace` 服务的事件流，展示 judge 决策链路
3. 可复用 `panel-trace.tsx` 的树形渲染逻辑

**风险评估：** 低。需要评估 Trace 事件流的订阅方式，避免高频更新影响性能。

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/session/goal-judge.ts` | GoalJudge 服务定义 |
| `src/session/goal.ts` | Goal 服务，事件 schema 已含 lastVerdict |
| `src/session/mode-registry.ts` | Mode 的 judgeEnabled 配置 |
| `src/server/routes/instance/httpapi/groups/session.ts` | session.goal API 端点 |
| `tui/src/component/indicator-goal.tsx` | Goal footer indicator |
| `tui/src/feature-plugins/sidebar/context.tsx` | Sidebar Context 插件 |
| `tui/src/context/sync.tsx` | TUI 数据同步层 |
