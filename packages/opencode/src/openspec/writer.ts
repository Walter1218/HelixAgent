import { Effect, Context, Layer } from "effect"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { OpenSpec, type SpecDoc } from "./spec"

export interface SpecWriterInput {
  readonly title: string
  readonly description: string
  readonly filePath?: string
}

export interface Interface {
  readonly generateSpec: (input: SpecWriterInput) => Effect.Effect<SpecDoc>
  readonly saveSpec: (spec: SpecDoc, directory: string) => Effect.Effect<string, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SpecWriter") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    const generateSpec = Effect.fn("SpecWriter.generateSpec")(function* (input: SpecWriterInput) {
      const title = input.title
      const overview = input.description

      const requirements = [{
        id: "Requirement 1",
        title: `${title} implementation`,
        description: `Implement ${title} based on: ${overview}`,
        acceptanceCriteria: [`${title} is implemented and working`],
        verification: {
          type: "grep" as const,
          target: `"${title}" ${input.filePath ?? "**/*.ts"}`,
        },
        status: "pending" as const,
      }]

      return {
        title,
        overview,
        filePath: input.filePath ?? "",
        requirements,
      }
    })

    const saveSpec = Effect.fn("SpecWriter.saveSpec")(function* (spec: SpecDoc, directory: string) {
      const specDir = `${directory}/${spec.title.toLowerCase().replace(/\s+/g, "-")}`
      yield* fs.ensureDir(specDir)

      let markdown = `# ${spec.title}\n\n## Overview\n\n${spec.overview}\n\n## Requirements\n\n`
      for (const req of spec.requirements) {
        markdown += `### ${req.id}: ${req.title}\n\n`
        markdown += `${req.description}\n\n`
        markdown += `**Status**: ${req.status}\n\n`
        markdown += `**Verification**: ${req.verification.type} ${req.verification.target}\n\n`
        for (const criteria of req.acceptanceCriteria) {
          markdown += `- ${criteria}\n`
        }
        markdown += "\n"
      }

      const specPath = `${specDir}/spec.md`
      yield* fs.writeWithDirs(specPath, markdown)
      return specPath
    })

    return Service.of({ generateSpec, saveSpec })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(OpenSpec.defaultLayer),
  ),
)

export * as SpecWriter from "./writer"
