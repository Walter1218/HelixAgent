# HelixAgent 整改方案 — 确保任务顺利高质量交付

> 创建日期: 2026-06-30
> 状态: 执行中

---

## 一、问题诊断

### 1.1 当前核心问题

| 问题 | 表现 | 根因 |
|------|------|------|
| **文档与代码脱节** | 文档说"已完成"，实际部分模块未接入主链路 | 文档更新先于代码验证，没有"做完再写"的纪律 |
| **注册≠集成** | 8 个服务注册到 app-runtime.ts 但未被调用 | 缺少"调用点验证"环节，只检查了注册 |
| **工作区脏状态** | 部分文件有未提交修改，状态不明 | 缺少"工作区清理"前置步骤 |
| **plan 先于 review** | 先写方案再做 code review，导致方案基于错误假设 | 流程顺序错误 |

### 1.2 交付风险清单

| 风险 | 影响 | 严重度 |
|------|------|--------|
| 接入代码后引入运行时错误 | 主链路崩溃 | P0 |
| 模块间循环依赖 | 编译失败 | P0 |
| 性能退化（AST 扫描、DB 写入） | 响应变慢 | P1 |
| 工作区未提交修改被覆盖 | 丢失正在进行的工作 | P1 |
| 接入后无法回滚 | 线上故障无法恢复 | P1 |

---

## 二、交付流程整改

### 2.1 五阶段交付流程

```
Phase 0: 清理  →  Phase 1: 验证  →  Phase 2: 设计  →  Phase 3: 实施  →  Phase 4: 验收
 (1h)             (2h)               (1h)               (N天)              (每模块)
```

**铁律：每个 Phase 必须产出物证，才能进入下一 Phase。**

---

### Phase 0: 环境清理（1 小时）

**目标**：确保工作区干净，不丢失任何进行中的工作。

**步骤**：
1. 记录当前分支和 HEAD：`git rev-parse HEAD > /tmp/helixagent-baseline.txt`
2. 检查工作区状态：`git status --short`
3. 对未提交修改分类：
   - 可以提交的 → 先 review 再提交
   - 不确定的 → `git stash save "wip: xxx"`
   - 废弃的 → `git checkout -- <file>`
4. 确认 `bun typecheck` 通过
5. 确认 `git status --short` 输出为空（或只有 untracked 文件）

**产出物**：干净的工作区 + baseline commit hash

**检查点**：
```bash
# 必须全部通过
git diff --stat | grep -v "untracked" | wc -l  # 应为 0
bun typecheck  # 应为 0 errors
```

---

### Phase 1: 现状验证（2 小时）

**目标**：建立准确的模块状态基线，不信任任何文档。

**步骤**：

#### 1.1 主链路调用验证

对每个声称"已实现"的模块，执行以下检查：

```bash
# 检查注册
rg -n "XxxService\.defaultLayer" packages/opencode/src/effect/app-runtime.ts

# 检查主链路调用（必须在 prompt.ts / processor.ts / tool/*.ts 中有 yield*）
rg -n "yield\* xxx\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts

# 检查 node deps（prompt.ts 的 LayerNode.make deps 数组）
rg -n "XxxService\.node" packages/opencode/src/session/prompt.ts
```

#### 1.2 Stub 检测

```bash
# 搜索所有 "not implemented" 标记
rg -n "not implemented|TODO.*implement|FIXME.*implement" packages/opencode/src/tool/*.ts --type ts

# 搜索空实现
rg -n "return \{ title:.*output:.*metadata: \{\} \}" packages/opencode/src/tool/*.ts --type ts
```

#### 1.3 工作区修改验证

```bash
# 列出所有未提交修改
git status --short

# 对每个 modified 文件，检查是否引入了新问题
git diff <file> | head -100
bun typecheck
```

**产出物**：`MODULE_STATUS_MATRIX.md` — 每个模块的真实状态表

**检查点**：每个模块必须有以下字段：
- [ ] 是否注册到 app-runtime.ts
- [ ] 是否在主链路中有 `yield*` 调用
- [ ] 服务实现是否为 stub
- [ ] node deps 是否声明
- [ ] 工作区是否有未提交修改

---

### Phase 2: 设计评审（1 小时）

**目标**：基于 Phase 1 的真实状态，设计方案，不允许基于假设设计。

**步骤**：

#### 2.1 差距分析

对比 `MODULE_STATUS_MATRIX.md` 和目标状态，生成差距清单：

