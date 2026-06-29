# HelixAgent 自动开发能力集成规划

> 将 Helix 项目中已验证的自动开发（auto-dev）能力集成到 HelixAgent，作为 Helix Agent 的核心能力
> 创建日期: 2026-06-29
> 最后更新: 2026-06-29
> 状态: 规划中

---

## 一、现状对比

| 维度 | HelixAgent（目标） | Helix（源） |
|------|-------------------|-------------|
| Effect 服务 | 仅 `Scheduler`（`selectTasks` / `formatBudget`） | 7 个完整服务：`auto-dev-workflow`、`pipeline-runner`、`requirement-analyzer`、`complexity-estimator`、`token-scheduler`、`progress-tracker` |
| 配置体系 | 无 `.mimocode/` | `.mimocode/roadmap.json` + `mimocode.jsonc` |
| CLI 命令 | 无 auto-dev 命令 | `auto-dev analyze / run / budget / usage / report` |
| 外部脚本 | 无 `script/auto-dev/` | `script/auto-dev/`（scheduler、judge、spec-converter、setup.sh 等） |
| OpenSpec | 无 | `openspec/specs/` + spec-converter |
| 定时调度 | 无 | launchd（daily 14:00） |
| 通知 | 无 | 飞书网关 |

---

## 二、集成架构

```
packages/opencode/src/
├── automation/                    ← 新建目录（6 个 Effect 服务）
│   ├── index.ts                   ← barrel export
│   ├── auto-dev-workflow.ts       ← 主编排器：分析 → 调度 → 执行 → 验证
│   ├── pipeline-runner.ts         ← 质量流水线：build → typecheck → test → lint → judge → git
│   ├── requirement-analyzer.ts    ← 项目分析 + 需求识别
│   ├── complexity-estimator.ts    ← Token 估算
│   ├── token-scheduler.ts         ← 预算感知的任务调度
│   └── progress-tracker.ts        ← 进度报告生成
│
├── config/
│   ├── mimocode.ts               ← 新建：读取 .mimocode/mimocode.jsonc
│   └── roadmap.ts                ← 新建：读取/写入 .mimocode/roadmap.json
│
├── cli/cmd/
│   └── auto-dev.ts               ← 新建 CLI 命令入口
│
script/auto-dev/                   ← 新建目录（外部脚本）
├── scheduler.ts                   ← 主调度器 CLI（launchd 入口）
├── judge-enhanced.ts              ← 增强 Judge 审查
├── spec-converter.ts              ← OpenSpec → roadmap 转换
├── spec-writer.ts                 ← 写回 spec 实现状态
├── setup.sh                       ← launchd 安装/卸载
└── launchd-wrapper.sh             ← launchd 包装脚本

.mimocode/                         ← 项目级配置（每个项目独立）
├── roadmap.json                   ← 任务清单 + 自动开发配置
├── mimocode.jsonc                 ← 核心配置（dream/distill/权限等）
├── skills/                        ← 技能定义
├── command/                       ← 自定义命令
└── plans/                         ← 执行计划
```

---

## 三、实施步骤

### Phase 0：前置工作（0.5 天）

**目标**：修复 HelixAgent 与 Helix automation 模块之间的接口差异。

| 任务 | 说明 |
|------|------|
| 补充 `TokenTracker.getUsageStats()` | HelixAgent 当前只有 3 个方法；`progress-tracker.ts` 需要 `getUsageStats(days)` |
| 确认 build.ts 参数 | Helix 使用 `--single`，HelixAgent 的 `package.json` 未声明该参数 |
| 确认 `@/storage` 的 `Database.use` 模式 | `complexity-estimator.ts` 的 `calibrateFromHistory()` 依赖该模式 |

### Phase 1：核心 Effect 服务迁移（2.5 天）

**目标**：把 Helix 的 6 个 automation 服务移植到 HelixAgent，适配已有架构。

