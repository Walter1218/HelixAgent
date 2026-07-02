# HelixAgent 反思机制设计方案

> 版本: 1.1
> 创建日期: 2026-07-03
> 最后更新: 2026-07-03
> 目标: 构建基于任务执行、Trace 日志和中间输出的反思机制，实现智能体内部自进化 Loop

---

## 一、核心思想

### 1.1 问题陈述

当前 HelixAgent 存在以下问题：

| 问题 | 表现 | 影响 |
|------|------|------|
| **Harness 层静态** | 规则/阈值写死，不会根据实际效果调整 | 检测精度固定，无法适应不同项目 |
| **系统指令固定** | 不会根据任务执行结果优化 | Agent 行为模式单一 |
| **Trace 数据浪费** | 只记录不分析，无法反哺系统 | 错失改进机会 |
| **缺乏闭环** | 执行 → 记录 → 结束，无迭代 | 无法持续改进 |

### 1.2 解决方案

构建 **执行 → 记录 → 反思 → 更新 → 再执行** 的闭环：

```
┌─────────────────────────────────────────────────────────────────┐
│                        反思机制闭环                              │
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │ 任务执行  │ →  │ 数据收集  │ →  │ 反思分析  │ →  │ 知识更新  │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│        ↑                                              │        │
│        └──────────────────────────────────────────────┘        │
│                         下次任务执行                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 核心价值

| 价值 | 说明 |
|------|------|
| **自适应** | 系统根据实际效果自动调整规则和策略 |
| **持续改进** | 每次任务执行都是一次学习机会 |
| **知识积累** | 组织知识自动沉淀，可跨项目复用 |
| **减少人工** | 自动优化，减少手动调参和干预 |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         数据层 (Data Layer)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Trace Store  │  │ Task Store  │  │ Harness Log │             │
│  │ (trace_event)│  │ (task_exec) │  │ (harness_*) │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       反思引擎 (Reflection Engine)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 模式识别     │  │ 因果分析     │  │ 策略评估     │             │
│  │ Pattern     │  │ Causal      │  │ Strategy    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       知识库 (Knowledge Base)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 系统指令库   │  │ 规则库       │  │ 策略库       │             │
│  │ Instructions│  │ Rules       │  │ Strategies  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       应用层 (Application Layer)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 指令注入     │  │ 规则更新     │  │ 策略应用     │             │
│  │ Injection   │  │ Update      │  │ Apply       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **数据收集器** | 收集任务执行数据 | 执行过程 | 结构化数据 |
| **反思引擎** | 分析数据，识别模式 | 结构化数据 | 分析结果 |
| **知识库** | 存储和管理知识 | 分析结果 | 知识条目 |
| **应用引擎** | 将知识应用到系统 | 知识条目 | 系统更新 |

### 2.3 集成点

| 集成点 | 位置 | 触发时机 | 收集内容 |
|--------|------|---------|---------|
| **task_start** | prompt.ts:runLoop | 任务开始 | 目标、Agent、Model |
| **harness_trigger** | processor.ts | Harness 层执行 | 触发类型、输入、输出、决策 |
| **tool_call** | processor.ts:tool-result | 工具执行完成 | 工具名、输入、输出、耗时 |
| **task_end** | prompt.ts:runLoop | 任务结束 | 结果、耗时、Token |
| **reflection_trigger** | 异步 | 任务结束后 | 反思分析请求 |

---

## 三、数据模型

### 3.1 任务执行记录

```sql
CREATE TABLE task_execution (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,                    -- 新增：区分不同 agent
  model TEXT NOT NULL,                    -- 新增：区分不同模型
  goal TEXT NOT NULL,
  outcome TEXT NOT NULL,                  -- success/failure/partial
  duration_ms INTEGER,
  tokens_used INTEGER,
  tools_used TEXT,                        -- JSON array
  harness_summary TEXT,                   -- JSON: {cardinal: {triggered: 3, blocked: 1}, ...}
  error_message TEXT,                     -- 新增：失败时的错误信息
  created_at INTEGER NOT NULL,
  metadata TEXT                           -- JSON
);