```
模块: AST
当前状态: 已注册，未调用，真实实现
目标状态: processor.ts tool-result 后提取变更文件，prompt.ts runLoop 末尾异步分析
差距: 需要在 2 个文件中添加调用点，需要新增 getChangedFilesFromSession 方法
风险: AST 分析可能阻塞主链路 → 用 Effect.forkIn(scope) 异步执行
```

#### 2.2 依赖图检查

画出模块间依赖关系，检查循环依赖：

```
Workflow ← 无外部依赖（只依赖 Database）
Team ← 无外部依赖（只依赖 Database）
AST ← 依赖 FSUtil
Evolution ← 依赖 Trace, FSUtil
OpenSpecHook ← 依赖 OpenSpec, OpenSpecJudge
```

确认无循环依赖。

#### 2.3 退出点覆盖检查

对每个接入点，列出所有可能的退出路径：

```
runLoop 退出点:
  1. break (line 1139) — 正常退出
  2. break (line 1167) — compaction stop
  3. break (line 1344) — outcome break
  4. break (line 1353) — react count >= 12
  5. return (line 1402) — 正常 return
  6. throw — 异常退出

Workflow 必须覆盖所有 6 个退出点
```

**产出物**：`DEAD_CODE_MAIN_CHAIN_INTEGRATION_PLAN.md`（最终版，基于验证后的状态）

**检查点**：
- [ ] 方案中每个接入点都有对应的代码位置（文件:行号）
- [ ] 每个接入点都标注了退出路径覆盖情况
- [ ] 每个模块都标注了错误隔离策略
- [ ] 无循环依赖

---

### Phase 3: 逐模块实施（N 天）

**目标**：每个模块独立实施、独立验证、独立提交。

#### 3.1 单模块实施流程

```
Step 1: 修改代码
Step 2: bun typecheck（0 errors）
Step 3: 调用点验证（rg 搜索确认 yield* 调用存在）
Step 4: node deps 验证（确认 prompt.ts 的 deps 包含新模块）
Step 5: git add + git commit（一个模块一个 commit）
Step 6: 回归验证（bun typecheck 再跑一次）
```

#### 3.2 实施顺序（严格按依赖关系）

```
Step 1: Workflow（无外部依赖，接入 runLoop 生命周期）
  ├── 修改 prompt.ts: runLoop 外层包装 + cancel 函数
  ├── 修改 prompt.ts node deps: 添加 Workflow.node
  ├── bun typecheck
  ├── rg 验证 yield* workflow. 存在
  └── git commit

Step 2: Team（无外部依赖，接入 tool/actor.ts + tool/task.ts）
  ├── 修改 tool/actor.ts: spawn 后 addMemberToOwnerSession
  ├── 修改 tool/task.ts: 创建子 session 后 addMemberToOwnerSession
  ├── 修改 prompt.ts: runLoop 末尾异步输出团队摘要
  ├── bun typecheck
  ├── rg 验证 yield* team. 存在
  └── git commit

Step 3: AST（依赖 FSUtil，接入 processor.ts + prompt.ts）
  ├── 增强 ast.ts: 新增 getChangedFilesFromSession
  ├── 修改 processor.ts: tool-result 中提取变更文件
  ├── 修改 prompt.ts: runLoop 末尾异步分析
  ├── 修改 prompt.ts node deps: 添加 AST.node
  ├── bun typecheck
  ├── rg 验证 yield* ast. 存在
  └── git commit

Step 4: Evolution（依赖 Trace + FSUtil，接入 prompt.ts）
  ├── 修改 prompt.ts: runLoop 末尾异步导出
  ├── bun typecheck
  ├── rg 验证 yield* evolution. 存在
  └── git commit

Step 5: OpenSpec（依赖 OpenSpec + OpenSpecJudge，接入 processor.ts）
  ├── 修改 app-runtime.ts: 注册 OpenSpecHook.defaultLayer
  ├── 修改 processor.ts: tool-result 中文件类工具后调用 checkAfterToolCall
  ├── 修改 prompt.ts node deps: 添加 OpenSpecHook.node
  ├── bun typecheck
  ├── rg 验证 yield* openSpecHook. 存在
  └── git commit

Step 6: Scheduler（可选，当前无明确调用点）
  ├── 待明确调用点后再实施
  └── 暂不接入主链路
```

#### 3.3 每步质量门禁

每个 Step 必须通过以下检查才能进入下一步：

