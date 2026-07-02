import { describe, expect, it, afterEach } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { createLayers, createTmpDir, writeSpecFile, cleanupSpecFile, writeAuthFile } from "./fixture"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { AlignmentGuard } from "@/observability/alignment-guard"
import { SpecReport } from "@/openspec/report"
import { GoalJudge } from "@/session/goal-judge"
import { CardinalPreflight } from "@/session/preflight"
import { OpenSpecPrecheck } from "@/openspec/precheck"

const SESSION = "e2e-test"

// ══════════════════════════════════════════
// Scenario 1: security-block
// 验证: 写 eval 被 Cardinal 阻断
// 应该通过: 文件无 eval
// 应该失败: 文件有 eval
// ══════════════════════════════════════════

describe("Scenario 1: security-block", () => {
  it("blocks eval/exec in diff", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        diff: 'const code = eval("alert(1)")',
      })
      return decision
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).not.toBeNull()
    expect(result!.level).toBe("block")
    expect(result!.reason).toContain("eval")
  })

  it("allows safe code", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        diff: 'const x = 1 + 2\nfunction hello() { return "world" }',
      })
      return decision
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).toBeNull()
  })

  it("blocks secret patterns", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      const decision = yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        diff: 'const apiKey = "sk-abc1234567890123456789012345678901234567890"',
      })
      return decision
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).not.toBeNull()
    expect(result!.level).toBe("block")
  })
})

// ══════════════════════════════════════════
// Scenario 2: spec-compliance
// 验证: 不合规时 SpecReport 正确报告
// 应该通过: 文件包含 pattern
// 应该失败: 文件不包含 pattern
// ══════════════════════════════════════════

describe("Scenario 2: spec-compliance", () => {
  const specFiles: string[] = []

  afterEach(() => {
    specFiles.forEach(cleanupSpecFile)
    specFiles.length = 0
  })

  it("approves when all requirements pass", async () => {
    const tmp = createTmpDir()
    const authFile = writeAuthFile(tmp.path, 'export function login() {}\nexport function logout() {}')
    const specFile = writeSpecFile(tmp.path, `e2e-compliance-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)
    specFiles.push(path.basename(specFile))

    const layers = createLayers()
    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      return yield* report.generateReport(specFile, SESSION)
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.specReport)))
    expect(result.overallApproved).toBe(true)
    expect(result.achievedRequirements.length).toBe(2)
    expect(result.missingRequirements.length).toBe(0)

    tmp.cleanup()
  })

  it("fails when requirements are missing", async () => {
    const tmp = createTmpDir()
    const authFile = writeAuthFile(tmp.path, 'export function login() {}')
    const specFile = writeSpecFile(tmp.path, `e2e-compliance-fail-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)
    specFiles.push(path.basename(specFile))

    const layers = createLayers()
    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      return yield* report.generateReport(specFile, SESSION)
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.specReport)))
    expect(result.overallApproved).toBe(false)
    expect(result.missingRequirements.length).toBe(1)

    tmp.cleanup()
  })
})

// ══════════════════════════════════════════
// Scenario 3: excessive-changes
// 验证: 改太多文件触发 Cardinal pause
// ══════════════════════════════════════════

describe("Scenario 3: excessive-changes", () => {
  it("triggers pause when changedFiles exceed estimatedFiles", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      return yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"],
        estimatedFiles: 2,
      })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).not.toBeNull()
    expect(result!.level).toBe("pause")
    expect(result!.reason).toContain("改动文件数")
  })

  it("does not trigger when within threshold", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      return yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        changedFiles: ["a.ts", "b.ts"],
        estimatedFiles: 5,
      })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).toBeNull()
  })
})

// ══════════════════════════════════════════
// Scenario 4: consecutive-failures
// 验证: 连续失败触发 Cardinal pause
// ══════════════════════════════════════════

describe("Scenario 4: consecutive-failures", () => {
  it("triggers pause at 3 consecutive failures", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      return yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        consecutiveFailures: 3,
      })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).not.toBeNull()
    expect(result!.level).toBe("pause")
    expect(result!.reason).toContain("连续失败")
  })

  it("does not trigger below threshold", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const cardinal = yield* Cardinal.Service
      return yield* cardinal.evaluate({
        taskId: SESSION,
        taskTitle: "build",
        consecutiveFailures: 2,
      })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinal)))
    expect(result).toBeNull()
  })
})

// ══════════════════════════════════════════
// Scenario 5: file-drift
// 验证: 改无关文件被 AlignmentGuard 检测
// ══════════════════════════════════════════

describe("Scenario 5: file-drift", () => {
  it("detects rabbit hole from install commands", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return yield* ag.detectRabbitHole([
        "npm install express",
        "npm install lodash",
        "npm install axios",
        "npm install moment",
        "npm install chalk",
      ])
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.alignmentGuard)))
    expect(result).toBe(true)
  })

  it("detects distraction from curl", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return yield* ag.detectDistraction("curl http://example.com")
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.alignmentGuard)))
    expect(result).toBe(true)
  })

  it("does not flag normal commands", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const ag = yield* AlignmentGuard.Service
      return {
        git: yield* ag.detectDistraction("git status"),
        bun: yield* ag.detectDistraction("bun test"),
        cat: yield* ag.detectDistraction("cat README.md"),
      }
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.alignmentGuard)))
    expect(result.git).toBe(false)
    expect(result.bun).toBe(false)
    expect(result.cat).toBe(false)
  })
})