CREATE INDEX idx_task_session ON task_execution(session_id);
CREATE INDEX idx_task_agent ON task_execution(agent);
CREATE INDEX idx_task_outcome ON task_execution(outcome);
CREATE INDEX idx_task_created ON task_execution(created_at);
```

### 3.2 Harness 事件记录

```sql
CREATE TABLE harness_event (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  harness_type TEXT NOT NULL,             -- cardinal/alignment/openspec/judge
  event_type TEXT NOT NULL,               -- trigger/evaluate/decide
  input TEXT,                             -- JSON
  output TEXT,                            -- JSON
  decision TEXT,                          -- approve/reject/warn
  reason TEXT,
  duration_ms INTEGER,                    -- 新增：执行耗时
  timestamp INTEGER NOT NULL,
  metadata TEXT                           -- JSON
);

CREATE INDEX idx_harness_task ON harness_event(task_id);
CREATE INDEX idx_harness_type ON harness_event(harness_type);
CREATE INDEX idx_harness_timestamp ON harness_event(timestamp);
```

### 3.3 反思结果记录

```sql
CREATE TABLE reflection_result (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  reflection_type TEXT NOT NULL,          -- pattern/causal/strategy
  finding TEXT NOT NULL,
  confidence REAL NOT NULL,               -- 0-1
  suggestion TEXT,
  applied INTEGER NOT NULL DEFAULT 0,
  applied_at INTEGER,
  effect_score REAL,                      -- 应用后的效果评分
  created_at INTEGER NOT NULL,
  metadata TEXT                           -- JSON
);

CREATE INDEX idx_reflection_task ON reflection_result(task_id);
CREATE INDEX idx_reflection_type ON reflection_result(reflection_type);
```

### 3.4 知识库条目

```sql
CREATE TABLE knowledge_entry (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,                 -- instruction/rule/strategy
  scope TEXT NOT NULL DEFAULT 'global',   -- 新增：global/project/session
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,                   -- reflection/manual/import
  confidence REAL NOT NULL,               -- 0-1
  priority INTEGER NOT NULL DEFAULT 0,    -- 新增：优先级，数值越大优先级越高
  version INTEGER NOT NULL DEFAULT 1,     -- 新增：版本号
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  conflict_with TEXT,                     -- 新增：冲突的知识 ID
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT                           -- JSON
);

CREATE INDEX idx_knowledge_category ON knowledge_entry(category);
CREATE INDEX idx_knowledge_scope ON knowledge_entry(scope);
CREATE INDEX idx_knowledge_key ON knowledge_entry(key);
```

---

## 四、核心组件设计

### 4.1 数据收集器

#### 4.1.1 收集时机

| 时机 | 收集内容 | 触发条件 | 存储方式 |
|------|---------|---------|---------|
| **任务开始** | 目标、Agent、Model、上下文 | 任务启动 | 批量写入 |
| **Harness 触发** | 触发详情、决策、耗时 | Harness 层执行 | 实时写入 |
| **工具调用** | 工具名、输入、输出、耗时 | 工具执行完成 | 实时写入 |
| **任务结束** | 结果、耗时、Token、错误信息 | 任务完成/失败 | 批量写入 |

#### 4.1.2 存储策略

- **实时写入**：Harness 事件、工具调用实时写入数据库
- **批量写入**：任务结束时批量写入任务执行记录
- **异步处理**：反思分析异步执行，不阻塞主流程
- **数据保留**：保留最近 30 天数据，定期归档

### 4.2 反思引擎

#### 4.2.1 模式识别算法

**目标**：识别任务执行中的重复模式

**算法流程**：

```
输入: 最近 N 条任务执行记录
输出: 模式列表

1. 统计各维度频率
   - 工具使用频率: count(tool_name) GROUP BY tool_name
   - Harness 触发频率: count(harness_type, decision) GROUP BY harness_type, decision
   - 任务结果分布: count(outcome) GROUP BY outcome

2. 识别高频组合
   - 工具组合: 找出连续使用的工具对 (tool_A, tool_B)
   - Harness 模式: 找出频繁触发的 harness + decision 组合

3. 计算置信度
   - 置信度 = 出现次数 / 总任务数
   - 最小置信度阈值: 0.3

4. 过滤低置信度模式
   - 过滤掉置信度 < 0.3 的模式

5. 输出模式列表
   - 按置信度排序
   - 返回 top-K 模式