```bash
# 1. 编译通过
bun typecheck  # 0 errors

# 2. 调用点存在
rg -n "yield\* <module>\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts
# 输出不应为空

# 3. node deps 声明（如果在 prompt.ts 中调用）
rg -n "<Module>\.node" packages/opencode/src/session/prompt.ts
# 输出不应为空

# 4. 无新增 stub
rg -n "not implemented" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts
# 输出应为空（排除 workflow.ts 和 screenshot.ts 等已知 stub）

# 5. 错误隔离检查
rg -n "Effect\.catchAll|Effect\.ignore|Effect\.forkIn" packages/opencode/src/session/prompt.ts | grep -i "<module>"
# 每个新调用点都应有错误隔离
```

**产出物**：每个模块一个独立 commit，可独立回滚

---

### Phase 4: 集成验收（每个模块完成后 + 全部完成后）

#### 4.1 单模块验收

每个模块完成后，运行：

```bash
# 编译
bun typecheck

# 调用点验证
rg -n "yield\* <module>\." packages/opencode/src --type ts

# stub 检测
rg -n "not implemented" packages/opencode/src/tool/*.ts --type ts

# 错误隔离验证
rg -n "Effect\.(catchAll|ignore|forkIn)" packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts --type ts
```

#### 4.2 全量验收

全部模块接入后：

```bash
# 1. 编译
bun typecheck

# 2. 全量调用点检查
for module in workflow team ast evolution openSpecHook scheduler; do
  echo "=== $module ==="
  rg -n "yield\* ${module}\." packages/opencode/src/session/prompt.ts packages/opencode/src/session/processor.ts packages/opencode/src/tool/*.ts --type ts
done

# 3. node deps 完整性
rg -n "\.node" packages/opencode/src/session/prompt.ts | grep -E "Workflow|Team|AST|Evolution|OpenSpecHook"

# 4. 无新增 stub
rg -c "not implemented" packages/opencode/src/tool/*.ts --type ts | grep -v ":0$"

# 5. 运行测试（如果有）
cd packages/opencode && bun test --timeout 30000 2>&1 | tail -20
```

**产出物**：验收报告（每个检查点的输出结果）

---

## 三、质量保障机制

### 3.1 防回归检查清单

每次修改代码后，必须确认：

- [ ] `bun typecheck` 通过
- [ ] 没有引入新的 `not implemented` stub
- [ ] 没有移除已有的主链路调用
- [ ] 没有引入循环依赖
- [ ] 新增调用点都有错误隔离

### 3.2 回滚策略

每个模块独立 commit，回滚时：

```bash
# 回滚单个模块
git revert <commit-hash>

# 回滚所有
git revert <first-commit>..<last-commit>
```

### 3.3 文档同步纪律

**铁律：代码先于文档。**

- 实施完成 → 验证通过 → 更新文档 → commit 代码 + 文档一起提交
- 不允许"先写文档再做代码"的流程
- 文档中的每个"已完成"必须有对应的 commit hash 佐证

---

## 四、执行时间表

| 时间 | 任务 | 产出物 |
|------|------|--------|
| Day 1 上午 | Phase 0: 环境清理 | 干净工作区 + baseline hash |
| Day 1 下午 | Phase 1: 现状验证 | MODULE_STATUS_MATRIX.md |
| Day 2 上午 | Phase 2: 设计评审 | 最终版集成方案 |
| Day 2 下午 | Phase 3 Step 1: Workflow | commit + 验收报告 |
| Day 3 上午 | Phase 3 Step 2: Team | commit + 验收报告 |
| Day 3 下午 | Phase 3 Step 3: AST | commit + 验收报告 |
| Day 4 上午 | Phase 3 Step 4: Evolution | commit + 验收报告 |
| Day 4 下午 | Phase 3 Step 5: OpenSpec | commit + 验收报告 |
| Day 5 上午 | Phase 3 Step 6: Scheduler（如调用点明确） | commit + 验收报告 |
| Day 5 下午 | Phase 4: 全量验收 + 文档更新 | 最终验收报告 |

---

## 五、验收标准（最终）

| 检查项 | 标准 | 验证方式 |
|--------|------|---------|
| 编译 | `bun typecheck` 0 errors | 命令行 |
| 主链路调用 | 6 个模块都有 `yield*` 调用 | rg 搜索 |
| 错误隔离 | 每个新调用点都有 catchAll/ignore/forkIn | rg 搜索 |
| 无新增 stub | 工具目录无新增 "not implemented" | rg 搜索 |
| node deps | prompt.ts deps 包含所有新模块 | rg 搜索 |
| 可回滚 | 每个模块独立 commit | git log |
| 文档一致 | 文档状态与代码实际状态一致 | 交叉验证 |
