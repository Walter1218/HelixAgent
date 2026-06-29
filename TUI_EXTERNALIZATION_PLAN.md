# HelixAgent TUI 外化计划

> 将 Helix (MiMo-Code) 中的 TUI 能力外化到 HelixAgent (OpenCode)
> 创建日期: 2026-06-30

---

## 一、背景概述

### 1.1 当前TUI架构

```
packages/opencode/src/cli/cmd/tui/
├── app.tsx                    # 主应用入口
├── routes/
│   ├── home.tsx               # 首页
│   └── session/
│       ├── index.tsx          # 会话主界面
│       ├── sidebar.tsx        # 侧边栏 (42字符宽)
│       ├── footer.tsx         # 底部状态栏
│       ├── permission.tsx     # 权限提示
│       └── question.tsx       # 问题提示
├── component/
│   ├── dialog-*.tsx           # 各种对话框
│   ├── command-palette.tsx    # 命令面板
│   └── todo-item.tsx          # 待办事项
├── ui/
│   ├── dialog.tsx             # 对话框基础组件
│   ├── toast.tsx              # Toast通知
│   └── dialog-alert.tsx       # 告警对话框
└── context/
    ├── sync.tsx               # 数据同步
    ├── theme.tsx              # 主题
    └── route.tsx              # 路由
```

### 1.2 外化目标

将Phase 1-5实现的核心能力通过TUI展示给用户，提供可视化的交互界面。

---

## 二、Mode系统外化

### 2.1 Mode分类

#### Primary模式 (用户可选择)

| Mode | 颜色 | 说明 | TUI显示 |
|------|------|------|---------|
| **ask** | `#4a9eff` | 只读模式，用于提问和解释 | ✅ |
| **build** | `#fb8147` | 默认模式，执行工具 | ✅ |
| **plan** | `#c7e2a8` | 规划模式，禁止编辑工具 | ✅ |
| **compose** | `#a7a3d8` | 组合模式，使用compose技能 | ✅ |
| **max** | `#e85d75` | 实验性模式，并行运行N个候选 | ✅ |
| **loop** | `#007acc` | 循环模式，自动反馈 | ✅ |

#### Subagent模式 (系统内部)

| Mode | 说明 | TUI显示 |
|------|------|---------|
| **explore** | 探索subagent | ✅ |
| **judge** | 只读对抗subagent | ✅ |
| **general** | 通用subagent | ✅ |
| **title** | 标题生成 | ❌ 隐藏 |
| **summary** | 摘要生成 | ❌ 隐藏 |
| **compaction** | 压缩 | ❌ 隐藏 |
| **checkpoint-writer** | 检查点写入 | ❌ 隐藏 |

#### Skill (技能)

| Skill | 说明 | TUI显示 |
|-------|------|---------|
| **dream** | 记忆整合技能 | ✅ |
| **distill** | 工作流蒸馏技能 | ✅ |
| **scriptwriting** | 短视频剧本编剧技能 | ✅ |

### 2.2 ModeIndicator组件

**位置**: `footer.tsx` 右侧

**UI设计**:
```
┌─────────────────────────────────────────────────────────────────┐
│ /path/to/project   Build • Goal: Create login • 12.5K tokens   │
└─────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/indicator-mode.tsx
export function ModeIndicator() {
  const { theme } = useTheme()
  const local = useLocal()
  
  const mode = createMemo(() => local.agent.current() ?? "build")
  
  const modeConfig = {
    ask: { color: "#4a9eff", label: "Ask" },
    build: { color: "#fb8147", label: "Build" },
    plan: { color: "#c7e2a8", label: "Plan" },
    compose: { color: "#a7a3d8", label: "Compose" },
    max: { color: "#e85d75", label: "Max" },
    loop: { color: "#007acc", label: "Loop" },
  }
  
  const config = createMemo(() => modeConfig[mode()] ?? modeConfig.build)
  
  return (
    <text fg={config().color}>
      {config().label}
    </text>
  )
}
```

