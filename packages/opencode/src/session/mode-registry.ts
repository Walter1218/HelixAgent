import { Context, Effect, Layer, Ref } from "effect"
import { Log } from "@/util"
import z from "zod"

const log = Log.create({ service: "mode.registry" })

export const ModeId = z.enum(["ask", "build", "plan", "compose", "max", "loop"])
export type ModeId = z.infer<typeof ModeId>

export interface EvolutionConfig {
  judgeEnabled: boolean
  judgeChecks?: string[]
  traceExportEnabled: boolean
  evolutionEnabled: boolean
}

export interface ModeHandler {
  readonly id: ModeId
  readonly enabled: boolean
  readonly candidates?: number
  readonly evolution: EvolutionConfig
}

export interface Interface {
  readonly get: (modeId: string) => Effect.Effect<ModeHandler | undefined>
  readonly getAll: () => Effect.Effect<ModeHandler[]>
  readonly getEvolutionConfig: (modeId: string) => Effect.Effect<EvolutionConfig>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ModeRegistry") {}

const DEFAULT_MODES: ModeHandler[] = [
  {
    id: "ask",
    enabled: true,
    evolution: { judgeEnabled: false, traceExportEnabled: false, evolutionEnabled: false },
  },
  {
    id: "build",
    enabled: true,
    evolution: { judgeEnabled: true, traceExportEnabled: true, evolutionEnabled: true },
  },
  {
    id: "plan",
    enabled: true,
    evolution: { judgeEnabled: true, judgeChecks: ["security", "relevance"], traceExportEnabled: true, evolutionEnabled: true },
  },
  {
    id: "compose",
    enabled: true,
    evolution: { judgeEnabled: true, judgeChecks: ["security", "completeness"], traceExportEnabled: true, evolutionEnabled: true },
  },
  {
    id: "max",
    enabled: true,
    candidates: 5,
    evolution: { judgeEnabled: true, traceExportEnabled: true, evolutionEnabled: true },
  },
  {
    id: "loop",
    enabled: true,
    evolution: { judgeEnabled: true, traceExportEnabled: true, evolutionEnabled: true },
  },
]

const DEFAULT_EVOLUTION: EvolutionConfig = {
  judgeEnabled: false,
  traceExportEnabled: false,
  evolutionEnabled: false,
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const modes = yield* Ref.make(new Map<string, ModeHandler>(
      DEFAULT_MODES.map((m) => [m.id, m])
    ))

    const get = Effect.fn("ModeRegistry.get")(function* (modeId: string) {
      const map = yield* Ref.get(modes)
      return map.get(modeId)
    })

    const getAll = Effect.fn("ModeRegistry.getAll")(function* () {
      const map = yield* Ref.get(modes)
      return Array.from(map.values())
    })

    const getEvolutionConfig = Effect.fn("ModeRegistry.getEvolutionConfig")(function* (modeId: string) {
      const map = yield* Ref.get(modes)
      const mode = map.get(modeId)
      return mode?.evolution ?? DEFAULT_EVOLUTION
    })

    return Service.of({ get, getAll, getEvolutionConfig })
  })
)

export const defaultLayer = layer

export * as ModeRegistry from "./mode-registry"
