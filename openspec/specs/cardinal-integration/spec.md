# Spec: Cardinal 集成

## Overview

Cardinal 是一个预算/风险控制系统，需要在 tool 调用前评估是否 block/pause/warn/stop。

## Requirements

### Requirement 1: Cardinal Service 定义

- **Acceptance Criteria**:
  - `src/session/cardinal.ts` 中存在 `Context.Service`
  - 暴露 `evaluate(input)` 方法
- **Verification**: grep "Context.Service.*Cardinal" packages/opencode/src/session/cardinal.ts
- **Status**: implemented

### Requirement 2: Cardinal 在 app-runtime.ts 中注册

- **Acceptance Criteria**:
  - `Cardinal.defaultLayer` 出现在 `AppLayer` 中
- **Verification**: grep "Cardinal.defaultLayer" packages/opencode/src/effect/app-runtime.ts
- **Status**: implemented

### Requirement 3: processor.ts 在 tool 调用前调用 Cardinal

- **Acceptance Criteria**:
  - `processor.ts` 中 `case "tool-call"` 分支调用 `cardinal.evaluate()`
  - block 时调用 `failToolCall`
  - pause 时触发权限确认
- **Verification**: grep "cardinal.evaluate" packages/opencode/src/session/processor.ts
- **Status**: implemented