### 2.3 DialogMode组件

**位置**: 命令面板或独立对话框

**UI设计**:
```
┌────────────────────────────────────────────────────────────────┐
│ Select Mode                                          [esc] close│
├────────────────────────────────────────────────────────────────┤
│ ● Ask      Read-only, questions only              #4a9eff      │
│ ● Build    Default mode, execute tools            #fb8147      │
│ ○ Plan     Planning only, no edits                #c7e2a8      │
│ ○ Compose  Orchestrate workflows                  #a7a3d8      │
│ ○ Max      Parallel candidates                    #e85d75      │
│ ○ Loop     Auto feedback loop                     #007acc      │
└────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/dialog-mode.tsx
export function DialogMode() {
  const local = useLocal()
  const dialog = useDialog()
  
  const modes = [
    { value: "ask", title: "Ask", description: "Read-only, questions only", color: "#4a9eff" },
    { value: "build", title: "Build", description: "Default mode, execute tools", color: "#fb8147" },
    { value: "plan", title: "Plan", description: "Planning only, no edits", color: "#c7e2a8" },
    { value: "compose", title: "Compose", description: "Orchestrate workflows", color: "#a7a3d8" },
    { value: "max", title: "Max", description: "Parallel candidates", color: "#e85d75" },
    { value: "loop", title: "Loop", description: "Auto feedback loop", color: "#007acc" },
  ]
  
  return (
    <DialogSelect
      title="Select mode"
      current={local.agent.current()}
      options={modes}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
```

**快捷键**: `/mode` 或 `Ctrl+M`

---

## 三、核心指标外化

### 3.1 GoalIndicator组件

**位置**: `footer.tsx` 右侧

**UI设计**:
```
┌─────────────────────────────────────────────────────────────────┐
│ /path/to/project   Build • Goal: Create login • 12.5K tokens   │
└─────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/indicator-goal.tsx
export function GoalIndicator() {
  const { theme } = useTheme()
  const sync = useSync()
  
  const goal = createMemo(() => sync.data.session?.goal)
  const verdict = createMemo(() => sync.data.session?.lastVerdict)
  
  return (
    <Show when={goal()}>
      <text fg={verdict()?.ok ? theme.success : theme.warning}>
        Goal: {goal()!.condition.slice(0, 30)}...
      </text>
    </Show>
  )
}
```

**数据来源**: `sync.data.session.goal`

### 3.2 TokenIndicator组件

**位置**: `footer.tsx` 右侧

**UI设计**:
```
┌─────────────────────────────────────────────────────────────────┐
│ /path/to/project   Build • Goal: None • 12.5K/1M tokens        │
└─────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/indicator-tokens.tsx
export function TokenIndicator() {
  const { theme } = useTheme()
  const sync = useSync()
  
  const used = createMemo(() => sync.data.session?.tokensUsed ?? 0)
  const budget = createMemo(() => sync.data.config?.tokenBudget?.daily ?? 1000000)
  const percentage = createMemo(() => (used() / budget()) * 100)
  
  return (
    <text fg={percentage() > 80 ? theme.error : theme.textMuted}>
      {formatTokens(used())}/{formatTokens(budget())} tokens
    </text>
  )
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}
```

**数据来源**: `sync.data.session.tokensUsed`

---

## 四、Sidebar面板外化

### 4.1 TaskPanel组件

**位置**: `sidebar.tsx` 内容区

**UI设计**:
```
┌────────────────────────────────┐
│ Tasks                          │
├────────────────────────────────┤
│ T1 ● Implement login      [▶] │
│ T1.1 ○ Create API         [ ] │
│ T1.2 ○ Add JWT            [ ] │
│ T2 ✓ Setup database       [✓] │
│ T3 ○ Write tests          [ ] │
└────────────────────────────────┘
```

