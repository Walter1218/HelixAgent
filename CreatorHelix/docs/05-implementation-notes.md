# 实现要点与下一步建议

## 一、实现优先级

### P0：核心闭环（已完成）
1. ✅ 项目创建与状态机跑通
2. ✅ 需求分析 → 脚本生成 → 脚本审批
3. ✅ 分镜生成 → 分镜审批
4. ✅ 素材生成 → 自动剪辑 → 成片预览
5. ✅ 导出成片

> 当前素材生成、自动剪辑、导出成片使用 mock 实现（返回占位 URL），已用端到端测试验证完整流程。

### P1：体验优化
1. 暂停/恢复（接口已有，UI 待完善）
2. 状态历史与版本回溯
3. 用户偏好记忆
4. 自动质检与重试（已完成 LLM 接入，可进一步细化规则与 vision 能力）

### P2：生态与扩展
1. 插件市场 / 自定义工具注册
2. 社区模板分享
3. ✅ 多 Agent 协作（导演、编剧、场景布局师、摄影师、剪辑师、质检员已拆分并接入主链）

## 二、技术栈建议（基于 HelixAgent）

| 层级 | 技术 | 说明 |
|---|---|---|
| 包管理 | Bun workspaces | 与 HelixAgent 一致 |
| 运行时 / 并发 | Effect v4 beta | 复用 `effect`（catalog） |
| Schema 定义 | Effect Schema | 复用 `packages/schema` 风格 |
| LLM 调用 | `packages/llm` | `LLM.generateObject` + Tool Calling |
| Tool 封装 | `packages/llm/src/tool.ts` | 类型安全的工具定义 |
| 数据库 | SQLite + Drizzle ORM | 复用 `packages/core/src/database` |
| 持久化队列 | 自研 SQLite 队列 | `BackgroundJob` 不持久化，需增强 |
| 异步任务 | `BackgroundJob` + 持久化包装 | 短任务用现有，长任务持久化 |
| API 层 | Hono / `packages/server` | 复用现有 server 风格 |
| 前端 | SolidJS / React + Tailwind | 复用 `packages/ui` 组件 |
| 对象存储 | S3 / OSS / MinIO | 视频/图片大文件存储 |
| LLM 模型 | OpenAI / Claude / 国产大模型 | 通过 `packages/llm` provider 接入 |
| 视频生成 | HunyuanVideo / Wan / LTX / 第三方 API | 先选一个跑通 |
| 状态机 | 自研持久化状态机 | 不直接用内存 `State` |

## 三、关键实现挑战

### 1. 长任务处理

视频生成可能耗时数分钟，不能阻塞 HTTP 请求。

**方案**：
- 使用队列异步执行
- WebSocket / SSE 推送状态更新
- 每个耗时步骤作为独立 job，可重试、可中断

### 2. 显存与并发控制

视频生成 GPU 显存消耗大，并发过多容易 OOM。

**方案**：
- 按 GPU 显存限制 batch size
- 使用独立 worker 池，按资源配额调度
- 支持云端推理 + 本地预览的混合模式

### 3. 人工修改后的增量更新

用户修改脚本或分镜后，只重跑受影响的部分。

**方案**：
- 每个 shot 有独立 hash
- 比较修改前后的 hash，只重跑变化的 shot
- 下游依赖（剪辑、配音）自动触发

### 4. 多模态一致性

画面、配音、字幕、音乐需要在风格、节奏、情感上保持一致。

**方案**：
- 在上下文组装时注入统一的风格描述
- 使用统一的 seed / 风格参考图
- 增加"导演 Agent"做最终一致性检查

## 四、人机回环 UI 设计要点

| 阶段 | 用户操作 |
|---|---|
| 脚本审批 | 编辑文案、调整时长、确认通过 |
| 分镜审批 | 预览每个 shot 的描述/草图、重生成单个 shot、调整顺序 |
| 成片审批 | 播放视频、在时间轴上批注、要求局部修改 |

## 五、下一步建议

1. **接入真实视频生成模型**：替换 `src/services/asset-generation.ts` 中的 mock，接入 HunyuanVideo / Wan / LTX / 第三方 API。
2. **接入真实剪辑导出**：替换 `src/services/editing.ts` 和 `src/services/export.ts`，用 ffmpeg 或模板引擎合成最终视频。
3. **接入 opencode 主链路**：把 CreatorHelix API 注册进 `packages/protocol` + `packages/server`，让 opencode TUI/CLI 能调用。
4. **前端审批界面**：为脚本/分镜/成片审批做 UI（可用 `packages/app` 或新建独立前端）。
5. **持久化队列增强**：当前 `BackgroundJob` 是内存中的，视频生成任务需要持久化队列 + worker。
6. **增量更新优化**：用户修改脚本/分镜后，只重跑受影响的 shot。

## 六、待决策问题

1. 是否支持实时协作（多人同时编辑一个项目）？
2. 视频生成完全云端，还是支持本地 GPU？
3. 目标用户是专业创作者还是普通用户？
4. 是否优先做 C 端产品，还是 B 端/API 优先？
