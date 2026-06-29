import { Effect, Context, Layer } from "effect"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { OpenSpec, type SpecDoc, type SpecRequirement } from "./spec"

export interface CodeRequirement {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly implementation: string
  readonly verificationCommand: string
}

export interface Interface {
  readonly specToCode: (spec: SpecDoc) => Effect.Effect<CodeRequirement[]>
  readonly codeToSpec: (codePath: string) => Effect.Effect<SpecDoc, Error>
  readonly generateMarkdown: (requirements: CodeRequirement[]) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenSpecConverter") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    const specToCode = Effect.fn("OpenSpecConverter.specToCode")(function* (spec: SpecDoc) {
      return spec.requirements.map((req) => ({
        id: req.id,
        title: req.title,
        description: req.description,
        implementation: req.verification.target,
        verificationCommand: `${req.verification.type} ${req.verification.target}`,
      }))
    })

    const codeToSpec = Effect.fn("OpenSpecConverter.codeToSpec")(function* (codePath: string) {
      const content = yield* fs.readFileStringSafe(codePath)
      if (content === undefined) {
        return {
          title: "Generated Spec",
          overview: "Auto-generated from code",
          filePath: codePath,
          requirements: [],
        }
      }

      const requirements: SpecRequirement[] = []
      const lines = content.split("\n")
      let currentReq: Partial<SpecRequirement> | null = null

      for (const line of lines) {
        const commentMatch = line.match(/\/\/\s*@spec\s+(\w+)\s*:\s*(.+)/i)
        if (commentMatch) {
          if (currentReq?.id) {
            requirements.push({
              id: currentReq.id,
              title: currentReq.title ?? "",
              description: currentReq.description ?? "",
              acceptanceCriteria: [],
              verification: { type: "manual", target: "" },
              status: "pending",
            })
          }
          currentReq = {
            id: `Requirement ${requirements.length + 1}`,
            title: commentMatch[2].trim(),
            description: commentMatch[2].trim(),
          }
        }
      }

      if (currentReq?.id) {
        requirements.push({
          id: currentReq.id,
          title: currentReq.title ?? "",
          description: currentReq.description ?? "",
          acceptanceCriteria: [],
          verification: { type: "manual", target: "" },
          status: "pending",
        })
      }

      return {
        title: "Generated Spec",
        overview: "Auto-generated from code comments",
        filePath: codePath,
        requirements,
      }
    })

    const generateMarkdown = Effect.fn("OpenSpecConverter.generateMarkdown")(function* (
      requirements: CodeRequirement[],
    ) {
      let markdown = "# Generated Spec\n\n## Overview\n\nAuto-generated requirements.\n\n## Requirements\n\n"
      for (const req of requirements) {
        markdown += `### ${req.id}: ${req.title}\n\n`
        markdown += `${req.description}\n\n`
        markdown += `**Status**: pending\n\n`
        markdown += `**Verification**: ${req.verificationCommand}\n\n`
        markdown += `- ${req.title}\n\n`
      }
      return markdown
    })

    return Service.of({ specToCode, codeToSpec, generateMarkdown })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(OpenSpec.defaultLayer),
  ),
)

export * as OpenSpecConverter from "./converter"
