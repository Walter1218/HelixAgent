export interface TraceEvent {
  id: string
  parentId?: string
  type: "node_start" | "node_end" | "action" | "decision" | "error"
  name: string
  status: "pending" | "success" | "failed"
  duration?: number
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface TraceConfig {
  enabled: boolean
  samplingEnabled: boolean
  samplingRate: number
  maxTraces: number
  retentionDays: number
}

export const DEFAULT_TRACE_CONFIG: TraceConfig = {
  enabled: true,
  samplingEnabled: false,
  samplingRate: 1.0,
  maxTraces: 10000,
  retentionDays: 7,
}

export function createTraceId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function formatTraceTree(events: TraceEvent[]): string {
  if (events.length === 0) return "(no trace events)"

  interface TreeNode extends TraceEvent {
    children: TreeNode[]
  }

  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const ev of events) {
    map.set(ev.id, { ...ev, children: [] })
  }
  for (const ev of events) {
    const node = map.get(ev.id)!
    if (ev.parentId && map.has(ev.parentId)) {
      map.get(ev.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const lines: string[] = []
  const render = (node: TreeNode, prefix: string, isLast: boolean) => {
    const connector = isLast ? "└── " : "├── "
    const icon = node.status === "success" ? "✓" : node.status === "failed" ? "✗" : "…"
    const dur = node.duration ? ` (${formatDuration(node.duration)})` : ""
    lines.push(`${prefix}${connector}${icon} ${node.name}${dur}`)

    const childPrefix = prefix + (isLast ? "    " : "│   ")
    for (let i = 0; i < node.children.length; i++) {
      render(node.children[i], childPrefix, i === node.children.length - 1)
    }
  }

  for (let i = 0; i < roots.length; i++) {
    render(roots[i], "", i === roots.length - 1)
  }

  return lines.join("\n")
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

export function filterByStatus(events: TraceEvent[], status: TraceEvent["status"]): TraceEvent[] {
  return events.filter(e => e.status === status)
}

export function filterByType(events: TraceEvent[], type: TraceEvent["type"]): TraceEvent[] {
  return events.filter(e => e.type === type)
}

export function getDuration(events: TraceEvent[]): number {
  if (events.length === 0) return 0
  const starts = events.map(e => e.timestamp)
  const ends = events.map(e => e.timestamp + (e.duration || 0))
  return Math.max(...ends) - Math.min(...starts)
}

import { Effect, Ref, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Database } from "@opencode-ai/core/database/database"
import { TraceEventTable } from "@opencode-ai/core/trace/trace.sql"
import { eq, desc, and, gte, lte } from "drizzle-orm"

export interface Interface {
  readonly emit: (event: Omit<TraceEvent, "timestamp">) => Effect.Effect<void>
  readonly getTraces: (sessionID: string) => Effect.Effect<TraceEvent[]>
  readonly getTracesByTimeRange: (startTime: number, endTime: number) => Effect.Effect<TraceEvent[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Trace") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const cache = yield* Ref.make<TraceEvent[]>([])

    const emit = Effect.fn("Trace.emit")(function* (event: Omit<TraceEvent, "timestamp">) {
      const timestamp = Date.now()
      const fullEvent: TraceEvent = { ...event, timestamp }

      // Persist to SQLite (catch errors to avoid breaking the main flow)
      yield* db.insert(TraceEventTable).values({
        id: event.id,
        session_id: (event.metadata?.sessionID as string) ?? "",
        parent_id: event.parentId ?? null,
        type: event.type,
        name: event.name,
        status: event.status,
        duration: event.duration ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        time_created: timestamp,
      }).pipe(Effect.catch(() => Effect.void))

      // Update in-memory cache
      yield* Ref.update(cache, (arr) => [...arr.slice(-9999), fullEvent])
    })

    const getTraces = Effect.fn("Trace.getTraces")(function* (sessionID: string) {
      // Try cache first
      const cached = (yield* Ref.get(cache)).filter((e) => e.metadata?.sessionID === sessionID)
      if (cached.length > 0) return cached

      // Fallback to SQLite
      const rows = yield* db
        .select()
        .from(TraceEventTable)
        .where(eq(TraceEventTable.session_id, sessionID))
        .orderBy(desc(TraceEventTable.time_created))
        .all()
        .pipe(Effect.orDie)

      return rows.map(rowToEvent)
    })

    const getTracesByTimeRange = Effect.fn("Trace.getTracesByTimeRange")(function* (
      startTime: number,
      endTime: number,
    ) {
      const rows = yield* db
        .select()
        .from(TraceEventTable)
        .where(and(gte(TraceEventTable.time_created, startTime), lte(TraceEventTable.time_created, endTime)))
        .orderBy(desc(TraceEventTable.time_created))
        .all()
        .pipe(Effect.orDie)

      return rows.map(rowToEvent)
    })

    return Service.of({ emit, getTraces, getTracesByTimeRange })
  }),
)

function rowToEvent(row: typeof TraceEventTable.$inferSelect): TraceEvent {
  return {
    id: row.id,
    parentId: row.parent_id ?? undefined,
    type: row.type as TraceEvent["type"],
    name: row.name,
    status: row.status as TraceEvent["status"],
    duration: row.duration ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    timestamp: row.time_created,
  }
}

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [Database.node] })

export * as Trace from "./trace"
