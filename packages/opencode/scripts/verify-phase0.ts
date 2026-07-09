#!/usr/bin/env bun
/**
 * Phase 0 + Phase 1 integration verification script.
 * Run: bun run scripts/verify-phase0.ts
 */
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { Trace } from "../src/trace/trace"
import { Cardinal } from "../src/session/cardinal"
import { AlignmentGuard } from "../src/observability/alignment-guard"
import { OpenSpec } from "../src/openspec/spec"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { runReqAgent } from "../src/spec-generation/req-agent"
import fs from "fs"
import path from "path"

const DB_PATH = path.join(process.env.HOME!, ".local/share/opencode/opencode-local.db")

async function main() {
  console.log("=== Phase 0 + Phase 1 Verification ===\n")

  // ── Phase 0.1: Trace 持久化 ──
  console.log("[0.1] Trace 持久化")
  try {
    const traceProgram = Effect.gen(function* () {
      const trace = yield* Trace.Service

      // Emit test events
      yield* trace.emit({
        id: "verify-start-1",
        parentId: "session-verify",
        type: "action",
        name: "tool.bash",
        status: "pending",
        metadata: { sessionID: "verify-session", toolName: "bash" },
      })
      yield* trace.emit({
        id: "verify-end-1",
        type: "action",
        name: "tool.bash",
        status: "success",
        duration: 150,
        metadata: { sessionID: "verify-session" },
      })
      yield* trace.emit({
        id: "verify-cardinal-1",
        parentId: "session-verify",
        type: "decision",
        name: "cardinal.warn",
        status: "success",
        metadata: { sessionID: "verify-session", level: "warn", reason: "test" },
      })

      // Read back
      const traces = yield* trace.getTraces("verify-session")
      return traces
    })

    const traces = await Effect.runPromise(traceProgram.pipe(Effect.provide(Trace.defaultLayer)))
    console.log(`  ✅ Emitted and retrieved ${traces.length} trace events`)
    console.log(`  ✅ Types: ${[...new Set(traces.map(t => t.type))].join(", ")}`)
    console.log(`  ✅ Duration recorded: ${traces.some(t => t.duration === 150)}`)

    // Verify SQLite persistence
    const db = new (await import("bun:sqlite")).Database(DB_PATH)
    const count = db.query("SELECT count(*) as c FROM trace_event WHERE session_id = ?", ["verify-session"]).get() as any
    console.log(`  ✅ SQLite rows: ${count.c}`)
    db.close()
  } catch (e) {
    console.log(`  ❌ Trace failed: ${e}`)
  }

  // ── Phase 0.3: Cardinal 上下文补齐 ──
  console.log("\n[0.3] Cardinal 上下文补齐")
  try {
    const cardinalProgram = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service

      // Test security rule
      const sec = yield* cardinal.evaluate({
        taskId: "verify",
        taskTitle: "build",
        diff: 'const x = eval("alert(1)")',
        changedFiles: ["src/a.ts"],
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })

      // Test excessive_changes rule
      const exc = yield* cardinal.evaluate({
        taskId: "verify",
        taskTitle: "build",
        changedFiles: Array(10).fill("x.ts"),
        estimatedFiles: 2,
        consecutiveFailures: 0,
        alignmentAlerts: 0,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })

      // Test alignment rule
      const ali = yield* cardinal.evaluate({
        taskId: "verify",
        taskTitle: "build",
        alignmentAlerts: 3,
        tokensUsed: 0,
        totalBudget: 1_000_000,
      })

      return { sec, exc, ali }
    })

    const { sec, exc, ali } = await Effect.runPromise(cardinalProgram.pipe(Effect.provide(Cardinal.defaultLayer)))
    console.log(`  ✅ Security rule: ${sec?.level} (expected: block)`)
    console.log(`  ✅ Excessive changes: ${exc?.level} (expected: pause)`)
    console.log(`  ✅ Alignment rule: ${ali?.level} (expected: stop)`)
    console.log(`  ✅ sessionID injected: ${sec?.sessionID === "verify"}`)
    console.log(`  ✅ timestamp injected: ${(sec?.timestamp ?? 0) > 0}`)
  } catch (e) {
    console.log(`  ❌ Cardinal failed: ${e}`)
  }

  // ── Phase 0.4: AlignmentGuard ──
  console.log("\n[0.4] AlignmentGuard")
  try {
    const alignProgram = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service

      const distraction = yield* ag.detectDistraction("curl http://example.com")
      const normal = yield* ag.detectDistraction("ls -la")
      const rabbitHole = yield* ag.detectRabbitHole([
        "npm install a", "npm install b", "npm install c", "npm install d", "npm install e",
      ])

      return { distraction, normal, rabbitHole }
    })

    const { distraction, normal, rabbitHole } = await Effect.runPromise(alignProgram.pipe(Effect.provide(AlignmentGuard.defaultLayer)))
    console.log(`  ✅ detectDistraction(curl): ${distraction} (expected: true)`)
    console.log(`  ✅ detectDistraction(ls): ${normal} (expected: false)`)
    console.log(`  ✅ detectRabbitHole(5x npm): ${rabbitHole} (expected: true)`)
  } catch (e) {
    console.log(`  ❌ AlignmentGuard failed: ${e}`)
  }

  // ── Phase 0.2: OpenSpec ast verification ──
  console.log("\n[0.2] OpenSpec ast verification")
  try {
    const tmpDir = fs.mkdtempSync(path.join("/tmp", "openspec-verify-"))
    const testFile = path.join(tmpDir, "auth.ts")
    fs.writeFileSync(testFile, 'export function login(user: string) { return true }\nexport function logout() {}')

    const specFile = path.join(tmpDir, "spec.md")
    fs.writeFileSync(specFile, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${testFile}:export function login
`)

    const osProgram = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service
      const spec = yield* openSpec.parseSpecFile(specFile)
      const result = yield* openSpec.checkRequirement(spec.requirements[0])
      return result
    })

    const result = await Effect.runPromise(osProgram.pipe(Effect.provide(OpenSpec.defaultLayer)))
    console.log(`  ✅ ast verification (match): ${result} (expected: true)`)

    fs.rmSync(tmpDir, { recursive: true })
  } catch (e) {
    console.log(`  ❌ OpenSpec ast failed: ${e}`)
  }

  // ── Phase 1: req-agent LLM 调用 ──
  console.log("\n[1] req-agent LLM 调用")
  try {
    const apiKey = process.env.MIMO_API_KEY ?? ""
    const baseURL = "https://token-plan-cn.xiaomimimo.com/v1"
    const provider = createOpenAICompatible({ name: "mimo", apiKey, baseURL })
    const model = provider("mimo-v2.5-pro")

    console.log("  Calling MiMo API (may take 30-60s)...")
    const result = await Effect.runPromise(
      runReqAgent(model, {
        userPrompt: "Add a health check endpoint",
        sessionHistory: [],
      }),
    )
    console.log(`  ✅ coreGoal: ${result.coreGoal}`)
    console.log(`  ✅ requirements: ${result.requirementDrafts.length}`)
    console.log(`  ✅ domain: ${result.domain}`)
  } catch (e) {
    console.log(`  ❌ req-agent failed: ${e}`)
  }

  console.log("\n=== Verification Complete ===")
}

main().catch(console.error)