**实现**:
```tsx
// component/panel-tasks.tsx
export function TaskPanel(props: { sessionID: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  
  const tasks = createMemo(() => {
    const taskMap = sync.data.tasks[props.sessionID] ?? {}
    return Object.values(taskMap).sort((a, b) => a.id.localeCompare(b.id))
  })
  
  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return <text fg={theme.success}>✓</text>
      case "in_progress": return <text fg={theme.warning}>●</text>
      case "blocked": return <text fg={theme.error}>⊘</text>
      default: return <text fg={theme.textMuted}>○</text>
    }
  }
  
  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>Tasks</text>
      <For each={tasks()}>
        {(task) => (
          <box flexDirection="row" gap={1}>
            {statusIcon(task.status)}
            <text fg={theme.text}>{task.id} {task.title}</text>
          </box>
        )}
      </For>
    </box>
  )
}
```

**数据来源**: `sync.data.tasks[sessionID]`

### 4.2 ActorPanel组件

**位置**: `sidebar.tsx` 内容区

**UI设计**:
```
┌────────────────────────────────┐
│ Subagents                      │
├────────────────────────────────┤
│ explore-abc123    ● running    │
│ judge-def456      ✓ idle       │
│ dream-ghi789      ○ pending    │
└────────────────────────────────┘
```

**实现**:
```tsx
// component/panel-actors.tsx
export function ActorPanel(props: { sessionID: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  
  const actors = createMemo(() => {
    const actorMap = sync.data.actors[props.sessionID] ?? {}
    return Object.values(actorMap).filter(a => a.status !== "completed")
  })
  
  const statusColor = (status: string) => {
    switch (status) {
      case "running": return theme.warning
      case "idle": return theme.success
      case "pending": return theme.textMuted
      default: return theme.text
    }
  }
  
  return (
    <Show when={actors().length > 0}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Subagents</text>
        <For each={actors()}>
          {(actor) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>{actor.agent}</text>
              <text fg={statusColor(actor.status)}>{actor.status}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
```

**数据来源**: `sync.data.actors[sessionID]`

### 4.3 TracePanel组件

**位置**: `sidebar.tsx` 内容区

**UI设计**:
```
┌────────────────────────────────────────┐
│ Execution Trace                        │
├────────────────────────────────────────┤
│ ✓ session.prompt (1.2s)                │
│ ├── ✓ llm.stream (800ms)              │
│ │   └── ✓ tool.call (50ms)            │
│ ├── ✓ bash.execute (200ms)            │
│ │   └── ✗ bash.execute (50ms)         │
│ └── ✓ read.execute (100ms)            │
│                                        │
│ Total: 1.2s | 6 events | ✓5 ✗1       │
└────────────────────────────────────────┘
```

**实现**:
```tsx
// component/panel-trace.tsx
export function TracePanel(props: { sessionID: string }) {
  const { theme } = useTheme()
  const sync = useSync()
  
  const traces = createMemo(() => sync.data.traces[props.sessionID] ?? [])
  const tree = createMemo(() => buildTraceTree(traces()))
  
  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>Execution Trace</text>
      <For each={tree()}>
        {(node) => <TraceNode node={node} level={0} />}
      </For>
    </box>
  )
}

function TraceNode(props: { node: TraceNode; level: number }) {
  const { theme } = useTheme()
  const indent = "  ".repeat(props.level)
  const icon = props.node.status === "success" ? "✓" : props.node.status === "failed" ? "✗" : "…"
  
  return (
    <box flexDirection="column">
      <text fg={props.node.status === "failed" ? theme.error : theme.text}>
        {indent}{icon} {props.node.name} ({formatDuration(props.node.duration)})
      </text>
      <For each={props.node.children}>
        {(child) => <TraceNode node={child} level={props.level + 1} />}
      </For>
    </box>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}
```

**数据来源**: `sync.data.traces[sessionID]`

### 4.4 SkillPanel组件

**位置**: `sidebar.tsx` 内容区

**UI设计**:
```
┌────────────────────────────────┐
│ Skills                         │
├────────────────────────────────┤
│ → dream                        │
│ → distill                      │
│ → scriptwriting                │
└────────────────────────────────┘
```