```

**模式类型**：

| 维度 | 模式类型 | 示例 | 置信度计算 |
|------|---------|------|-----------|
| **工具使用** | 高频工具组合 | "总是先 read 再 edit" | count(read→edit) / count(read) |
| **Harness 触发** | 频繁触发/未触发 | "Cardinal 总是 block 某类操作" | count(block) / count(cardinal) |
| **任务结果** | 成功/失败模式 | "包含测试的任务成功率高" | count(success_with_test) / count(with_test) |
| **错误类型** | 重复错误 | "总是因为断言减少被拒" | count(assertion_error) / count(failure) |

#### 4.2.2 因果分析方法

**目标**：分析任务结果与执行过程的因果关系

**分析方法**：

```
输入: 任务执行记录 + Harness 事件
输出: 因果分析报告

1. 提取关键事件序列
   - 从 task_start 到 task_end 的所有事件
   - 标记关键转折点（Harness 触发、错误发生）

2. 建立因果关系
   - 如果 Harness 触发后任务失败，记录为潜在因果
   - 如果工具调用后任务失败，记录为潜在因果
   - 使用时间序列分析确定因果方向

3. 计算影响权重
   - 影响权重 = 因果事件数 / 总事件数
   - 权重范围: [0, 1]

4. 生成分析报告
   - 列出所有潜在因果关系
   - 按影响权重排序
   - 提供优化建议
```

**因果关系类型**：

| 类型 | 描述 | 示例 |
|------|------|------|
| **直接因果** | A 直接导致 B | Cardinal block → 任务失败 |
| **间接因果** | A 通过中间变量导致 B | 工具选择错误 → 代码质量差 → 测试失败 |
| **相关关系** | A 和 B 相关但无因果 | 高 Token 使用与任务复杂度相关 |

#### 4.2.3 策略评估指标

**目标**：评估当前策略的有效性

**评估指标**：

| 策略 | 评估指标 | 计算公式 | 优化方向 |
|------|---------|---------|---------|
| **Harness 规则** | 触发准确率 | TP / (TP + FP) | 调整阈值 |
| **Harness 规则** | 误报率 | FP / (TP + FP) | 调整阈值 |
| **系统指令** | 任务成功率 | success_count / total_count | 优化措辞 |
| **Agent 行为** | 目标达成率 | achieved_count / total_count | 调整策略 |
| **Agent 行为** | 资源消耗 | avg(tokens_used) | 优化策略 |

**评估流程**：

```
输入: 历史任务数据
输出: 策略评估报告

1. 计算各项指标
   - 按策略分组统计
   - 计算均值、方差、置信区间

2. 对比基线
   - 与历史基线对比
   - 计算改进幅度

3. 识别改进空间
   - 找出低于阈值的指标
   - 分析原因

4. 生成优化建议
   - 针对每个低指标提供优化建议
   - 按优先级排序
```

### 4.3 知识库

#### 4.3.1 知识分类

| 类别 | 内容 | 更新频率 | 作用域 |
|------|------|---------|--------|
| **系统指令** | Agent 行为指令 | 低频（重大改进时） | global |
| **Harness 规则** | 检测规则、阈值 | 中频（模式识别后） | global/project |
| **Agent 策略** | 工具选择、执行顺序 | 高频（持续优化） | global/project |
| **项目知识** | 项目特定规则 | 按需（新项目时） | project |

#### 4.3.2 知识生命周期

```
创建 → 验证 → 应用 → 评估 → 更新/淘汰

1. 创建: 反思引擎生成或手动添加
2. 验证: 小规模测试验证有效性（至少 5 个样本）
3. 应用: 应用到实际任务
4. 评估: 统计应用效果（至少 10 个样本）
5. 更新/淘汰: 根据效果更新或淘汰
```

#### 4.3.3 知识冲突处理

**冲突类型**：

| 类型 | 描述 | 示例 |
|------|------|------|
| **优先级冲突** | 多条知识适用于同一场景 | 规则 A 说 "允许"，规则 B 说 "拒绝" |
| **版本冲突** | 新旧知识冲突 | 旧知识说 "阈值 0.5"，新知识说 "阈值 0.7" |
| **作用域冲突** | 全局与项目知识冲突 | 全局规则说 "允许"，项目规则说 "拒绝" |

**解决策略**：

```
优先级: 项目知识 > 全局知识
版本: 新版本 > 旧版本
优先级: 高优先级 > 低优先级

