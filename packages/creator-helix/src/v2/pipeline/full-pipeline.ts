export * as V2FullPipeline from "./full-pipeline"

import { Effect } from "effect"
import type { Studio } from "../../studio/schema/studio"
import type { Project } from "../../project/schema/project"
import type { Shot } from "../../project/schema/shot"
import { decideShotBatch, decideGlobalStyle, type ShotContext } from "../llm/decisions"
import { buildShotPrompt } from "../prompt/builder"
import { SeedDanceClient } from "../../services/seeddance-client"
import { TraceRepository, type PipelineEventType, type EventStatus } from "../../trace/repository"

export interface FullPipelineInput {
  readonly project: Project
  readonly studio: Studio
  readonly requirementStyle: string
  readonly runId: string
}

export interface ShotVideoResult {
  readonly shotId: string
  readonly prompt: string
  readonly videoUrl: string | null
  readonly decision: {
    templateId: string
    motion: string
    mood: string
    qualityTier: string
  }
}

export interface FullPipelineResult {
  runId: string
  globalStyle: {
    readonly colorPalette: ReadonlyArray<string>
    readonly lighting: string
    readonly postProcessing: ReadonlyArray<string>
    readonly moodKeywords: ReadonlyArray<string>
    readonly qualityTier: string
  }
  shots: ShotVideoResult[]
}

export const runFullPipeline = (
  input: FullPipelineInput,
): Effect.Effect<FullPipelineResult, Error, TraceRepository.Service> =>
  Effect.gen(function* () {
    const { project, studio, requirementStyle, runId } = input
    const trace = yield* TraceRepository.Service
    const startTime = Date.now()

    yield* trace.recordEvent({
      runId,
      eventType: "pipeline_started",
      status: "started",
      data: { total_shots: extractAllShots(project).length },
    })

    // ─── Phase 1: Global Style ───
    const gsStart = Date.now()
    const globalStyle = yield* decideGlobalStyle({ requirementStyle })
    yield* trace.recordEvent({
      runId,
      eventType: "global_style_decided",
      status: "succeeded",
      durationMs: Date.now() - gsStart,
      data: {
        colorPalette: globalStyle.colorPalette,
        lighting: globalStyle.lighting,
        qualityTier: globalStyle.qualityTier,
        reasoning: globalStyle.reasoning,
      },
    })

    // ─── Phase 2: Shot Decisions ───
    const allShots = extractAllShots(project)
    const shotContexts: ShotContext[] = allShots.map(({ shot, sequenceId, index, total }) => ({
      description: shot.narrativePurpose,
      visualPrompt: shot.prompt.visualDesc,
      motionPrompt: shot.camera.type,
      narration: shot.audio.dialogueRef ?? undefined,
      sequenceContext: `Sequence ${sequenceId}, shot ${index + 1} of ${total}`,
      charactersPresent: shot.subjects.map(s => s.characterId),
    }))

    const sdStart = Date.now()
    const decisions = shotContexts.length > 0
      ? yield* decideShotBatch(shotContexts)
      : []
    yield* trace.recordEvent({
      runId,
      eventType: "shots_decided",
      status: "succeeded",
      durationMs: Date.now() - sdStart,
      data: { shot_count: decisions.length, templates: decisions.map(d => d.templateId) },
    })

    // ─── Phase 3: Per-shot Prompt + Video ───
    const shotResults: ShotVideoResult[] = []

    for (let i = 0; i < allShots.length; i++) {
      const { shot } = allShots[i]
      const decision = decisions[i]
      if (!decision) continue

      const shotStart = Date.now()
      const built = yield* buildShotPrompt(shot, studio, decision)
      yield* trace.recordEvent({
        runId,
        shotId: shot.id,
        eventType: "prompt_built",
        status: "succeeded",
        durationMs: Date.now() - shotStart,
        data: {
          templateId: decision.templateId,
          mood: decision.mood,
          qualityTier: decision.qualityTier,
          promptLength: built.text.length,
          referencesCount: built.references.length,
        },
      })

      const vidStart = Date.now()
      const videoResult = yield* SeedDanceClient.generateVideo({
        content: [{ type: "text" as const, text: built.text }],
        duration: shot.duration,
        ratio: "16:9",
        generateAudio: false,
        watermark: false,
      }).pipe(Effect.catch((e) => Effect.succeed({
        status: "failed" as const,
        taskId: "",
        videoUrl: undefined,
        error: String(e),
      })))

      const isSuccess = videoResult.status === "succeeded" && !!videoResult.videoUrl
      yield* trace.recordEvent({
        runId,
        shotId: shot.id,
        eventType: isSuccess ? "video_succeeded" : "video_failed",
        status: isSuccess ? "succeeded" : "failed",
        durationMs: Date.now() - vidStart,
        data: {
          taskId: videoResult.taskId,
          videoUrl: videoResult.videoUrl,
          error: videoResult.error,
        },
        error: videoResult.error ?? undefined,
      })

      shotResults.push({
        shotId: shot.id,
        prompt: built.text,
        videoUrl: videoResult.videoUrl ?? null,
        decision: {
          templateId: decision.templateId,
          motion: decision.motion,
          mood: decision.mood,
          qualityTier: decision.qualityTier,
        },
      })
    }

    // ─── Complete ───
    const failedCount = shotResults.filter(s => !s.videoUrl).length
    const succeededCount = shotResults.filter(s => s.videoUrl).length
    const finalStatus = failedCount === 0 ? "succeeded" : succeededCount === 0 ? "failed" : "partial"

    yield* trace.recordEvent({
      runId,
      eventType: "pipeline_completed",
      status: "succeeded",
      durationMs: Date.now() - startTime,
      data: {
        totalShots: shotResults.length,
        succeededShots: succeededCount,
        failedShots: failedCount,
      },
    })

    yield* trace.completeRun(runId, finalStatus)

    return {
      runId,
      globalStyle: {
        colorPalette: globalStyle.colorPalette,
        lighting: globalStyle.lighting,
        postProcessing: globalStyle.postProcessing,
        moodKeywords: globalStyle.moodKeywords,
        qualityTier: globalStyle.qualityTier,
      },
      shots: shotResults,
    }
  })

function extractAllShots(project: Project): ReadonlyArray<{ shot: Shot; sequenceId: string; index: number; total: number }> {
  return project.scripts.flatMap((script) =>
    script.sequences.flatMap((seq) =>
      seq.shots.map((shot, i) => ({
        shot,
        sequenceId: seq.id,
        index: i,
        total: seq.shots.length,
      }))
    )
  )
}
