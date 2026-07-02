import { Effect, Layer } from "effect"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { OpenSpec } from "@/openspec/spec"
import { OpenSpecJudge } from "@/openspec/judge"
import { SpecReport } from "@/openspec/report"
import { GoalJudge } from "@/session/goal-judge"
import { CardinalPreflight } from "@/session/preflight"
import { OpenSpecPrecheck } from "@/openspec/precheck"
import { Trace } from "@/trace/trace"
import fs from "fs"
import path from "path"

// ══════════════════════════════════════════
// Mock Trace layer (in-memory, no SQLite)
// ══════════════════════════════════════════

export function createMockTraceLayer() {
  const events: any[] = []
  return {
    layer: Layer.succeed(Trace.Service, Trace.Service.of({
      emit: (event: any) => Effect.sync(() => { events.push({ ...event, timestamp: Date.now() }) }),
      getTraces: (sessionID: string) => Effect.sync(() => events.filter(e => e.metadata?.sessionID === sessionID)),
      getTracesByTimeRange: () => Effect.sync(() => events),
    })),
    events,
  }
}

// ══════════════════════════════════════════
// Service layers
// ══════════════════════════════════════════

export function createLayers(traceEvents?: any[]) {
  const trace = createMockTraceLayer()
  const events = traceEvents ?? trace.events

  const traceLayer = Layer.succeed(Trace.Service, Trace.Service.of({
    emit: (event: any) => Effect.sync(() => { events.push({ ...event, timestamp: Date.now() }) }),
    getTraces: (sessionID: string) => Effect.sync(() => events.filter(e => e.metadata?.sessionID === sessionID)),
    getTracesByTimeRange: () => Effect.sync(() => events),
  }))

  return {
    trace: traceLayer,
    goal: Goal.defaultLayer,
    cardinal: Cardinal.defaultLayer,
    alignmentGuard: AlignmentGuard.defaultLayer,
    openSpec: OpenSpec.defaultLayer,
    specReport: SpecReport.layer.pipe(Layer.provide(OpenSpec.defaultLayer), Layer.provide(OpenSpecJudge.defaultLayer), Layer.provide(traceLayer)),
    goalJudge: GoalJudge.layer.pipe(Layer.provide(Goal.defaultLayer), Layer.provide(traceLayer)),
    cardinalPreflight: CardinalPreflight.layer.pipe(Layer.provide(Cardinal.defaultLayer), Layer.provide(traceLayer)),
    openSpecPrecheck: OpenSpecPrecheck.layer.pipe(Layer.provide(OpenSpec.defaultLayer), Layer.provide(traceLayer)),
    events,
  }
}

// ══════════════════════════════════════════
// Temp directory fixture
// ══════════════════════════════════════════

export function createTmpDir(prefix = "qg-") {
  const tmpDir = fs.mkdtempSync(path.join("/tmp", prefix))
  return {
    path: tmpDir,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  }
}

// ══════════════════════════════════════════
// Spec file helpers
// ══════════════════════════════════════════

export function writeSpecFile(dir: string, name: string, content: string): string {
  const specDir = path.join(process.cwd(), "openspec", "specs")
  fs.mkdirSync(specDir, { recursive: true })
  const specFile = path.join(specDir, name)
  fs.writeFileSync(specFile, content)
  return specFile
}

export function cleanupSpecFile(name: string) {
  const specFile = path.join(process.cwd(), "openspec", "specs", name)
  try { fs.unlinkSync(specFile) } catch {}
}

export function writeAuthFile(dir: string, content: string): string {
  const authFile = path.join(dir, "auth.ts")
  fs.writeFileSync(authFile, content)
  return authFile
}
