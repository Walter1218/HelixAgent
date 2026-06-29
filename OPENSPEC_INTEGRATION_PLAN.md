# HelixAgent OpenSpec 集成规划

> 将 OpenSpec 作为 HelixAgent 的独立核心能力：用结构化需求契约连接设计、实现与验证
> 创建日期: 2026-06-29
> 最后更新: 2026-06-29
> 状态: 规划中

---

## 一、为什么 HelixAgent 需要 OpenSpec

### 1.1 当前问题

HelixAgent 已经经历过一次"死代码激活"（`DEAD_CODE_ACTIVATION_PLAN.md`）：16 个模块被设计出来，但部分模块长期未接入主链路。这个问题暴露了一个模式：

- 设计意图散落在 LLM 对话、Issue、代码注释中
- 模块是否"真正完成"只能靠人工判断
- "注册了 Layer"容易被误认为"集成完成"
- 新增模块时容易重复产生死代码

### 1.2 OpenSpec 的核心价值

OpenSpec 不是文档格式，而是一个**设计→实现→验证的闭环机制**：

| 环节 | 能力 | 解决的问题 |
|------|------|-----------|
| 设计 | 用 markdown 写结构化需求 | 设计意图持久化 |
| 解析 | 机器读取 `### Requirement` 块 | 需求可自动化处理 |
| 任务化 | spec-converter 生成 roadmap 任务 | 设计可直接执行 |
| 验证 | judge 对比实现与 spec | 自动检测"两层集成"陷阱 |
| 写回 | spec-writer 更新实现状态 | 文档与代码同步 |

对 HelixAgent 而言，OpenSpec 的最大价值是**防止再次产生死代码**。

---

## 二、集成架构

```
packages/opencode/src/
├── openspec/                      ← 新建 Effect 服务目录
│   ├── spec.ts                    ← Spec 解析服务
│   ├── judge.ts                   ← Spec 驱动的 Judge 检查
│   └── index.ts                   ← barrel export
│
cli/
├── cmd/
│   └── spec.ts                    ← CLI 命令（list/show/verify/convert/update）
│
script/openspec/                   ← 新建脚本目录
├── spec-converter.ts              ← OpenSpec → roadmap.json
└── spec-writer.ts                 ← 写回 spec 实现状态

openspec/                          ← 新建项目级目录（与根目录 specs/ 不同）
├── specs/
│   ├── auto-dev/
│   │   └── spec.md
│   ├── cardinal-integration/
│   │   └── spec.md
│   └── deployment/
│       └── spec.md
└── README.md
```

**注意**：HelixAgent 根目录已有 `specs/` 目录（存放 V2 架构文档等），OpenSpec 目录使用 `openspec/` 以避免冲突。两者用途不同：
- `specs/`：项目架构设计文档
- `openspec/`：需求契约与验证文档（可机器解析）

---

## 三、Spec 文件格式

### 3.1 最小 Spec 结构

每个 spec.md 必须包含：

```markdown
# Spec: Cardinal 集成

## Overview

Cardinal 是一个预算/风险控制系统，需要在 tool 调用前评估是否 block/pause/warn/stop。

## Requirements

### Requirement 1: Cardinal Service 定义

- **Acceptance Criteria**:
  - `src/session/cardinal.ts` 中存在 `Context.Service`
  - 暴露 `evaluate(input)` 方法
- **Verification**: grep "Context.Service.*Cardinal" src/session/cardinal.ts
- **Status**: implemented

### Requirement 2: Cardinal 在 app-runtime.ts 中注册

- **Acceptance Criteria**:
  - `Cardinal.defaultLayer` 出现在 `AppLayer` 中
- **Verification**: grep "Cardinal.defaultLayer" src/effect/app-runtime.ts
- **Status**: implemented

### Requirement 3: processor.ts 在 tool 调用前调用 Cardinal

- **Acceptance Criteria**:
  - `processor.ts` 中 `case "tool-call"` 分支调用 `cardinal.evaluate()`
  - block 时调用 `failToolCall`
  - pause 时触发权限确认
- **Verification**: AST 检查或 grep "cardinal.evaluate"
- **Status**: implemented

## Implementation Notes

...（可选的设计说明）
```

### 3.2 Status 字段约定

- `pending` — 尚未实现
- `in_progress` — 正在实现
- `implemented` — 已通过验证
- `failed` — 实现失败或不符合要求