**实现**:
```tsx
// component/panel-skills.tsx
export function SkillPanel() {
  const { theme } = useTheme()
  const sync = useSync()
  
  const skills = createMemo(() => sync.data.skills ?? [])
  
  return (
    <Show when={skills().length > 0}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Skills</text>
        <For each={skills()}>
          {(skill) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>→</text>
              <text fg={theme.text}>{skill.name}</text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}
```

**数据来源**: `sync.data.skills`

### 4.5 AgentPanel组件

**位置**: `sidebar.tsx` 内容区

**UI设计**:
```
┌────────────────────────────────┐
│ Agents                         │
├────────────────────────────────┤
│ ● build                        │
│ ○ ask                          │
│ ○ plan                         │
│ ○ compose                      │
│ ○ max                          │
│ ○ loop                         │
└────────────────────────────────┘
```

**实现**:
```tsx
// component/panel-agents.tsx
export function AgentPanel() {
  const { theme } = useTheme()
  const local = useLocal()
  
  const agents = createMemo(() => local.agent.list().filter(a => !a.hidden))
  const current = createMemo(() => local.agent.current())
  
  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>Agents</text>
      <For each={agents()}>
        {(agent) => (
          <box flexDirection="row" gap={1}>
            <text fg={agent.name === current() ? theme.success : theme.textMuted}>●</text>
            <text fg={agent.name === current() ? theme.text : theme.textMuted}>{agent.name}</text>
          </box>
        )}
      </For>
    </box>
  )
}
```

**数据来源**: `local.agent.list()`

---

## 五、对话框外化

### 5.1 DialogMemory组件

**位置**: 命令面板或独立对话框

**UI设计**:
```
┌────────────────────────────────────────────────────────────────┐
│ 🔍 Memory Search                                    [esc] close│
├────────────────────────────────────────────────────────────────┤
│ Search: [typescript rules_______________________________]      │
├────────────────────────────────────────────────────────────────┤
│ 📄 global/MEMORY.md (score: 0.85)                              │
│    "Always use TypeScript strict mode..."                      │
│                                                                │
│ 📄 projects/abc/MEMORY.md (score: 0.72)                        │
│    "Project uses Bun runtime..."                               │
│                                                                │
│ 📄 sessions/xyz/checkpoint.md (score: 0.65)                    │
│    "Session discussed JWT implementation..."                   │
└────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/dialog-memory.tsx
export function DialogMemory() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<MemoryResult[]>([])
  
  const search = async () => {
    const response = await sdk.client.memory.search({ query: query() })
    setResults(response.data ?? [])
  }
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Memory Search</text>
        <text fg={theme.textMuted} onClick={() => dialog.clear()}>esc</text>
      </box>
      <input value={query()} onInput={(e) => setQuery(e.target.value)} onSubmit={search} />
      <For each={results()}>
        {(result) => (
          <box flexDirection="column" gap={0}>
            <text fg={theme.text}>{result.path} (score: {result.score.toFixed(2)})</text>
            <text fg={theme.textMuted}>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
```

**快捷键**: `/memory` 或 `Ctrl+Shift+M`

### 5.2 DialogHistory组件

**位置**: 命令面板或独立对话框

**UI设计**:
```
┌────────────────────────────────────────────────────────────────┐
│ 📜 History Search                                   [esc] close│
├────────────────────────────────────────────────────────────────┤
│ Search: [authentication_________________________________]      │
├────────────────────────────────────────────────────────────────┤
│ 📝 ses_abc123 - 2026-06-29 (user_text)                         │
│    "Implement user login with JWT"                             │
│                                                                │
│ 📝 ses_def456 - 2026-06-28 (tool_input)                       │
│    "bash: npm install jsonwebtoken"                            │
│                                                                │
│ 📝 ses_ghi789 - 2026-06-27 (assistant_text)                   │
│    "I'll implement the login feature..."                       │
└────────────────────────────────────────────────────────────────┘
```