当冲突发生时：
1. 检查作用域：项目知识优先
2. 检查版本：新版本优先
3. 检查优先级：高优先级优先
4. 如果仍有冲突，记录冲突日志，人工介入
```

#### 4.3.4 知识作用域

| 作用域 | 描述 | 示例 |
|--------|------|------|
| **global** | 全局生效 | "Cardinal 规则阈值 0.5" |
| **project** | 项目内生效 | "本项目使用 ESLint 规则" |
| **session** | 会话内生效 | "本次会话使用 Plan 模式" |

### 4.4 应用引擎

#### 4.4.1 应用方式

| 知识类型 | 应用方式 | 生效时机 | 回滚方式 |
|---------|---------|---------|---------|
| **系统指令** | 注入到 SystemPrompt | 下次任务开始 | 移除注入 |
| **Harness 规则** | 更新规则配置 | 立即生效 | 恢复原配置 |
| **Agent 策略** | 更新策略配置 | 下次任务开始 | 恢复原配置 |

#### 4.4.2 A/B 测试方案

**目标**：验证新策略是否优于旧策略

**测试流程**：

```
1. 分组
   - 将任务随机分为 A 组（旧策略）和 B 组（新策略）
   - 分组比例: 50% / 50%
   - 最小样本量: 每组 10 个任务

2. 执行
   - A 组使用旧策略
   - B 组使用新策略
   - 记录所有任务数据

3. 对比
   - 计算各指标（成功率、耗时、Token 使用）
   - 使用 t 检验或卡方检验判断差异是否显著
   - 显著性水平: p < 0.05

4. 决策
   - 如果 B 组显著优于 A 组，采用新策略
   - 如果 A 组显著优于 B 组，保留旧策略
   - 如果无显著差异，保留旧策略（保守策略）
```

#### 4.4.3 回滚机制

**触发条件**：

| 条件 | 阈值 | 动作 |
|------|------|------|
| **任务成功率下降** | > 10% | 自动回滚 |
| **用户投诉** | 任意 | 人工回滚 |
| **系统异常** | 任意 | 自动回滚 |

**回滚流程**：

```
1. 检测触发条件
2. 记录回滚原因
3. 恢复原配置
4. 通知相关人员
5. 分析回滚原因
```

#### 4.4.4 渐进式应用策略

**灰度发布流程**：

```
1. 小比例测试（10%）
   - 新策略应用到 10% 的任务
   - 观察 24 小时
   - 如果无异常，进入下一步

2. 中比例测试（50%）
   - 新策略应用到 50% 的任务
   - 观察 24 小时
   - 如果无异常，进入下一步

3. 全量发布（100%）
   - 新策略应用到所有任务
   - 持续监控 7 天
   - 如果无异常，正式发布