### 3.3 Verification 字段类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `grep` | 检查文件中是否包含模式 | `grep "cardinal.evaluate" src/session/processor.ts` |
| `ast` | AST 检查函数调用关系 | `ast.hasCall("processor.ts", "cardinal.evaluate")` |
| `test` | 运行指定测试 | `bun test test/cardinal.test.ts` |
| `script` | 运行验证脚本 | `bun run script/verify-cardinal.ts` |
| `manual` | 需要人工确认 | 暂无 |

---

## 四、核心组件设计

### 4.1 Spec 解析服务（Effect Service）

文件：`packages/opencode/src/openspec/spec.ts`

```ts
export interface SpecRequirement {
  id: string
  title: string
  description: string
  acceptanceCriteria: string[]
  verification: {
    type: "grep" | "ast" | "test" | "script" | "manual"
    target: string
  }
  status: "pending" | "in_progress" | "implemented" | "failed"
}

export interface SpecDoc {
  title: string
  overview: string
  filePath: string
  requirements: SpecRequirement[]
}

export interface Interface {
  readonly parseSpecFile: (path: string) => Effect.Effect<SpecDoc>
  readonly parseAllSpecs: (dir: string) => Effect.Effect<SpecDoc[]>
  readonly findSpecForTask: (taskDescription: string, specs: SpecDoc[]) => Effect.Effect<SpecDoc | null>
  readonly checkRequirement: (req: SpecRequirement) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpec") {}
```

#### 实现要点

- 用 `FileSystem.FileSystem` 读取 markdown 文件
- 用正则解析 `### Requirement N: Title` 块
- 解析 `**Status**: ...` 和 `**Verification**: ...`
- 对 `grep` 类型 verification，使用 `ChildProcess` 执行命令
- 对 `ast` 类型，调用 `AST.Service` 分析
- 对 `test` 类型，调用测试运行器

### 4.2 Spec 驱动的 Judge 检查

文件：`packages/opencode/src/openspec/judge.ts`

```ts
export interface SpecJudgeInput {
  specPath: string
  diff: string
  changedFiles: string[]
}

export interface SpecJudgeResult {
  approved: boolean
  implementedRequirements: string[]
  missingRequirements: string[]
  issues: string[]
  suggestions: string[]
}

export interface Interface {
  readonly judgeSpecCompliance: (input: SpecJudgeInput) => Effect.Effect<SpecJudgeResult>
}
```

#### 集成点

当前 HelixAgent 没有 `judge-enhanced.ts`，但有 Cardinal 在 `processor.ts` 中做风险判断。OpenSpec Judge 的集成位置建议：

1. **Pipeline-runner 集成**（如果 auto-dev 完成后有 pipeline）
2. **独立 CLI 命令**：`opencode spec verify --spec openspec/specs/cardinal-integration/spec.md`
3. **Prompt post-processing**：在 `prompt.ts` runLoop 末尾，对本次 session 的变更做 spec 合规检查

**推荐先实现 CLI 命令**，最独立、最可控。

### 4.3 Spec → Roadmap 转换脚本

文件：`script/openspec/spec-converter.ts`

```ts
// 扫描 openspec/specs/*/spec.md
// 提取 requirements，生成 roadmap.json 中的任务
// 每个 requirement 变成一个 task（或一组 task）
```

输出示例：

```json
{
  "milestones": [
    {
      "id": "M_SPEC",
      "name": "OpenSpec 驱动任务",
      "status": "in_progress",
      "tasks": [
        {
          "id": "SPEC-CARDINAL-R1",
          "title": "[Spec] Cardinal Service 定义",
          "description": "来自 openspec/specs/cardinal-integration/spec.md",
          "status": "pending",
          "specPath": "openspec/specs/cardinal-integration/spec.md",
          "specRequirementId": "Requirement 1"
        }
      ]
    }
  ]
}
```

### 4.4 Spec 状态写回脚本

文件：`script/openspec/spec-writer.ts`

```ts
// 输入: specPath, requirementId, status
// 更新 spec.md 中对应 requirement 的 Status 字段
// 保留 markdown 格式
```

**注意**：写回时必须保持 markdown 其他内容不变，只替换 Status 行。

---

## 五、CLI 命令

```
opencode spec list                      # 列出所有 spec 和状态
opencode spec show <spec-name>          # 显示单个 spec 详情
opencode spec verify <spec-name>        # 验证实现是否符合 spec
opencode spec verify --all              # 验证所有 spec
opencode spec convert                   # 将 spec 转换为 roadmap 任务
opencode spec update <spec-name> --req <id> --status implemented
```

**实现位置**：`packages/opencode/src/cli/cmd/spec.ts`

---

## 六、与现有模块的关系

### 6.1 与 auto-dev 的关系

OpenSpec 和 auto-dev 是**正交能力**：

