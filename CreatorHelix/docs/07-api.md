# API 层设计

## 实现方式

CreatorHelix 的 API 采用 **Hono** 独立服务实现，挂载在 `packages/creator-helix/src/server/app.ts`。

没有直接扩展 `packages/server` 的 Effect HttpApi，原因是：
- CreatorHelix 是独立业务，未来可能单独部署
- 避免污染 `packages/protocol` 和 `packages/server`
- Hono 更轻量，适合快速验证

后续如果需要用 opencode client SDK 调用，可以再迁移到 `packages/protocol`。

## 启动

```bash
cd packages/creator-helix
bun run server
# 或
CREATOR_HELIX_PORT=3456 bun run server
```

默认端口：`3456`

## 接口列表

### 1. 创建项目

```http
POST /api/creator-helix/projects
Content-Type: application/json

{
  "userId": "user-123",
  "title": "新品发布视频"
}
```

响应 `201`：

```json
{
  "id": "...",
  "userId": "user-123",
  "title": "新品发布视频",
  "state": "PROJECT_INIT",
  "context": { ... },
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### 2. 获取项目

```http
GET /api/creator-helix/projects/:projectID
```

响应 `200` 或 `404`。

### 3. 启动自动运行

```http
POST /api/creator-helix/projects/:projectID/run
```

自动推进状态机，直到遇到人工审批点或完成。

### 4. 提交审批

```http
POST /api/creator-helix/projects/:projectID/reviews/:stage
Content-Type: application/json

{
  "action": "approved"
}
```

- `:stage`：`script` | `storyboard` | `final`
- `action`：`approved` | `rejected`

### 5. 暂停

```http
POST /api/creator-helix/projects/:projectID/pause
```

### 6. 恢复

```http
POST /api/creator-helix/projects/:projectID/resume
```

## 与 Effect Runtime 的集成

`app.ts` 中通过 `makeRuntime` 创建了一个 Effect runtime：

```typescript
const appLayer = ProjectRepository.defaultLayer.pipe(
  Layer.provide(BackgroundJob.defaultLayer),
  Layer.provide(Database.defaultLayer),
)

const { runPromise } = makeRuntime(ProjectRepository.Service, appLayer)
```

Hono handler 中使用 `runPromise` 调用 repository 和 runner：

```typescript
const project = await runPromise((repo) => repo.get(VideoProject.ID.make(projectID)))
```

## 启动流程

`src/server/start.ts`：

1. 先运行 migration 创建表
2. 启动 Bun HTTP server
3. 所有请求由 Hono app 处理

## 测试

```bash
cd packages/creator-helix
bun test --timeout 30000
```

已覆盖：
- Schema encode/decode
- 创建项目
- 获取不存在项目返回 404
- 端到端主链路 `PROJECT_INIT → COMPLETED`

## 主链路调用示例

```bash
# 创建项目
PROJECT=$(curl -s -X POST http://localhost:3456/api/creator-helix/projects \
  -H "content-type: application/json" \
  -d '{"userId":"user-1","title":"测试视频"}')
PROJECT_ID=$(echo $PROJECT | jq -r '.id')

# 运行自动步骤（遇到人工审批点会暂停）
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run

# 提交审批
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/reviews/script \
  -H "content-type: application/json" \
  -d '{"action":"approved"}'

# 继续运行
curl -X POST http://localhost:3456/api/creator-helix/projects/$PROJECT_ID/run
```

完整链路见 `docs/08-main-chain.md`。
