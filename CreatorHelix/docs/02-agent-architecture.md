# 智能体核心模块划分

CreatorHelix 的 Agent 不是单一大模型，而是由多个工程化模块协作完成。

## 模块总览

```
用户输入
  ↓
上下文组装（Context Assembly）
  ↓
规划器（Planner）
  ↓
状态管理（State Management）
  ↓
工具调用（Tool Calling）
  ↓
执行器（Executor）
  ↓
反思/评估（Reflection）
  ↓
记忆系统（Memory）
```

## 1. 上下文组装（Context Assembly）

**职责**：把多来源信息整理成 LLM 能消化的 prompt。

**输入来源**：
- 系统提示（角色、规则、输出格式）
- 用户当前输入（创意、文案、参考）
- 历史对话/操作记录
- 项目当前状态
- 检索到的知识（品牌资料、参考案例、用户偏好）
- 工具执行结果

**示例**：
```
系统：你是一位视频导演 Agent...
用户：我要做一个 30 秒的产品介绍视频
记忆：用户偏好科技感、快节奏
项目状态：已完成脚本，正在生成分镜
检索：参考了用户过往 3 个类似项目
→ 组装成最终 prompt
```

## 2. 规划器（Planner）

**职责**：把用户目标拆解成可执行的任务计划。

**类型**：
- 单步规划：一次生成完整计划
- 迭代规划：执行一步再规划下一步
- 分层规划：战略 → 战术 → 原子操作
- 多路径规划：生成多个候选计划，评估后选最优

**输出示例**：
```
输入：30 秒产品介绍视频
计划：
1. 分析产品卖点
2. 写 100 字脚本
3. 拆 6 个分镜
4. 生成每个分镜的关键帧
5. 生成动态视频片段
6. TTS 配音
7. 加字幕和 BGM
8. 合成导出
```

## 3. 状态管理（State Management）

**职责**：维护项目运行时的全局状态，确保流程可恢复、可观测。

**维护内容**：
- 当前执行阶段
- 每个步骤的输入/输出/状态
- 中间产物（图片、视频、音频）
- 用户中断、重试、回滚点

## 4. 工具调用（Tool Calling）

**职责**：让 LLM 决定调用外部能力，并解析调用参数。

**流程**：
1. 定义工具 schema
2. LLM 判断是否需要工具
3. 生成工具调用 JSON
4. 执行工具
5. 把结果返回给 LLM

**工具示例**：
```json
{
  "tool": "generate_video",
  "parameters": {
    "prompt": "futuristic product shot, rotating camera",
    "duration": 4,
    "resolution": "1080p"
  }
}
```

## 5. 执行器（Executor）

**职责**：按计划调度任务、管理依赖、处理异常、控制并发。

**关键能力**：
- DAG 依赖执行
- 并行/串行调度
- 重试、超时、熔断
- 日志追踪
- 中断与恢复

## 6. 反思/评估（Reflection）

**职责**：检查中间产物质量，决定是否需要重做或调整计划。

**方式**：
- 规则检查（时长、分辨率、格式）
- LLM 自评（连贯性、美感、主题符合度）
- 多 Agent 互评
- 用户反馈收集

## 7. 记忆系统（Memory）

**分层**：
- 工作记忆：当前任务上下文
- 短期记忆：本次会话历史
- 长期记忆：用户画像、项目偏好、成功案例
- 语义记忆：向量数据库存储的素材、风格、知识

## 8. 人机回环（Human-in-the-loop）

**介入点**：
- 计划生成后：用户确认/修改
- 关键产物后：用户批准脚本、分镜、成片
- 出错时：用户选择重试、跳过、换方案

## 9. 角色 Agent 设计

CreatorHelix 按视频创作团队的角色拆分了多个 Agent，每个 Agent 有独立的 system prompt 和职责：

| Agent | 文件 | 职责 | 对应状态 |
|---|---|---|---|
| **Director（导演）** | `src/agent/director.ts` | 理解创意、把控整体风格、审核成片 | 需求分析、FINAL_REVIEW |
| **Scriptwriter（编剧）** | `src/agent/scriptwriter.ts` | 根据需求写解说词脚本 | SCRIPT_GENERATION |
| **Storyboard Artist（场景布局师）** | `src/agent/storyboard-artist.ts` | 根据脚本设计分镜 | STORYBOARD_GENERATION |
| **Cinematographer（摄影师）** | `src/agent/cinematographer.ts` | 优化每个 shot 的视觉与运动 prompt | ASSET_GENERATION |
| **Editor（剪辑师）** | `src/agent/editor.ts` | 规划素材合成、转场、字幕与配乐 | EDITING |
| **QA（质检员）** | `src/agent/qa.ts` | 检查素材一致性、完整性 | ASSET_REVIEW |

当前实现中：
- Scriptwriter 和 Storyboard Artist 已通过 `ScriptPlanner` 调用 LLM
- Cinematographer / Editor / QA 已通过各自 `Planner` 调用 LLM（`gpt-4o-mini`）
- 未配置 `OPENAI_API_KEY` 时自动 fallback 到 rule-based 实现，保证测试与本地开发稳定

## 对应到 CreatorHelix

| 模块 | 产品场景 |
|---|---|
| 上下文组装 | 整合用户创意、品牌资料、参考案例、项目进度 |
| 规划器 | 自动拆分：脚本 → 分镜 → 素材生成 → 配音 → 合成 |
| 状态管理 | 每个分镜/镜头的生成状态、用户审批状态 |
| 工具调用 | 调用视频模型、图像模型、TTS、字幕、剪辑工具 |
| 执行器 | 按依赖图调度，并行生成独立镜头 |
| 反思 | 自动检查镜头连贯性、时长、口型/字幕同步 |
| 记忆 | 学习用户喜欢的风格、常用 BGM、过往脚本 |
| 人机回环 | 在脚本、分镜、成片处设置审批节点 |