- **没有 auto-dev 时**：OpenSpec 提供 `opencode spec verify` 命令，手动验证实现
- **有 auto-dev 时**：auto-dev 读取 OpenSpec 生成的 roadmap 任务，执行后自动调用 spec-writer 更新状态

### 6.2 与四个死代码模块的关系

四个模块（AST、Evolution、Team、Workflow）的集成状态，可以用 OpenSpec 来验证：

```markdown
openspec/specs/dead-code-main-chain/spec.md
  - Requirement 1: AST 在 processor.ts 中被调用
  - Requirement 2: Evolution 在 prompt.ts 中被调用
  - Requirement 3: Team 在 actor.ts/task.ts 中被调用
  - Requirement 4: Workflow 在 prompt.ts 中被调用
```

这可以反向验证 `DEAD_CODE_MAIN_CHAIN_INTEGRATION_PLAN.md` 的完成度。

### 6.3 与 Cardinal/Judge 的关系

OpenSpec Judge 可以作为 Cardinal 的补充：
- Cardinal 负责**运行时风险阻断**（block/pause/warn）
- OpenSpec Judge 负责**实现后合规验证**（是否满足需求契约）

---

## 七、实施步骤

### Phase 1：Spec 解析服务（1 天）

1. 新建 `packages/opencode/src/openspec/spec.ts`
2. 实现 `parseSpecFile`、`parseAllSpecs`、`findSpecForTask`
3. 实现 `checkRequirement`（先做 `grep` 和 `test` 类型）
4. 在 `app-runtime.ts` 注册 `OpenSpec.defaultLayer`
5. 新建 `packages/opencode/src/cli/cmd/spec.ts`，实现 `list` / `show` / `verify`

### Phase 2：Judge 集成（1 天）

1. 新建 `packages/opencode/src/openspec/judge.ts`
2. 实现 `judgeSpecCompliance`
3. 对 `ast` 类型 verification，调用 `AST.Service`
4. 添加 `opencode spec verify --all` 命令

### Phase 3：Spec → Roadmap 转换（0.5 天）

1. 新建 `script/openspec/spec-converter.ts`
2. 扫描 `openspec/specs/*/spec.md`
3. 生成 roadmap.json 的 `M_SPEC` milestone

### Phase 4：状态写回（0.5 天）

1. 新建 `script/openspec/spec-writer.ts`
2. 支持更新 requirement 的 Status 字段
3. 保持 markdown 格式

### Phase 5：示例 Spec（0.5 天）

1. 新建 `openspec/README.md`
2. 为 Cardinal 集成写一个示例 spec
3. 为四个死代码模块写一个验证 spec

---

## 八、工时估算

| Phase | 工时 | 复杂度 |
|-------|------|--------|
| Phase 1: Spec 解析服务 + CLI | 1 天 | 中 |
| Phase 2: Judge 集成 | 1 天 | 中 |
| Phase 3: Spec → Roadmap 转换 | 0.5 天 | 低 |
| Phase 4: 状态写回 | 0.5 天 | 低 |
| Phase 5: 示例 Spec | 0.5 天 | 低 |
| **总计** | **3.5 天** | |

---

## 九、风险与缓解

| 风险 | 说明 | 缓解 |
|------|------|------|
| Spec 格式不统一 | 多人写 spec 时格式可能不一致 | 提供 spec 模板和 lint 脚本 |
| Verification 命令跨平台 | grep/ast/test 命令在不同环境表现不同 | 优先用 Node/Bun 脚本替代 shell 命令 |
| Spec 与代码不同步 | 代码改了但 spec 没更新 | 把 spec verify 加入 CI / auto-dev 流水线 |
| 过度文档化 | 简单功能也写 spec，增加负担 | 只对复杂模块、核心能力写 spec |

---

## 十、验收标准

1. `opencode spec list` 能列出 `openspec/specs/` 下所有 spec
2. `opencode spec verify <spec>` 能正确判断每个 requirement 是否实现
3. `script/openspec/spec-converter.ts` 能生成正确的 roadmap.json
4. `script/openspec/spec-writer.ts` 能更新 spec.md 中的 Status 字段且不破坏格式
5. 新增模块时，团队能用 OpenSpec 验证其是否真正集成（而不是只看 Layer 注册）

---

## 十一、最小可行方案（MVP）

如果资源有限，只做 Phase 1 + Phase 5：

1. 实现 spec 解析服务和 `opencode spec list/show/verify`
2. 写 2-3 个示例 spec（Cardinal、AST、Workflow）

这样 OpenSpec 立刻能产生价值：每次开发新模块后，运行 `opencode spec verify` 检查是否真正完成。
