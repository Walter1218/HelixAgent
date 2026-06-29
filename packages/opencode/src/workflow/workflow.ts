import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Database } from "@opencode-ai/core/database/database"
import { WorkflowRunTable } from "@opencode-ai/core/workflow/workflow.sql"
import { eq } from "drizzle-orm"

export interface WorkflowConfig {
  maxConcurrentAgents: number
  scriptDeadlineMs: number
  maxLifecycleAgents: number
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxConcurrentAgents: 16,
  scriptDeadlineMs: 12 * 60 * 60 * 1000,
  maxLifecycleAgents: 1000,
}

export type WorkflowStatus = "running" | "completed" | "failed" | "cancelled"

export interface WorkflowRun {
  runID: string
  sessionID: string
  status: WorkflowStatus
  name?: string
  startedAt: number
  completedAt?: number
  error?: string
}

export interface WorkflowResult {
  status: WorkflowStatus
  result?: unknown
  error?: string
  duration: number
}

export function createRunId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function isTerminalStatus(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`
}

export interface Interface {
  readonly createRunId: () => Effect.Effect<string>
  readonly isTerminalStatus: (status: WorkflowStatus) => Effect.Effect<boolean>
  readonly formatDuration: (ms: number) => Effect.Effect<string>
  readonly startRun: (input: { sessionID: string; name?: string }) => Effect.Effect<WorkflowRun, Error>
  readonly completeRun: (runID: string, status: WorkflowStatus, error?: string) => Effect.Effect<void, Error>
  readonly getRunsBySession: (sessionID: string) => Effect.Effect<WorkflowRun[], Error>
  readonly cancelRunBySession: (sessionID: string) => Effect.Effect<void, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Workflow") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const startRun = Effect.fn("Workflow.startRun")(function* (input: { sessionID: string; name?: string }) {
      const runID = createRunId()
      const now = Date.now()

      yield* db.insert(WorkflowRunTable).values({
        id: runID,
        run_id: runID,
        session_id: input.sessionID,
        name: input.name,
        status: "running",
        started_at: now,
      }).pipe(Effect.orDie)

      return {
        runID,
        sessionID: input.sessionID,
        status: "running" as WorkflowStatus,
        name: input.name,
        startedAt: now,
      }
    })

    const completeRun = Effect.fn("Workflow.completeRun")(function* (
      runID: string,
      status: WorkflowStatus,
      error?: string,
    ) {
      yield* db.update(WorkflowRunTable)
        .set({
          status,
          completed_at: Date.now(),
          error: error ?? null,
        })
        .where(eq(WorkflowRunTable.run_id, runID))
        .pipe(Effect.orDie)
    })

    const getRunsBySession = Effect.fn("Workflow.getRunsBySession")(function* (sessionID: string) {
      const rows = yield* db.select().from(WorkflowRunTable)
        .where(eq(WorkflowRunTable.session_id, sessionID))
        .all()
        .pipe(Effect.orDie)

      return rows.map((row: any) => ({
        runID: row.run_id,
        sessionID: row.session_id,
        status: row.status as WorkflowStatus,
        name: row.name ?? undefined,
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        error: row.error ?? undefined,
      }))
    })

    const cancelRunBySession = Effect.fn("Workflow.cancelRunBySession")(function* (sessionID: string) {
      yield* db.update(WorkflowRunTable)
        .set({
          status: "cancelled",
          completed_at: Date.now(),
        })
        .where(eq(WorkflowRunTable.session_id, sessionID))
        .pipe(Effect.orDie)
    })

    return Service.of({
      createRunId: () => Effect.succeed(createRunId()),
      isTerminalStatus: (status) => Effect.succeed(isTerminalStatus(status)),
      formatDuration: (ms) => Effect.succeed(formatDuration(ms)),
      startRun,
      completeRun,
      getRunsBySession,
      cancelRunBySession,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [Database.node] })

export * as Workflow from "./workflow"