| 源文件（Helix） | 目标文件（HelixAgent） | 改动要点 |
|---|---|---|
| `src/automation/requirement-analyzer.ts` | 同路径 | 复用 HelixAgent 已有的 `@/task/schema` |
| `src/automation/complexity-estimator.ts` | 同路径 | 移除 `TokenUsageTable` 和 `Database.use`（或改为内存实现） |
| `src/automation/token-scheduler.ts` | 同路径 | 依赖 requirement-analyzer 和 complexity-estimator |
| `src/automation/auto-dev-workflow.ts` | 同路径 | 移除未使用的 `Bus` 依赖；改用 `Effect.log*` 替代 `Log.create`；从 roadmap 而非 `Config.token_budget` 读取预算 |
| `src/automation/pipeline-runner.ts` | 同路径 | 调整 build/test/lint 命令以匹配 HelixAgent 的 package.json |
| `src/automation/progress-tracker.ts` | 同路径 | 适配 `TokenTracker.getUsageStats()` 接口 |

**修改的已有文件**：
- `src/effect/app-runtime.ts` — 添加 6 个新服务的 import 和 `AppLayer` 注册
- `src/scheduler/scheduler.ts` — 决定是否保留或合并到 `token-scheduler`

### Phase 2：配置体系（1.5 天）

**目标**：建立 `.mimocode/` 配置读取能力。

**新建文件**：
- `src/config/mimocode.ts` — Mimocode 配置服务
  - 读取 `.mimocode/mimocode.jsonc`
  - 提供 `dream.auto`、`distill.auto`、`memory.vector.enabled` 等配置
- `src/config/roadmap.ts` — Roadmap 读写服务
  - `loadRoadmap()` 读取 `.mimocode/roadmap.json`
  - `saveTaskStatus(taskId, status)` 更新任务状态
  - `getNextTask()` 基于优先级 + 预算选择下一个任务
  - `getAutoDevConfig()` 读取 `auto_dev_config`

**HelixAgent 项目根目录配置模板**：
```json
{
  "version": "1.0",
  "project": "HelixAgent",
  "milestones": [],
  "current_focus": "M1",
  "auto_dev_config": {
    "enabled": false,
    "daily_token_limit": 20000000,
    "preferred_complexity": ["simple", "moderate"],
    "focus_milestones": ["M1"],
    "skip_tags": ["experimental"]
  }
}
```

### Phase 3：Session 内执行集成（2 天）

**目标**：让自动开发任务通过 opencode 的 Session 机制执行。

**核心设计**：
```ts
const executeTask = Effect.fn("AutoDevWorkflow.executeTask")(function* (task) {
  const session = yield* Session.Service
  const prompt = yield* SessionPrompt.Service

  const autoSession = yield* session.create({
    title: `Auto: ${task.requirement.title}`,
    agent: "build",
  })

  yield* prompt.prompt({
    sessionID: autoSession.id,
    agent: "build",
    parts: [{ type: "text", text: task.requirement.description }],
  })
})
```

**注意**：正确入口是 `SessionPrompt.prompt()`，不是 `SessionProcessor.process()`（后者是内部方法）。

**修改的已有文件**：
- `src/session/processor.ts` — 添加 auto-dev 任务完成后的回调（可选）
- `src/session/prompt.ts` — auto-dev session 的任务完成后自动触发 pipeline 验证

### Phase 4：CLI 命令（1 天）

**目标**：添加 `opencode auto-dev` CLI 命令入口。

**新建文件**：`src/cli/cmd/auto-dev.ts`

```
opencode auto-dev analyze          # 分析项目，生成/更新 roadmap
opencode auto-dev run              # 执行一轮自动开发
opencode auto-dev run --once       # 执行单个任务
opencode auto-dev run --dry-run    # 干跑
opencode auto-dev budget           # 查看 token 预算
opencode auto-dev usage            # 查看 token 使用统计
opencode auto-dev report           # 生成进度报告
opencode auto-dev status           # 查看当前自动开发状态
opencode auto-dev pause            # 暂停
opencode auto-dev resume           # 恢复
```

**修改的已有文件**：
- `src/cli/cmd/cmd.ts` — 注册 `auto-dev` 子命令

### Phase 5：外部脚本 + launchd（1 天）

**目标**：添加定时调度能力，支持无人值守运行。

**新建文件**：
- `script/auto-dev/scheduler.ts` — 主调度器 CLI
- `script/auto-dev/judge-enhanced.ts` — 增强 Judge
- `script/auto-dev/setup.sh` — launchd 安装/卸载
- `script/auto-dev/launchd-wrapper.sh` — launchd 包装脚本