**实现**:
```tsx
// component/dialog-history.tsx
export function DialogHistory() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<HistoryResult[]>([])
  
  const search = async () => {
    const response = await sdk.client.history.search({ query: query() })
    setResults(response.data ?? [])
  }
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>History Search</text>
        <text fg={theme.textMuted} onClick={() => dialog.clear()}>esc</text>
      </box>
      <input value={query()} onInput={(e) => setQuery(e.target.value)} onSubmit={search} />
      <For each={results()}>
        {(result) => (
          <box flexDirection="column" gap={0}>
            <text fg={theme.text}>{result.sessionID} - {formatDate(result.time)}</text>
            <text fg={theme.textMuted}>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
```

**快捷键**: `/history` 或 `Ctrl+H`

---

## 六、告警外化

### 6.1 CardinalAlert组件

**位置**: `dialog-alert.tsx` 或 Toast

**UI设计**:
```
┌────────────────────────────────────────┐
│ ⚠️ Cardinal Alert: Security Risk       │
├────────────────────────────────────────┤
│ Level: BLOCK                           │
│ Reason: eval/exec detected             │
│ Suggestion: Remove eval() calls        │
│                                        │
│ [Stop] [Ignore]                        │
└────────────────────────────────────────┘
```

**实现**:
```tsx
// component/alert-cardinal.tsx
export function CardinalAlert(props: { 
  level: string
  reason: string
  suggestion?: string
  onStop: () => void
  onIgnore: () => void
}) {
  const { theme } = useTheme()
  
  const levelColors = {
    block: theme.error,
    pause: theme.warning,
    stop: theme.warning,
    warn: theme.textMuted,
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text fg={levelColors[props.level]} attributes={TextAttributes.BOLD}>
        ⚠️ Cardinal Alert: {props.reason}
      </text>
      <text fg={theme.text}>Level: {props.level.toUpperCase()}</text>
      <Show when={props.suggestion}>
        <text fg={theme.textMuted}>Suggestion: {props.suggestion}</text>
      </Show>
      <box flexDirection="row" gap={2}>
        <button onClick={props.onStop}>Stop</button>
        <button onClick={props.onIgnore}>Ignore</button>
      </box>
    </box>
  )
}
```

**数据来源**: `session.cardinal` 事件

### 6.2 AlignmentAlert组件

**位置**: Toast通知

**UI设计**:
```
┌────────────────────────────────────────┐
│ ⚠️ Alignment Alert                     │
├────────────────────────────────────────┤
│ File drift detected: 5 files modified  │
│ Suggestion: Check if on track          │
└────────────────────────────────────────┘
```

**实现**:
```tsx
// 集成到Toast系统
event.on("session.alignment", (evt) => {
  if (evt.properties.sessionID !== route.sessionID) return
  toast.show({
    variant: "warning",
    message: `Alignment: ${evt.properties.reason}`,
    duration: 5000,
  })
})
```

**数据来源**: `session.alignment` 事件

---

## 七、布局集成