// ══════════════════════════════════════════
// Scenario 6: goal-completion
// 验证: Goal Judge 判定目标完成度
// ══════════════════════════════════════════

describe("Scenario 6: goal-completion", () => {
  it("returns ok for achievable goal", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      return yield* judge.preflight({ sessionID: SESSION, condition: "Implement user login with JWT" })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.goalJudge)))
    expect(result.ok).toBe(true)
  })

  it("returns impossible for impossible goal", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const judge = yield* GoalJudge.Service
      return yield* judge.preflight({ sessionID: SESSION, condition: "This task is impossible to complete" })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.goalJudge)))
    expect(result.ok).toBe(false)
    expect(result.impossible).toBe(true)
  })

  it("auto-sets goal from spec", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const goal = yield* Goal.Service
      yield* goal.set(SESSION, "Implement SMS verification")
      const g = yield* goal.get(SESSION)
      yield* goal.clear(SESSION)
      return g
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.goal)))
    expect(result).toBeDefined()
    expect(result!.condition).toBe("Implement SMS verification")
    expect(result!.react).toBe(0)
  })
})

// ══════════════════════════════════════════
// Scenario 7: spec-report
// 验证: 验收报告生成正确
// ══════════════════════════════════════════

describe("Scenario 7: spec-report", () => {
  const specFiles: string[] = []

  afterEach(() => {
    specFiles.forEach(cleanupSpecFile)
    specFiles.length = 0
  })

  it("generates report with partial pass", async () => {
    const tmp = createTmpDir()
    const authFile = writeAuthFile(tmp.path, 'export function login() {}')
    const specFile = writeSpecFile(tmp.path, `e2e-report-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)
    specFiles.push(path.basename(specFile))

    const layers = createLayers()
    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      return yield* report.generateReport(specFile, SESSION)
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.specReport)))
    expect(result.overallApproved).toBe(false)
    expect(result.achievedRequirements.length).toBe(1)
    expect(result.missingRequirements.length).toBe(1)
    expect(result.requirementResults.length).toBe(2)

    tmp.cleanup()
  })

  it("generates report with full pass", async () => {
    const tmp = createTmpDir()
    const authFile = writeAuthFile(tmp.path, 'export function login() {}\nexport function logout() {}')
    const specFile = writeSpecFile(tmp.path, `e2e-report-full-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast ${authFile}:export function login
### Requirement 2: Logout
- **Status**: pending
- **Verification**: ast ${authFile}:export function logout
`)
    specFiles.push(path.basename(specFile))

    const layers = createLayers()
    const program = Effect.gen(function* () {
      const report = yield* SpecReport.Service
      return yield* report.generateReport(specFile, SESSION)
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.specReport)))
    expect(result.overallApproved).toBe(true)
    expect(result.achievedRequirements.length).toBe(2)
    expect(result.missingRequirements.length).toBe(0)

    tmp.cleanup()
  })
})

// ══════════════════════════════════════════
// Scenario 8: cardinal-preflight
// 验证: 执行前风险评估
// ══════════════════════════════════════════

describe("Scenario 8: cardinal-preflight", () => {
  it("returns proceed for safe changes", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return yield* pf.preflight({ sessionID: SESSION, plannedFiles: ["src/utils.ts"] })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinalPreflight)))
    expect(result.recommendation).toBe("proceed")
    expect(result.risks.length).toBe(0)
  })

  it("returns confirm for critical files", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return yield* pf.preflight({ sessionID: SESSION, plannedFiles: [".env", "src/auth.ts"] })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinalPreflight)))
    expect(result.recommendation).toBe("confirm")
    expect(result.risks.some(r => r.rule === "critical_file")).toBe(true)
  })

  it("returns confirm for excessive file count", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const pf = yield* CardinalPreflight.Service
      return yield* pf.preflight({ sessionID: SESSION, estimatedFileCount: 20 })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.cardinalPreflight)))
    expect(result.recommendation).toBe("confirm")
    expect(result.risks.some(r => r.rule === "excessive_changes")).toBe(true)
  })
})

// ══════════════════════════════════════════
// Scenario 9: openspec-precheck
// 验证: 执行前扫描文件命中 spec
// ══════════════════════════════════════════

describe("Scenario 9: openspec-precheck", () => {
  const specFiles: string[] = []

  afterEach(() => {
    specFiles.forEach(cleanupSpecFile)
    specFiles.length = 0
  })

  it("finds violations for matching files", async () => {
    const specFile = writeSpecFile("test", `e2e-precheck-${Date.now()}.md`, `# Auth
## Requirements
### Requirement 1: Login
- **Status**: pending
- **Verification**: ast src/auth.ts:export function login
`)
    specFiles.push(path.basename(specFile))

    const layers = createLayers()
    const program = Effect.gen(function* () {
      const pc = yield* OpenSpecPrecheck.Service
      return yield* pc.precheck({ sessionID: SESSION, plannedFiles: ["src/auth.ts"] })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.openSpecPrecheck)))
    expect(result.hasViolations).toBe(true)
    expect(result.violations.length).toBeGreaterThan(0)
  })

  it("finds no violations for unrelated files", async () => {
    const layers = createLayers()
    const program = Effect.gen(function* () {
      const pc = yield* OpenSpecPrecheck.Service
      return yield* pc.precheck({ sessionID: SESSION, plannedFiles: ["src/utils.ts"] })
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layers.openSpecPrecheck)))
    expect(result.hasViolations).toBe(false)
  })
})
