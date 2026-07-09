export * as ProjectRepository from "./repository"

import { eq } from "drizzle-orm"
import { Clock, Context, Effect, Layer, Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { VideoProject } from "../schema/project"
import type { Event } from "../state-machine/states"
import { ProjectTable, TransitionLogTable } from "./sql"

export interface Interface {
  readonly get: (id: VideoProject.ID) => Effect.Effect<VideoProject.Info | undefined>
  readonly create: (input: {
    id?: VideoProject.ID
    userId: string
    title: string
    state?: VideoProject.State
    context?: VideoProject.Context
  }) => Effect.Effect<VideoProject.Info>
  readonly save: (project: VideoProject.Info) => Effect.Effect<void>
  readonly logTransition: (input: {
    projectId: VideoProject.ID
    fromState: VideoProject.State
    toState: VideoProject.State
    event: Event
  }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode-ai/creator-helix/ProjectRepository") {}

const fromRow = (row: typeof ProjectTable.$inferSelect): VideoProject.Info => ({
  id: VideoProject.ID.make(row.id),
  userId: row.user_id,
  title: row.title,
  state: row.state as VideoProject.State,
  context: Schema.decodeUnknownSync(VideoProject.Context)(row.context),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toRow = (project: VideoProject.Info) => ({
  id: project.id,
  user_id: project.userId,
  title: project.title,
  state: project.state,
  context: Schema.encodeUnknownSync(VideoProject.Context)(project.context),
  created_at: project.createdAt,
  updated_at: project.updatedAt,
})

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    return Service.of({
      get: Effect.fn("ProjectRepository.get")(function* (id) {
        const row = yield* db.select().from(ProjectTable).where(eq(ProjectTable.id, id)).get().pipe(Effect.orDie)
        return row ? fromRow(row) : undefined
      }),

      create: Effect.fn("ProjectRepository.create")(function* (input) {
        const now = yield* Clock.currentTimeMillis
        const project: VideoProject.Info = {
          id: input.id ?? VideoProject.ID.make(crypto.randomUUID()),
          userId: input.userId,
          title: input.title,
          state: input.state ?? "PROJECT_INIT",
          context: input.context ?? {
            requirement: undefined,
            script: undefined,
            storyboard: undefined,
            assets: [],
            pausedFrom: undefined,
            error: undefined,
          },
          createdAt: now,
          updatedAt: now,
        }
        yield* db.insert(ProjectTable).values(toRow(project)).pipe(Effect.orDie)
        return project
      }),

      save: Effect.fn("ProjectRepository.save")(function* (project) {
        yield* db
          .update(ProjectTable)
          .set(toRow(project))
          .where(eq(ProjectTable.id, project.id))
          .pipe(Effect.orDie)
      }),

      logTransition: Effect.fn("ProjectRepository.logTransition")(function* (input) {
        yield* db
          .insert(TransitionLogTable)
          .values({
            project_id: input.projectId,
            from_state: input.fromState,
            to_state: input.toState,
            event_type: input.event.type,
            event_payload: input.event,
          })
          .pipe(Effect.orDie)
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
