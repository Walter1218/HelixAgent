export * as Inbox from "./inbox"

import { Context, Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { makeGlobalNode } from "@opencode-ai/core/effect/app-node"
import { InboxTable } from "./inbox.sql"
import { eq, and, desc } from "drizzle-orm"

export interface InboxMessage {
  id: string
  receiver_session: string
  receiver_actor: string
  sender_actor: string
  content: string
  type: string
  read: boolean
  time_created: number
}

export interface Interface {
  readonly send: (message: {
    receiver_session: string
    receiver_actor: string
    sender_actor: string
    content: string
    type: string
  }) => Effect.Effect<InboxMessage>
  readonly list: (input: {
    session_id: string
    actor_id?: string
    unread_only?: boolean
    limit?: number
  }) => Effect.Effect<InboxMessage[]>
  readonly markRead: (messageId: string) => Effect.Effect<void>
  readonly markAllRead: (sessionId: string, actorId?: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Inbox") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const send = Effect.fn("Inbox.send")(function* (message) {
      const id = `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const now = Date.now()

      yield* db.run(
        db.insert(InboxTable).values({
          id,
          receiver_session: message.receiver_session,
          receiver_actor: message.receiver_actor,
          sender_actor: message.sender_actor,
          content: message.content,
          type: message.type,
          read: 0,
          time_created: now,
        })
      ).pipe(Effect.orDie)

      return {
        id,
        receiver_session: message.receiver_session,
        receiver_actor: message.receiver_actor,
        sender_actor: message.sender_actor,
        content: message.content,
        type: message.type,
        read: false,
        time_created: now,
      }
    })

    const list = Effect.fn("Inbox.list")(function* (input) {
      const conditions = [eq(InboxTable.receiver_session, input.session_id)]

      if (input.actor_id) {
        conditions.push(eq(InboxTable.receiver_actor, input.actor_id))
      }

      if (input.unread_only) {
        conditions.push(eq(InboxTable.read, 0))
      }

      const limit = input.limit ?? 50

      const rows = yield* db
        .select()
        .from(InboxTable)
        .where(and(...conditions))
        .orderBy(desc(InboxTable.time_created))
        .limit(limit)
        .pipe(Effect.orDie)

      return rows.map(row => ({
        id: row.id,
        receiver_session: row.receiver_session,
        receiver_actor: row.receiver_actor,
        sender_actor: row.sender_actor,
        content: row.content,
        type: row.type,
        read: row.read === 1,
        time_created: row.time_created,
      }))
    })

    const markRead = Effect.fn("Inbox.markRead")(function* (messageId) {
      yield* db.run(
        db.update(InboxTable)
          .set({ read: 1 })
          .where(eq(InboxTable.id, messageId))
      ).pipe(Effect.orDie)
    })

    const markAllRead = Effect.fn("Inbox.markAllRead")(function* (sessionId, actorId) {
      const conditions = [eq(InboxTable.receiver_session, sessionId)]
      if (actorId) {
        conditions.push(eq(InboxTable.receiver_actor, actorId))
      }

      yield* db.run(
        db.update(InboxTable)
          .set({ read: 1 })
          .where(and(...conditions))
      ).pipe(Effect.orDie)
    })

    return Service.of({ send, list, markRead, markAllRead })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })
