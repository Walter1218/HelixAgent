# HelixAgent TUI 黑屏问题分析报告

## 问题现象

`c95e8e229 feat(core): implement quality assurance pipeline (Phase 0-8)` 合入后，TUI 启动后显示纯黑界面，无法渲染任何可见内容。Ctrl+C 也无法退出。

## 根因

`c95e8e229` 引入了 5 个新的质量保障能力，它们的依赖链在 **worker 初始化时**触发了 `@opentui/solid` + `solid-js` browser build 的兼容性问题，导致 `createRenderEffect` 异步执行，SolidJS 组件树无法挂载到 OpenTUI 渲染器根节点（`root_kids=0`）。

## 涉及的 5 个能力

### 1. SpecTool — 多 Agent 规格生成工具

**文件**: `packages/opencode/src/tool/spec.ts`（229 行）

**功能**: 从自然语言需求生成可验证的 OpenSpec 规格文档。使用 7 阶段 Agent 流水线：
1. 需求分解（req-agent）
2. 架构分析（arch-agent）
3. 验收标准设计（accept-agent）
4. 验证预演（test-agent）
5. 规格文档生成（merge-agent）
6. 质量审查（review-agent）
7. 迭代修复（fix-agent）

**依赖链**: `SpecTool` → `spec-generation/pipeline`（8 个 agent 模块）→ `@ai-sdk/provider`（LLM SDK 类型）

**在 `tool/registry.ts` 中注册**: worker 初始化时 `yield* SpecTool` 触发整条依赖链加载。

**影响**: 直接导致 TUI 崩溃（195 字节，无任何渲染）。

### 2. SpecReport — 规格验证报告

**文件**: `packages/opencode/src/openspec/report.ts`（113 行）

**功能**: 从 spec 文件生成验证报告，检查每个需求的满足情况。

**依赖链**: `openspec/spec` → `openspec/judge` → `trace/trace`

**在 `app-runtime.ts` 中注册**: `SpecReport.defaultLayer`（worker 初始化时加载）。

### 3. OpenSpecPrecheck — 执行前违规检查

**文件**: `packages/opencode/src/openspec/precheck.ts`（133 行）

**功能**: 在执行前检查是否有 spec 违规，防止破坏已有规格。

**依赖链**: `openspec/spec` → `trace/trace`

**在 `app-runtime.ts` 中注册**: `OpenSpecPrecheck.defaultLayer`（worker 初始化时加载）。

### 4. GoalJudge — 目标评估

**文件**: `packages/opencode/src/session/goal-judge.ts`（115 行）

**功能**: 评估 session 目标是否达成，提供 verdict（ok/impossible）。

**依赖链**: `session/goal` → `trace/trace`

**在 `app-runtime.ts` 中注册**: `GoalJudge.defaultLayer`（worker 初始化时加载）。

### 5. CardinalPreflight — 前置风险检查

**文件**: `packages/opencode/src/session/preflight.ts`（135 行）

**功能**: 在执行前检查风险等级（block/pause/stop/warn），评估是否可以继续。

**依赖链**: `session/cardinal` → `trace/trace`

**在 `app-runtime.ts` 中注册**: `CardinalPreflight.defaultLayer`（worker 初始化时加载）。

## 黑屏机制

```
worker 初始化
  → yield* SpecTool (registry.ts)
    → import spec-generation/pipeline (8 个 agent 模块)
    → import @ai-sdk/provider (LLM SDK 类型)
  → AppLayer 初始化 (app-runtime.ts)
    → SpecReport.defaultLayer
    → OpenSpecPrecheck.defaultLayer
    → GoalJudge.defaultLayer
    → CardinalPreflight.defaultLayer
  → 触发 solid-js browser build 的 createRenderEffect 异步执行
    → renderer.root.add() 从未被调用
      → root_kids=0
        → 渲染循环输出空帧
          → 黑屏
```

## 修复方案

### 方案一：临时移除（已废弃）

从 `c95e8e229` 中移除这 5 个能力的主链路注册，保留其他所有功能（数据库迁移、openspec 框架、session 增强等）。

### 方案二：懒加载重新启用（当前方案）

使用 `Layer.unwrap` + `Effect.promise` + 动态 `import()` 实现懒加载，将5个能力的依赖链从 worker 初始化时延迟到实际使用时。

**修改文件**:

1. `packages/opencode/src/effect/app-runtime.ts`
   - 添加 `Effect` 导入
   - 使用懒加载模式引入4个服务层：
     ```ts
     const lazySpecReport = Layer.unwrap(
       Effect.promise(async () => {
         const mod = await import("@/openspec/report")
         return mod.SpecReport.defaultLayer
       }),
     )
     ```
   - 将 `lazySpecReport`、`lazyOpenSpecPrecheck`、`lazyGoalJudge`、`lazyCardinalPreflight` 添加到 `Layer.mergeAll`

2. `packages/opencode/src/tool/registry.ts`
   - 创建懒加载代理工具：
     ```ts
     const lazySpecTool = {
       id: "spec",
       init: () => Effect.gen(function* () {
         const mod = yield* Effect.promise(() => import("./spec"))
         const info = yield* mod.SpecTool
         return yield* info.init()
       }),
     } as unknown as Tool.Info
     ```
   - 将 `lazySpecTool` 添加到工具初始化和 builtin 数组

**懒加载模式**:
- 服务层：`Layer.unwrap(Effect.promise(async () => { const mod = await import(...); return mod.Xxx.defaultLayer }))`
- 工具：创建代理 `Info` 对象，在 `init()` 中动态导入实际工具

**验证结果**:
- TUI 测试：191 pass, 0 fail
- 质量保障能力测试：25 pass, 0 fail
- 所有5个能力按需加载正常工作

## 验证方法

运行 TUI 测试：
```bash
cd packages/tui && bun test --timeout 30000
```

运行质量保障能力测试：
```bash
cd packages/opencode && bun test test/e2e/quality-gates/ --timeout 30000
```

验证 TUI 是否正常：
```bash
./helix
```
