import * as Tool from "./tool"
import DESCRIPTION from "./workflow.txt"
import { Schema, Effect, Exit, Fiber, Scope } from "effect"
import { Workflow } from "@/workflow/workflow"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["run", "status", "wait", "cancel"]),
  name: Schema.optional(Schema.String),
  script: Schema.optional(Schema.String),
  args: Schema.optional(Schema.Unknown),
  run_id: Schema.optional(Schema.String),
  timeout_ms: Schema.optional(Schema.Number),
})

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

const runs = new Map<string, { fiber: Fiber.Fiber<unknown, unknown>; scope: Scope.Scope; startedAt: number }>()

type WorkflowMetadata = {
  run_id?: string
  status?: string
}

function metadata(input: { run_id?: string; status?: string }): WorkflowMetadata {
  return input
}

export const WorkflowTool = Tool.define<
  typeof Parameters,
  WorkflowMetadata,
  Workflow.Service | ChildProcessSpawner | Scope.Scope
>(
  "workflow",
  Effect.gen(function* () {
    const workflow = yield* Workflow.Service
    const spawner = yield* ChildProcessSpawner

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<WorkflowMetadata>) =>
        Effect.gen(function* () {
          switch (params.operation) {
            case "run": {
              if (!params.script) {
                return { title: "error", output: "script is required for run operation", metadata: metadata({}) }
              }

              const run = yield* workflow.startRun({ sessionID: ctx.sessionID, name: params.name })

              const scope = yield* Scope.make()
              const workflowEffect = Effect.gen(function* () {
                const handle = yield* spawner.spawn(ChildProcess.make("sh", ["-c", params.script as string]))
                const exit = yield* handle.exitCode.pipe(Effect.exit)
                if (Exit.isSuccess(exit)) {
                  yield* workflow.completeRun(run.runID, "completed")
                } else {
                  yield* workflow.completeRun(run.runID, "failed", String(exit.cause))
                }
                return exit
              }).pipe(Effect.orDie)

              const fiber = yield* Effect.provideService(workflowEffect, Scope.Scope, scope).pipe(
                Effect.forkIn(scope),
              )

              runs.set(run.runID, { fiber, scope, startedAt: run.startedAt })

              return {
                title: `Workflow started: ${run.runID}`,
                output: `Started workflow "${params.name ?? run.runID}". Use run_id "${run.runID}" to check status or wait.`,
                metadata: metadata({ run_id: run.runID, status: "running" }),
              }
            }

            case "status": {
              if (!params.run_id) {
                return { title: "error", output: "run_id is required for status operation", metadata: metadata({}) }
              }
              const runsBySession = yield* workflow.getRunsBySession(ctx.sessionID)
              const run = runsBySession.find((r) => r.runID === params.run_id)
              if (!run) {
                return { title: "not found", output: `Workflow run ${params.run_id} not found`, metadata: metadata({}) }
              }
              return {
                title: `Workflow ${run.status}`,
                output: `run_id: ${run.runID}\nstatus: ${run.status}\nname: ${run.name ?? ""}\nstarted: ${new Date(run.startedAt).toISOString()}${run.completedAt ? `\ncompleted: ${new Date(run.completedAt).toISOString()}` : ""}${run.error ? `\nerror: ${run.error}` : ""}`,
                metadata: metadata({ run_id: run.runID, status: run.status }),
              }
            }

            case "wait": {
              if (!params.run_id) {
                return { title: "error", output: "run_id is required for wait operation", metadata: metadata({}) }
              }

              const active = runs.get(params.run_id)
              if (!active) {
                const runsBySession = yield* workflow.getRunsBySession(ctx.sessionID)
                const run = runsBySession.find((r) => r.runID === params.run_id)
                if (!run) {
                  return { title: "not found", output: `Workflow run ${params.run_id} not found`, metadata: metadata({}) }
                }
                return {
                  title: `Workflow ${run.status}`,
                  output: `Workflow ${params.run_id} is already ${run.status}.`,
                  metadata: metadata({ run_id: run.runID, status: run.status }),
                }
              }

              const timeout = params.timeout_ms ?? DEFAULT_TIMEOUT_MS
              const exit = yield* Fiber.await(active.fiber).pipe(
                Effect.timeoutOrElse({
                  duration: timeout,
                  orElse: () => Effect.succeed(Exit.fail(new Error(`Workflow ${params.run_id} timed out after ${timeout}ms`))),
                }),
              )

              if (Exit.isFailure(exit)) {
                return {
                  title: "workflow failed",
                  output: `Workflow ${params.run_id} failed or timed out: ${exit.cause}`,
                  metadata: metadata({ run_id: params.run_id, status: "failed" }),
                }
              }

              const runsBySession = yield* workflow.getRunsBySession(ctx.sessionID)
              const run = runsBySession.find((r) => r.runID === params.run_id)
              return {
                title: `Workflow ${run?.status ?? "completed"}`,
                output: `Workflow ${params.run_id} completed.`,
                metadata: metadata({ run_id: params.run_id, status: run?.status ?? "completed" }),
              }
            }

            case "cancel": {
              if (!params.run_id) {
                return { title: "error", output: "run_id is required for cancel operation", metadata: metadata({}) }
              }
              const active = runs.get(params.run_id)
              if (active) {
                yield* Fiber.interrupt(active.fiber)
                yield* Scope.close(active.scope, Exit.void)
                runs.delete(params.run_id)
              }
              yield* workflow.completeRun(params.run_id, "cancelled")
              return {
                title: "workflow cancelled",
                output: `Workflow ${params.run_id} cancelled.`,
                metadata: metadata({ run_id: params.run_id, status: "cancelled" }),
              }
            }
          }
        }).pipe(Effect.orDie),
    }
  }),
)