**launchd plist**（`~/Library/LaunchAgents/com.helix-agent.auto-dev.plist`）：
```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>14</integer>
  <key>Minute</key><integer>0</integer>
</dict>
```

### Phase 6：OpenSpec 集成（1 天）

**目标**：支持从 spec 文件自动生成 roadmap 任务。

**新建文件**：
- `script/auto-dev/spec-converter.ts` — 扫描 `openspec/specs/*/spec.md`
- `script/auto-dev/spec-writer.ts` — 写回 spec 实现状态
- `openspec/` 目录结构（根据项目需要）

### Phase 7：Dream/Distill 集成（0.5 天）

**目标**：自动记忆整理和工作流打包。

**已有基础**：HelixAgent 已有 `src/session/auto-dream.ts`（判断逻辑）。

**需要补充**：
- 在 `prompt.ts` 的 auto-dream/distill 触发点实际执行 agent
- 通过 `src/config/mimocode.ts` 读取 `dream.auto` / `distill.auto`

---

## 四、依赖关系

```
Phase 0: 前置工作（TokenTracker 接口 + build 命令 + storage 模式）
    │
    ├──→ Phase 1: Effect 服务迁移
    │        │
    │        ├──→ Phase 2: 配置体系
    │        │        │
    │        │        └──→ Phase 3: Session 集成
    │        │                 │
    │        │                 └──→ Phase 4: CLI 命令
    │        │
    │        └──→ Phase 5: 外部脚本 + launchd
    │
    └──→ Phase 6: OpenSpec（依赖 Phase 2）
    │
    └──→ Phase 7: Dream/Distill（依赖 Phase 2）
```

---

## 五、工时估算

| Phase | 工时 | 复杂度 |
|-------|------|--------|
| Phase 0: 前置工作 | 0.5 天 | 低 |
| Phase 1: Effect 服务迁移 | 2.5 天 | 中 |
| Phase 2: 配置体系 | 1.5 天 | 中 |
| Phase 3: Session 集成 | 2 天 | 高 |
| Phase 4: CLI 命令 | 1 天 | 低 |
| Phase 5: 外部脚本 + launchd | 1 天 | 中 |
| Phase 6: OpenSpec | 1 天 | 中 |
| Phase 7: Dream/Distill | 0.5 天 | 低 |
| **总计** | **10 天** | |

---

## 六、关键风险点

| 风险 | 说明 | 缓解方案 |
|------|------|---------|
| `TokenTracker` 接口不足 | HelixAgent 缺少 `getUsageStats()` | Phase 0 补充 |
| `Config.Info` 缺少 `token_budget` | 自动化预算无法从 `Config.Service` 读取 | 预算配置放到 `roadmap.json` 的 `auto_dev_config` 中 |
| `token.sql.ts` 不存在 | `complexity-estimator` 的 `calibrateFromHistory()` 无法持久化查询 | 改为从内存 TokenTracker 统计，或暂时移除该功能 |
| `Log` 工具不存在 | Helix 的 `Log.create()` 在 HelixAgent 中不存在 | 迁移时替换为 `Effect.logInfo/Error` |
| Build 命令差异 | `--single` 参数可能不支持 | Phase 0 确认 build.ts 参数 |
| Session 自动 commit 权限 | 自动 git commit + push 需要身份认证 | 依赖用户本地 git config / SSH agent |
| Session 并发 | auto-dev 创建独立 Session，可能与用户 Session 竞争资源 | 限制并发数、配置执行时段 |

---

## 七、待决策事项

1. **是否保留现有 `src/scheduler/scheduler.ts`？**
   - 方案 A：保留，作为 `token-scheduler` 的底层工具
   - 方案 B：废弃，用 `token-scheduler` 完全替代

2. **OpenSpec 目录是否必须？**
   - 方案 A：作为 Phase 6 一部分创建 `openspec/specs/`
   - 方案 B：先支持 roadmap.json 中的 `specPath`，不强制目录结构

3. **通知渠道是否保留飞书？**
   - 方案 A：移植飞书网关（增加外部依赖）
   - 方案 B：先用日志/本地通知，后续再加通知插件

---

## 八、下一步建议

1. 确认 Phase 0 的前置工作清单
2. 开始 Phase 1：迁移 6 个 Effect 服务
3. 优先完成 `TokenTracker.getUsageStats()` 补充，因为它是多个服务的依赖
