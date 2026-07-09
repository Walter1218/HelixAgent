# 端到端主链路

## 当前状态

CreatorHelix 的端到端主链路已用 **mock 服务**跑通，测试文件：`packages/creator-helix/test/runner.e2e.test.ts`。

完整流程：

```
PROJECT_INIT
  → SUBMIT_REQUIREMENT → REQUIREMENT_ANALYSIS
  → ANALYSIS_DONE      → PLANNING
  → PLAN_DONE          → SCRIPT_GENERATION
  → SCRIPT_GENERATED   → SCRIPT_REVIEW        [人工审批]
  → SCRIPT_APPROVED    → STORYBOARD_GENERATION
  → STORYBOARD_GENERATED → STORYBOARD_REVIEW  [人工审批]
  → STORYBOARD_APPROVED → ASSET_GENERATION
  → ASSET_BATCH_DONE   → ASSET_REVIEW         [自动质检]
  → ALL_ASSETS_APPROVED → EDITING
  → EDITING_DONE       → FINAL_REVIEW         [人工审批]
  → FINAL_APPROVED     → EXPORT
  → EXPORT_DONE        → COMPLETED
```

## 自动 vs 人工节点

| 状态 | 类型 | 说明 |
|---|---|---|
| `REQUIREMENT_ANALYSIS` | 自动 | 解析需求 |
| `PLANNING` | 自动 | 生成执行计划 |
| `SCRIPT_GENERATION` | 自动 | 调用 LLM 生成脚本 |
| `SCRIPT_REVIEW` | **人工** | 确认/修改脚本 |
| `STORYBOARD_GENERATION` | 自动 | 调用 LLM 生成分镜 |
| `STORYBOARD_REVIEW` | **人工** | 确认/修改分镜 |
| `ASSET_GENERATION` | 自动 | 摄影师 Agent 优化 prompts 后生成素材（文件仍 mock）|
| `ASSET_REVIEW` | 自动 | QA Agent 结构化检查素材一致性（LLM / rule fallback）|
| `EDITING` | 自动 | 剪辑师 Agent 生成编辑计划并合成 draft（文件仍 mock）|
| `FINAL_REVIEW` | **人工** | 确认/打回成片 |
| `EXPORT` | 自动 | 渲染 final 视频（当前 mock）|
| `COMPLETED` | 终态 | 项目完成 |

## 关键代码位置

| 模块 | 文件 |
|---|---|
| 状态机定义 | `packages/creator-helix/src/state-machine/states.ts` |
| 状态转换规则 | `packages/creator-helix/src/state-machine/transitions.ts` |
| 执行器 | `packages/creator-helix/src/executor/runner.ts` |
| 导演 Agent | `packages/creator-helix/src/agent/director.ts` |
| 编剧 Agent | `packages/creator-helix/src/agent/scriptwriter.ts` |
| 场景布局师 Agent | `packages/creator-helix/src/agent/storyboard-artist.ts` |
| 摄影师 Agent | `packages/creator-helix/src/agent/cinematographer.ts` |
| 剪辑师 Agent | `packages/creator-helix/src/agent/editor.ts` |
| 质检员 Agent | `packages/creator-helix/src/agent/qa.ts` |
| 脚本/分镜规划 | `packages/creator-helix/src/planner/script-planner.ts` |
| 镜头 prompt 优化 | `packages/creator-helix/src/planner/cinematographer-planner.ts` |
| 剪辑计划生成 | `packages/creator-helix/src/planner/editor-planner.ts` |
| 素材生成（mock）| `packages/creator-helix/src/services/asset-generation.ts` |
| 自动剪辑（mock）| `packages/creator-helix/src/services/editing.ts` |
| 导出成片（mock）| `packages/creator-helix/src/services/export.ts` |
| 自动质检 | `packages/creator-helix/src/services/qa.ts` / `src/planner/qa-planner.ts` |
| 端到端测试 | `packages/creator-helix/test/runner.e2e.test.ts` |

## Mock 实现说明

当前为了验证主链路，文件生成仍使用 mock，但结构化输出已接入 LLM：

- **脚本 / 分镜**：通过 `ScriptPlanner` 调用 LLM 生成
- **镜头 prompt 优化**：通过 `CinematographerPlanner` 调用 LLM，无 key 时 fallback
- **剪辑计划**：通过 `EditorPlanner` 调用 LLM，无 key 时 fallback
- **自动质检**：通过 `QaPlanner` 调用 LLM 做结构化审查，无 key 时 fallback
- **素材生成**：为每个 shot 生成一个占位视频 URL
- **自动剪辑**：返回一个占位 draft URL
- **导出成片**：返回一个占位 final URL

后续替换为真实视频生成时，只需修改 `asset-generation.ts` / `editing.ts` / `export.ts`，状态机和 runner 无需改动。

## 如何运行测试

```bash
cd packages/creator-helix
bun test --timeout 30000
```

预期结果：

```
Ran 5 tests across 3 files.
5 pass
0 fail
```

## 如何通过 API 跑通链路

```bash
# 1. 启动服务
cd packages/creator-helix
bun run server

# 2. 创建项目
PROJECT=$(curl -s -X POST http://localhost:3456/api/creator-helix/projects \
  -H "content-type: application/json" \
  -d '{"userId":"user-1","title":"测试视频"}')
PROJECT_ID=$(echo $PROJECT | jq -r '.id')

# 3. 提交需求（当前需要直接操作数据库或扩展 API 来触发 SUBMIT_REQUIREMENT）
# TODO: 后续会暴露完整的状态事件 API

# 4. 运行自动步骤
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run

# 5. 审批脚本
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/reviews/script \
  -H "content-type: application/json" \
  -d '{"action":"approved"}'

# 6. 继续运行
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run

# 7. 审批分镜
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/reviews/storyboard \
  -H "content-type: application/json" \
  -d '{"action":"approved"}'

# 8. 自动完成素材生成、剪辑
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run

# 9. 审批成片
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/reviews/final \
  -H "content-type: application/json" \
  -d '{"action":"approved"}'

# 10. 导出完成
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run
```

> 注意：当前 API 缺少直接提交需求的接口，需要后续补充 `POST /projects/:projectID/requirement`。