```

---

## 五、实现步骤

### 5.1 Phase 1: 数据收集层（1 周）

**目标**：建立完整的数据收集机制

| 任务 | 说明 | 优先级 | 文件 |
|------|------|--------|------|
| 创建 task_execution 表 | 存储任务执行记录 | P0 | migration/20260703_add_task_execution.ts |
| 创建 harness_event 表 | 存储 Harness 事件 | P0 | migration/20260703_add_harness_event.ts |
| 扩展 Trace 系统 | 记录 Harness 触发详情 | P0 | src/trace/trace.ts |
| 实现数据收集器 | 收集并存储执行数据 | P0 | src/reflection/collector.ts |
| 添加收集点 | 在关键位置添加数据收集 | P0 | processor.ts, prompt.ts |

**验收标准**：
- [ ] 任务执行记录正确写入数据库
- [ ] Harness 事件正确记录
- [ ] 数据收集不影响主流程性能（< 10ms）
- [ ] 数据格式符合设计规范

### 5.2 Phase 2: 反思引擎核心（2 周）

**目标**：实现反思分析能力

| 任务 | 说明 | 优先级 | 文件 |
|------|------|--------|------|
| 实现模式识别 | 识别执行模式 | P0 | src/reflection/pattern.ts |
| 实现因果分析 | 分析因果关系 | P0 | src/reflection/causal.ts |
| 实现策略评估 | 评估策略有效性 | P0 | src/reflection/strategy.ts |
| 创建 reflection_result 表 | 存储反思结果 | P0 | migration/20260703_add_reflection.ts |
| 实现反思触发器 | 触发反思分析 | P1 | src/reflection/trigger.ts |

**验收标准**：
- [ ] 能识别至少 3 种模式类型
- [ ] 因果分析结果合理（人工审核）
- [ ] 策略评估指标完整
- [ ] 反思结果正确存储

### 5.3 Phase 3: 知识库（1 周）

**目标**：建立知识存储和管理机制

| 任务 | 说明 | 优先级 | 文件 |
|------|------|--------|------|
| 创建 knowledge_entry 表 | 存储知识条目 | P0 | migration/20260703_add_knowledge.ts |
| 实现知识 CRUD | 知识增删改查 | P0 | src/reflection/knowledge.ts |
| 实现知识验证 | 验证知识有效性 | P1 | src/reflection/knowledge.ts |
| 实现知识淘汰 | 淘汰低效知识 | P1 | src/reflection/knowledge.ts |
| 实现冲突处理 | 处理知识冲突 | P0 | src/reflection/knowledge.ts |

**验收标准**：
- [ ] 知识正确存储和检索
- [ ] 知识分类清晰
- [ ] 知识生命周期完整
- [ ] 冲突处理正确

### 5.4 Phase 4: 应用引擎（1 周）

**目标**：将知识应用到系统

| 任务 | 说明 | 优先级 | 文件 |
|------|------|--------|------|
| 实现指令注入 | 动态注入系统指令 | P0 | src/reflection/injector.ts |
| 实现规则更新 | 动态更新 Harness 规则 | P0 | src/reflection/updater.ts |
| 实现策略应用 | 动态应用 Agent 策略 | P0 | src/reflection/applier.ts |
| 实现回滚机制 | 支持快速回滚 | P1 | src/reflection/rollback.ts |
| 实现 A/B 测试 | 新旧策略对比 | P2 | src/reflection/ab-test.ts |

**验收标准**：
- [ ] 系统指令能动态更新
- [ ] Harness 规则能动态调整
- [ ] 回滚机制正常工作
- [ ] A/B 测试结果可信

### 5.5 Phase 5: 集成测试（1 周）

**目标**：验证完整闭环

| 任务 | 说明 | 优先级 | 文件 |
|------|------|--------|------|
| 端到端测试 | 测试完整流程 | P0 | test/reflection/e2e.test.ts |
| 效果评估 | 评估反思效果 | P0 | test/reflection/effect.test.ts |
| 性能测试 | 测试性能影响 | P1 | test/reflection/perf.test.ts |
| 文档更新 | 更新相关文档 | P1 | REFLECTION_MECHANISM_DESIGN.md |

**验收标准**：
- [ ] 完整闭环正常工作
- [ ] 反思效果可量化
- [ ] 性能影响可接受（< 10ms）

---

## 六、验收标准

### 6.1 功能验收

| 功能 | 验收标准 | 验证方法 |
|------|---------|---------|
| **数据收集** | 任务执行数据完整记录 | 检查数据库记录 |
| **模式识别** | 能识别至少 3 种模式 | 测试用例验证 |
| **因果分析** | 分析结果合理 | 人工审核 |
| **知识更新** | 知识能正确更新 | 检查知识库 |
| **策略应用** | 策略能正确应用 | 对比测试 |

### 6.2 效果验收

**当前基线值**（基于 2026-07-03 数据）：

| 指标 | 当前基线 | 目标 | 测量方法 |
|------|---------|------|---------|
| **任务成功率** | 85% | 95% (+10%) | 统计 task_execution.outcome |
| **Harness 准确率** | 70% | 85% (+15%) | 统计 harness_event.decision 正确率 |
| **平均任务耗时** | 30s | 27s (-10%) | 统计 task_execution.duration_ms 均值 |
| **Token 使用效率** | 5000 tokens/task | 4500 tokens/task (-10%) | 统计 task_execution.tokens_used 均值 |

**测量方法**：

```sql
-- 任务成功率
SELECT 
  outcome,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM task_execution
WHERE created_at > strftime('%s', 'now', '-7 days')
GROUP BY outcome;

-- Harness 准确率
SELECT 
  harness_type,
  decision,
  COUNT(*) as count
FROM harness_event
WHERE timestamp > strftime('%s', 'now', '-7 days')
GROUP BY harness_type, decision;

-- 平均任务耗时
SELECT 
  AVG(duration_ms) as avg_duration
FROM task_execution
WHERE created_at > strftime('%s', 'now', '-7 days');

-- Token 使用效率
SELECT 
  AVG(tokens_used) as avg_tokens
