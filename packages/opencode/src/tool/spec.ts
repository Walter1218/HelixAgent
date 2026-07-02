import * as Tool from "./tool"
import { Schema, Effect } from "effect"
import { runPipeline } from "@/spec-generation/pipeline"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Provider } from "@/provider/provider"
import { Goal } from "@/session/goal"
import { Cardinal } from "@/session/cardinal"
import { OpenSpec } from "@/openspec/spec"
import { Trace } from "@/trace/trace"
import DESCRIPTION from "./spec.txt"
import path from "path"
import fs from "fs"

export const Parameters = Schema.Struct({
  prompt: Schema.String,
  maxFixIterations: Schema.optional(Schema.Number),
})

export const SpecTool = Tool.define(
  "spec",
  Effect.gen(function* () {
    const provider = yield* Provider.Service
    const goal = yield* Goal.Service
    const cardinal = yield* Cardinal.Service
    const openSpec = yield* OpenSpec.Service
    const trace = yield* Trace.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.metadata({
            title: `Generating spec: ${params.prompt.slice(0, 60)}`,
            metadata: { prompt: params.prompt },
          })

          // Trace: spec generation start
          yield* trace.emit({
            id: `spec-gen-${Date.now()}`,
            type: "node_start",
            name: "spec.generation",
            status: "pending",
            metadata: { sessionID: ctx.sessionID, prompt: params.prompt },
          })

          const model = yield* provider
            .getLanguage({
              providerID: "xiaomi",
              modelID: "mimo-v2.5-pro",
            } as any)
            .pipe(Effect.catch(() => Effect.succeed(undefined)))

          if (!model) {
            yield* trace.emit({
              id: `spec-gen-${Date.now()}`,
              type: "error",
              name: "spec.generation",
              status: "failed",
              metadata: { sessionID: ctx.sessionID, error: "no_model" },
            })
            return {
              title: "No model available",
              output: "Could not resolve a model for spec generation. Please configure a provider.",
              metadata: { score: 0, verdict: "error", specLength: 0, issues: 0 },
            }
          }

          const result = yield* runPipeline(model as any, {
            userPrompt: params.prompt,
            projectContext: {
              rootPath: process.cwd(),
              relevantFiles: [],
            },
            maxFixIterations: params.maxFixIterations ?? 1,
          }).pipe(
            Effect.provide(FSUtil.defaultLayer),
            Effect.provide(CrossSpawnSpawner.defaultLayer),
            Effect.catch(() =>
              Effect.succeed({
                specMarkdown: "",
                report: { score: 0, verdict: "reject" as const, issues: [] as any[], strengths: [] as string[], summary: "Pipeline failed" },
              }),
            ),
          )

          // Trace: spec generation complete
          yield* trace.emit({
            id: `spec-gen-${Date.now()}`,
            type: "node_end",
            name: "spec.generation",
            status: result.report.verdict === "reject" ? "failed" : "success",
            metadata: {
              sessionID: ctx.sessionID,
              score: result.report.score,
              verdict: result.report.verdict,
            },
          })

          // Phase 2.1: Auto-set Goal after spec generation
          if (result.specMarkdown && result.report.verdict !== "reject") {
            // Extract core goal from the first line of the spec
            const coreGoal = result.specMarkdown.split("\n")[0].replace(/^#\s*/, "").trim() || params.prompt

            yield* goal.set(ctx.sessionID, coreGoal)
            yield* trace.emit({
              id: `goal-set-${Date.now()}`,
              type: "decision",
              name: "goal.set",
              status: "success",
              metadata: { sessionID: ctx.sessionID, condition: coreGoal },
            })
          }

          // Phase 2.2: Register spec-derived Cardinal rules
          if (result.specMarkdown && result.report.verdict !== "reject") {
            try {
              // Save spec to file
              const specDir = path.join(process.cwd(), "openspec", "specs")
              fs.mkdirSync(specDir, { recursive: true })
              const specFile = path.join(specDir, `spec-${Date.now()}.md`)
              fs.writeFileSync(specFile, result.specMarkdown)

              // Parse spec and extract rules
              const spec = yield* openSpec.parseSpecFile(specFile).pipe(Effect.catch(() => Effect.succeed(null)))
              if (spec) {
                const specRules = createSpecDerivedRules(spec)
                // Register rules with Cardinal so processor.ts can use them
                yield* cardinal.registerRules(specRules)
                yield* trace.emit({
                  id: `cardinal-rules-${Date.now()}`,
                  type: "decision",
                  name: "cardinal.spec_rules",
                  status: "success",
                  metadata: { sessionID: ctx.sessionID, rulesCount: specRules.length },
                })
              }
            } catch {
              // Non-fatal: spec save/parse failed
            }
          }

          const output = [
            `# Spec Generation Result`,
            ``,
            `**Score**: ${result.report.score}/100`,
            `**Verdict**: ${result.report.verdict}`,
            result.report.verdict !== "reject" ? `**Goal**: Auto-set from spec` : ``,
            ``,
            `## Generated Spec`,
            ``,
            result.specMarkdown,
          ].filter(Boolean)

          if (result.report.issues.length > 0) {
            output.push(``, `## Review Issues`, ``)
            for (const issue of result.report.issues) {
              output.push(`- [${issue.severity}] [${issue.category}] ${issue.description}`)
            }
          }

          return {
            title: `Spec generated (score: ${result.report.score}, verdict: ${result.report.verdict})`,
            output: output.join("\n"),
            metadata: {
              score: result.report.score,
              verdict: result.report.verdict,
              specLength: result.specMarkdown.length,
              issues: result.report.issues.length,
            },
          }
        }),
    }
  }),
)

// Phase 2.2: Extract Cardinal rules from spec requirements
function createSpecDerivedRules(spec: { requirements: Array<{ title: string; description: string; type?: string }> }) {
  const rules: Array<{ id: string; name: string; evaluate: (ctx: any) => any }> = []

  for (const req of spec.requirements) {
    const type = req.type?.toLowerCase() ?? ""
    const title = req.title.toLowerCase()
    const desc = req.description.toLowerCase()

    // Security requirements → Cardinal block rule
    if (type === "security" || title.includes("security") || title.includes("auth") || desc.includes("eval") || desc.includes("inject")) {
      rules.push({
        id: `spec-security-${req.title.replace(/\s+/g, "-").toLowerCase()}`,
        name: `Spec Security: ${req.title}`,
        evaluate: (ctx: any) => {
          if (!ctx.diff) return null
          const dangerous = ["eval(", "exec(", "child_process", "rm -rf", "DROP TABLE"]
          for (const pattern of dangerous) {
            if (ctx.diff.includes(pattern)) {
              return {
                level: "block",
                reason: `Spec security violation: ${req.title} - detected "${pattern}"`,
                suggestion: `Remove ${pattern} as required by spec: ${req.title}`,
              }
            }
          }
          return null
        },
      })
    }

    // Performance requirements → Cardinal warn rule
    if (type === "performance" || title.includes("performance") || title.includes("latency")) {
      rules.push({
        id: `spec-performance-${req.title.replace(/\s+/g, "-").toLowerCase()}`,
        name: `Spec Performance: ${req.title}`,
        evaluate: (ctx: any) => {
          if (ctx.tokensUsed && ctx.totalBudget && ctx.tokensUsed > ctx.totalBudget * 0.3) {
            return {
              level: "warn",
              reason: `Spec performance concern: ${req.title} - high token usage`,
              suggestion: `Consider optimizing for: ${req.description}`,
            }
          }
          return null
        },
      })
    }
  }

  return rules
}