### 7.1 完整布局示例

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ OpenCode                                                    [Build] [Goal] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Session: Implement user login                                       │   │
│  │                                                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ > Create a login feature with JWT authentication                │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Assistant: I'll implement the login feature...                  │ │   │
│  │ │                                                                 │ │   │
│  │ │ ┌─ bash ─────────────────────────────────────────────────────┐ │ │   │
│  │ │ │ $ npm install jsonwebtoken                                 │ │ │   │
│  │ │ │ added 3 packages in 2s                                     │ │ │   │
│  │ │ └────────────────────────────────────────────────────────────┘ │ │   │
│  │ │                                                                 │ │   │
│  │ │ ┌─ write ────────────────────────────────────────────────────┐ │ │   │
│  │ │ │ # src/auth/login.ts                                        │ │ │   │
│  │ │ │ export async function login(req, res) { ... }              │ │ │   │
│  │ │ └────────────────────────────────────────────────────────────┘ │ │   │
│  │ │                                                                 │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ > Type a message...                                             │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────┐                                              │
│  │ Implement user login     │                                              │
│  │ ses_abc123               │                                              │
│  │ workspace: my-project    │                                              │
│  ├──────────────────────────┤                                              │
│  │ Tasks                    │                                              │
│  │ T1 ● Implement login     │                                              │
│  │ T1.1 ○ Create API        │                                              │
│  │ T1.2 ○ Add JWT           │                                              │
│  │ T2 ✓ Setup database      │                                              │
│  ├──────────────────────────┤                                              │
│  │ Subagents                │                                              │
│  │ explore-abc ● running    │                                              │
│  ├──────────────────────────┤                                              │
│  │ Trace                    │                                              │
│  │ ✓ session (1.2s)         │                                              │
│  │ ├── ✓ llm (800ms)       │                                              │
│  │ └── ✓ bash (200ms)      │                                              │
│  ├──────────────────────────┤                                              │
│  │ Skills                   │                                              │
│  │ → dream                  │                                              │
│  │ → distill                │                                              │
│  ├──────────────────────────┤                                              │
│  │ Agents                   │                                              │
│  │ ● build                  │                                              │
│  │ ○ ask                    │                                              │
│  │ ○ plan                   │                                              │
│  ├──────────────────────────┤                                              │
│  │ OpenCode v1.17.11        │                                              │
│  └──────────────────────────┘                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ /path/to/project   Build • Goal: Create login • 12.5K/1M tokens           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Sidebar显示逻辑

```typescript
// session/index.tsx
const wide = createMemo(() => dimensions().width > 120)
const sidebarVisible = createMemo(() => {
  if (session()?.parentID) return false      // 子会话不显示
  if (sidebarOpen()) return true             // 手动打开则显示
  if (sidebar() === "auto" && wide()) return true  // auto模式 + 宽度>120则显示
  return false                               // 否则不显示
})
```

**默认行为**:
- 终端宽度 > 120字符: 自动显示
- 终端宽度 ≤ 120字符: 不显示
- 子会话: 不显示
- 手动打开: 显示

---

## 八、数据来源映射

### 8.1 数据源

| 数据 | 来源 | 说明 |
|------|------|------|
| **Mode** | `local.agent.current()` | 当前模式 |
| **Goal** | `sync.data.session.goal` | 当前目标 |
| **Tokens** | `sync.data.session.tokensUsed` | Token使用量 |
| **Tasks** | `sync.data.tasks[sessionID]` | 任务列表 |
| **Actors** | `sync.data.actors[sessionID]` | 子智能体列表 |
| **Traces** | `sync.data.traces[sessionID]` | 执行追踪 |
| **Skills** | `sync.data.skills` | 可用技能列表 |
| **Agents** | `local.agent.list()` | 可用Agent列表 |

### 8.2 事件监听

| 事件 | 说明 | 处理 |
|------|------|------|
| **session.cardinal** | Cardinal告警 | 显示CardinalAlert |
| **session.alignment** | Alignment告警 | 显示Toast |
| **task.status** | 任务状态变更 | 更新TaskPanel |
| **actor.status** | Actor状态变更 | 更新ActorPanel |
| **trace.event** | Trace事件 | 更新TracePanel |

---

## 九、快捷键映射

### 9.1 Mode相关

| 快捷键 | 功能 |
|--------|------|
| `/mode` | 打开Mode切换对话框 |
| `Ctrl+M` | 快速切换Mode |

### 9.2 搜索相关

| 快捷键 | 功能 |
|--------|------|
| `/memory` | 打开Memory搜索 |
| `Ctrl+Shift+M` | 快速打开Memory搜索 |
| `/history` | 打开History搜索 |
| `Ctrl+H` | 快速打开History搜索 |

