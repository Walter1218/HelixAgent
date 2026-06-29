// TUI集成脚本 - 将外化组件集成到现有TUI
// 这个文件展示了如何将所有外化组件集成到现有的TUI页面中

// ============================================================
// 1. Footer集成 - 在session页面底部显示Mode/Goal/Token
// ============================================================

// 在 session/index.tsx 的 return 语句中，footer部分应该包含：
// <FooterWithIndicators
//   mode={local.agent.current()?.name}
//   goal={sync.data.session?.goal?.condition}
//   tokensUsed={sync.data.session?.tokensUsed}
//   tokenBudget={sync.data.config?.tokenBudget?.daily}
// />

// ============================================================
// 2. Sidebar集成 - 在session页面右侧显示Tasks/Actors/Trace/Skills/Agents
// ============================================================

// 在 session/index.tsx 的 sidebar部分应该包含：
// <SidebarWithPanels
//   tasks={Object.values(sync.data.tasks[sessionID] ?? {})}
//   actors={Object.values(sync.data.actors[sessionID] ?? {}).filter(a => a.status !== "completed")}
//   traces={sync.data.traces[sessionID] ?? []}
//   skills={sync.data.skills ?? []}
//   agents={local.agent.list()}
//   currentAgent={local.agent.current()?.name}
// />

// ============================================================
// 3. Mode切换 - 在首页和session页面支持Tab切换所有模式
// ============================================================

// 已在 agent.ts 中添加了所有primary模式的agent定义
// 现在Tab键可以在 ask → build → plan → compose → loop 之间切换

// ============================================================
// 4. Dialog集成 - 通过命令面板访问
// ============================================================

// 在 app.tsx 的命令列表中添加：
// {
//   name: "mode.switch",
//   title: "Switch mode",
//   slashName: "mode",
//   run: () => dialog.replace(() => <DialogMode current={local.agent.current()?.name} />),
//   category: "Mode",
// },
// {
//   name: "memory.search",
//   title: "Search memory",
//   slashName: "memory",
//   run: () => dialog.replace(() => <DialogMemory onSearch={...} />),
//   category: "Memory",
// },
// {
//   name: "history.search",
//   title: "Search history",
//   slashName: "history",
//   run: () => dialog.replace(() => <DialogHistory onSearch={...} />),
//   category: "History",
// }

// ============================================================
// 5. Alert集成 - 通过事件监听显示
// ============================================================

// 在 session/index.tsx 中添加事件监听：
// event.on("session.cardinal", (evt) => {
//   if (evt.properties.sessionID !== route.sessionID) return
//   dialog.replace(() => <CardinalAlert {...evt.properties} />)
// })
//
// event.on("session.alignment", (evt) => {
//   if (evt.properties.sessionID !== route.sessionID) return
//   toast.show({
//     variant: "warning",
//     message: `Alignment: ${evt.properties.reason}`,
//     duration: 5000,
//   })
// })

// ============================================================
// 6. 快捷键集成
// ============================================================

// 在 keybind.ts 中添加：
// mode_switch: keybind("ctrl+m", "Switch mode"),
// memory_search: keybind("ctrl+shift+m", "Search memory"),
// history_search: keybind("ctrl+h", "Search history")

export const INTEGRATION_GUIDE = `
TUI外化集成指南
===============

1. Footer集成
   - 文件: session/index.tsx
   - 组件: FooterWithIndicators
   - 位置: 页面底部

2. Sidebar集成
   - 文件: session/index.tsx
   - 组件: SidebarWithPanels
   - 位置: 页面右侧

3. Mode切换
   - 文件: agent.ts (已完成)
   - 支持: ask, build, plan, compose, loop

4. Dialog集成
   - 文件: app.tsx
   - 组件: DialogMode, DialogMemory, DialogHistory
   - 触发: 命令面板或快捷键

5. Alert集成
   - 文件: session/index.tsx
   - 组件: CardinalAlert, AlignmentAlert
   - 触发: 事件监听

6. 快捷键
   - Ctrl+M: 切换模式
   - Ctrl+Shift+M: 搜索记忆
   - Ctrl+H: 搜索历史
`