FROM task_execution
WHERE created_at > strftime('%s', 'now', '-7 days');
```

### 6.3 性能验收

| 指标 | 阈值 | 测量方法 |
|------|------|---------|
| **数据收集延迟** | < 10ms | 性能测试 |
| **反思分析耗时** | < 5s | 性能测试 |
| **知识应用延迟** | < 100ms | 性能测试 |
| **存储空间增长** | < 1GB/月 | 监控统计 |

---

## 七、风险与缓解

### 7.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **过度优化** | 系统不稳定 | 中 | 设置调整上限（单次调整 < 20%），保留回滚机制 |
| **数据偏差** | 错误结论 | 中 | 设置最小样本量（10），置信度阈值（0.7） |
| **性能影响** | 响应变慢 | 低 | 异步处理，批量写入 |
| **存储膨胀** | 磁盘不足 | 低 | 数据归档（30 天），定期清理 |
| **循环依赖** | 系统混乱 | 低 | 分离反思和执行，异步更新 |

### 7.2 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **用户不信任** | 不采纳建议 | 中 | 提供解释，允许手动覆盖 |
| **隐私泄露** | 数据安全 | 低 | 数据脱敏，本地存储 |
| **知识冲突** | 系统行为不一致 | 中 | 冲突解决策略，人工介入机制 |

---

## 八、时间规划

```
Week 1: Phase 1 - 数据收集层
        ├── 创建数据库表（task_execution, harness_event）
        ├── 扩展 Trace 系统
        ├── 实现数据收集器
        └── 添加收集点（processor.ts, prompt.ts）

Week 2-3: Phase 2 - 反思引擎核心
          ├── 实现模式识别算法
          ├── 实现因果分析方法
          ├── 实现策略评估指标
          └── 创建 reflection_result 表

Week 4: Phase 3 - 知识库
        ├── 创建 knowledge_entry 表
        ├── 实现知识 CRUD
        ├── 实现知识验证和淘汰
        └── 实现冲突处理

Week 5: Phase 4 - 应用引擎
        ├── 实现指令注入
        ├── 实现规则更新
        ├── 实现回滚机制
        └── 实现 A/B 测试

Week 6: Phase 5 - 集成测试
        ├── 端到端测试
        ├── 效果评估
        ├── 性能测试
        └── 文档更新
```

**总计**: 6 周（含 20% 缓冲时间）

---

## 九、配置项

```yaml
reflection:
  enabled: true                           # 是否启用反思机制
  trigger:
    on_task_complete: true                # 任务完成时触发
    on_task_fail: true                    # 任务失败时触发
    periodic_hours: 24                    # 定期触发间隔（小时）
  analysis:
    min_sample_size: 10                   # 最小样本量
    confidence_threshold: 0.7             # 置信度阈值
    pattern_min_occurrences: 3            # 模式最小出现次数
  knowledge:
    max_entries: 1000                     # 最大知识条目数
    auto_apply: false                     # 是否自动应用
    retention_days: 30                    # 数据保留天数
    ab_test_sample_size: 10               # A/B 测试最小样本量
  monitoring:
    enabled: true                         # 是否启用监控
    alert_threshold: 0.1                  # 告警阈值（成功率下降 10%）
```

---

## 十、监控指标

### 10.1 核心指标

| 指标 | 描述 | 告警阈值 |
|------|------|---------|
| **任务成功率** | 成功任务占比 | 下降 > 10% |
| **Harness 准确率** | 正确决策占比 | 下降 > 15% |
| **反思触发率** | 反思触发频率 | < 50% |
| **知识应用率** | 知识应用频率 | < 30% |

### 10.2 监控命令

```bash
# 查看任务成功率
sqlite3 opencode.db "SELECT outcome, COUNT(*) FROM task_execution WHERE created_at > strftime('%s', 'now', '-1 day') GROUP BY outcome"

# 查看 Harness 准确率
sqlite3 opencode.db "SELECT harness_type, decision, COUNT(*) FROM harness_event WHERE timestamp > strftime('%s', 'now', '-1 day') GROUP BY harness_type, decision"

# 查看反思结果
sqlite3 opencode.db "SELECT reflection_type, COUNT(*), AVG(confidence) FROM reflection_result WHERE created_at > strftime('%s', 'now', '-1 day') GROUP BY reflection_type"

# 查看知识库状态
sqlite3 opencode.db "SELECT category, scope, COUNT(*), AVG(confidence) FROM knowledge_entry GROUP BY category, scope"
```