### 9.3 面板相关

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+B` | 切换Sidebar显示 |
| `Ctrl+T` | 切换Task面板 |
| `Ctrl+A` | 切换Actor面板 |

---

## 十、实施计划

### 10.1 优先级排序

| 优先级 | 组件 | 位置 | 预计工时 |
|--------|------|------|----------|
| **P0** | ModeIndicator | footer.tsx | 0.5天 |
| **P0** | GoalIndicator | footer.tsx | 0.5天 |
| **P0** | TokenIndicator | footer.tsx | 0.5天 |
| **P0** | TaskPanel | sidebar.tsx | 1天 |
| **P0** | ActorPanel | sidebar.tsx | 1天 |
| **P1** | TracePanel | sidebar.tsx | 1.5天 |
| **P1** | CardinalAlert | dialog系统 | 1天 |
| **P1** | MemoryDialog | 命令面板 | 1天 |
| **P1** | HistoryDialog | 命令面板 | 1天 |
| **P1** | DialogMode | 命令面板 | 0.5天 |
| **P2** | SkillPanel | sidebar.tsx | 0.5天 |
| **P2** | AgentPanel | sidebar.tsx | 0.5天 |
| **P2** | AlignmentAlert | Toast系统 | 0.5天 |

**总计**: 约9.5天

### 10.2 实施顺序

**第一批 (P0 - 核心指标)**: 2.5天
1. ModeIndicator
2. GoalIndicator
3. TokenIndicator

**第二批 (P0 - 核心面板)**: 2天
4. TaskPanel
5. ActorPanel

**第三批 (P1 - 高级面板)**: 3.5天
6. TracePanel
7. CardinalAlert
8. MemoryDialog
9. HistoryDialog
10. DialogMode

**第四批 (P2 - 补充面板)**: 1.5天
11. SkillPanel
12. AgentPanel
13. AlignmentAlert

---

## 十一、验收标准

### 11.1 功能验收

| 组件 | 验收标准 |
|------|----------|
| **ModeIndicator** | 显示当前模式，颜色正确 |
| **GoalIndicator** | 显示当前目标，状态正确 |
| **TokenIndicator** | 显示token使用量，格式正确 |
| **TaskPanel** | 显示任务列表，状态正确 |
| **ActorPanel** | 显示子智能体列表，状态正确 |
| **TracePanel** | 显示执行追踪树，格式正确 |
| **CardinalAlert** | 显示Cardinal告警，交互正确 |
| **MemoryDialog** | 搜索记忆，结果正确 |
| **HistoryDialog** | 搜索历史，结果正确 |
| **DialogMode** | 切换模式，交互正确 |
| **SkillPanel** | 显示技能列表 |
| **AgentPanel** | 显示Agent列表 |

### 11.2 性能验收

| 指标 | 目标 |
|------|------|
| **首次渲染** | < 100ms |
| **数据更新** | < 50ms |
| **内存占用** | < 50MB |
| **CPU占用** | < 5% |

### 11.3 兼容性验收

| 环境 | 要求 |
|------|------|
| **终端宽度** | 支持80-200字符 |
| **终端高度** | 支持24-50行 |
| **操作系统** | macOS, Linux, Windows |
| **终端类型** | iTerm2, Terminal.app, Windows Terminal |

---

## 十二、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **数据同步延迟** | 中 | 使用solid-js信号，实时更新 |
| **性能问题** | 中 | 使用虚拟滚动，懒加载 |
| **兼容性问题** | 低 | 使用标准终端API |
| **用户体验** | 中 | 提供配置选项，支持自定义 |

---

## 十三、附录

### 13.1 参考文件

- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` - 会话主界面
- `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx` - 侧边栏
- `packages/opencode/src/cli/cmd/tui/routes/session/footer.tsx` - 底部状态栏
- `packages/opencode/src/cli/cmd/tui/component/dialog-agent.tsx` - Agent对话框
- `packages/opencode/src/cli/cmd/tui/component/dialog-model.tsx` - Model对话框
- `packages/opencode/src/cli/cmd/tui/config/index.tsx` - 配置系统

### 13.2 相关文档

- TRANSFORM_PLAN.md - 迁移计划
- Helix TUI架构文档
- SolidJS文档

---

*本文档基于 Helix 项目实际代码审查，确保描述与代码实现一致。如有架构更新，需同步更新本文档。*
