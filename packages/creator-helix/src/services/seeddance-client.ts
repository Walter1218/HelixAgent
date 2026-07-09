export * as SeedDanceClient from "./seeddance-client"

import { Effect } from "effect"


const apiBase = process.env.SEEDANCE_API_BASE ?? "https://ark.cn-beijing.volces.com/api/v3"
const apiKey = process.env.SEEDANCE_API_KEY ?? ""

export interface ContentItem {
  readonly type: "text" | "image_url" | "video_url" | "audio_url"
  readonly text?: string
  readonly image_url?: { url: string }
  readonly video_url?: { url: string }
  readonly audio_url?: { url: string }
  readonly role?: "reference_image" | "reference_video" | "reference_audio"
}

export interface GenerateVideoOptions {
  readonly content: ContentItem[]
  readonly model?: string
  readonly ratio?: string
  readonly duration?: number
  readonly generateAudio?: boolean
  readonly watermark?: boolean
}

const DEFAULT_MODEL = "doubao-seedance-2-0-mini-260615"

export interface TaskResult {
  readonly taskId: string
  readonly status: "submitted" | "processing" | "succeeded" | "failed"
  readonly videoUrl?: string
  readonly error?: string
}

const apiFetch = (path: string, init?: RequestInit): Effect.Effect<Response, Error> =>
  Effect.tryPromise({
    try: () => fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    }),
    catch: (e) => new Error(`SeedDance request failed: ${e}`),
  })

const parseResponse = <T>(response: Response): Effect.Effect<T, Error> =>
  Effect.tryPromise({
    try: () => response.json() as Promise<T>,
    catch: (e) => new Error(`SeedDance response parse failed: ${e}`),
  })

export const submitTask = (options: GenerateVideoOptions): Effect.Effect<TaskResult, Error> =>
  Effect.gen(function* () {
    const body = {
      model: options.model ?? DEFAULT_MODEL,
      content: options.content,
      generate_audio: options.generateAudio ?? false,
      ratio: options.ratio ?? "16:9",
      duration: options.duration ?? 5,
      watermark: options.watermark ?? false,
    }

    const response = yield* apiFetch("/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = yield* Effect.tryPromise(() => response.text())
      return yield* Effect.fail(new Error(`SeedDance API error ${response.status}: ${text}`))
    }

    const data = yield* parseResponse<{ id: string; model: string; status: string }>(response)

    return {
      taskId: data.id,
      status: data.status as "submitted",
    }
  })

export const queryTask = (taskId: string): Effect.Effect<TaskResult, Error> =>
  Effect.gen(function* () {
    const response = yield* apiFetch(`/contents/generations/tasks/${taskId}`, {
      method: "GET",
    })

    if (!response.ok) {
      const text = yield* Effect.tryPromise(() => response.text())
      return yield* Effect.fail(new Error(`SeedDance query error ${response.status}: ${text}`))
    }

    const data = yield* parseResponse<{
      id: string
      model: string
      status: string
      content?: { video_url?: string }
      error?: { message: string }
    }>(response)

    return {
      taskId: data.id,
      status: data.status as TaskResult["status"],
      videoUrl: data.content?.video_url,
      error: data.error?.message,
    }
  })

export const waitForCompletion = (
  taskId: string,
  maxAttempts?: number,
): Effect.Effect<TaskResult, Error> =>
  Effect.gen(function* () {
    const max = maxAttempts ?? 60
    let attempts = 0

    while (attempts < max) {
      const result = yield* queryTask(taskId)

      if (result.status === "succeeded" || result.status === "failed") {
        return result
      }

      yield* Effect.sleep(5000)
      attempts++
    }

    return yield* Effect.fail(new Error(`SeedDance task ${taskId} timed out after ${max} attempts`))
  })

export const generateVideo = (options: GenerateVideoOptions): Effect.Effect<TaskResult, Error> =>
  Effect.gen(function* () {
    const task = yield* submitTask(options)
    return yield* waitForCompletion(task.taskId)
  })


