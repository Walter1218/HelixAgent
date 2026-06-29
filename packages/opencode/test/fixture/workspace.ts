import { FetchHttpClient } from "effect/unstable/http"
import { Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Auth } from "../../src/auth"
import { Workspace } from "../../src/control-plane/workspace"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { InstanceStore } from "../../src/project/instance-store"
import { Project } from "../../src/project/project"
import { Vcs } from "../../src/project/vcs"
import { Session } from "../../src/session/session"
import { SessionPrompt } from "../../src/session/prompt"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Trace } from "../../src/trace/trace"
import { Metrics } from "../../src/metrics/metrics"
import { TokenTracker } from "../../src/token/tracker"
import { Cardinal } from "../../src/session/cardinal"
import { AlignmentGuard } from "../../src/observability/alignment-guard"
import { Goal } from "../../src/session/goal"
import { ModeRegistry } from "../../src/session/mode-registry"
import { AutoDream } from "../../src/session/auto-dream"
import { SessionCheckpoint } from "../../src/session/checkpoint"
import { SessionStatus } from "../../src/session/status"

export const workspaceLayerWithRuntimeFlags = (overrides: Partial<RuntimeFlags.Info>) =>
  (
    Workspace.layer.pipe(
      Layer.provide(Auth.defaultLayer),
      Layer.provide(Session.defaultLayer),
      Layer.provide(SessionPrompt.defaultLayer),
      Layer.provide(Project.defaultLayer),
      Layer.provide(Vcs.defaultLayer),
      Layer.provide(Database.defaultLayer),
      Layer.provide(EventV2Bridge.defaultLayer),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(FSUtil.defaultLayer),
      Layer.provide(RuntimeFlags.layer(overrides)),
      Layer.provideMerge(Layer.mergeAll(InstanceStore.defaultLayer, InstanceBootstrap.defaultLayer)),
      Layer.provide(Trace.defaultLayer),
      Layer.provide(Metrics.defaultLayer),
      Layer.provide(TokenTracker.defaultLayer),
      Layer.provide(Cardinal.defaultLayer),
      Layer.provide(AlignmentGuard.defaultLayer),
      Layer.provide(Goal.defaultLayer),
      Layer.provide(ModeRegistry.defaultLayer),
      Layer.provide(AutoDream.defaultLayer),
      Layer.provideMerge(Layer.mergeAll(SessionCheckpoint.defaultLayer, SessionStatus.defaultLayer)),
    ) as any
  ) as Layer.Layer<Workspace.Service, never, never>
