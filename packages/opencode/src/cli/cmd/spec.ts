import { Effect, Layer, ManagedRuntime } from "effect"
import { OpenSpec } from "@/openspec"
import { type SpecDoc } from "@/openspec/spec"
import { OpenSpecJudge } from "@/openspec/judge"
import { cmd } from "./cmd"

const SpecLayer = Layer.mergeAll(
  OpenSpec.defaultLayer,
  OpenSpecJudge.defaultLayer,
)

const rt = ManagedRuntime.make(SpecLayer as any)

export const SpecCommand = cmd<{}, {
  action?: string
  name?: string
  all?: boolean
  path?: string
}>({
  command: "spec <action>",
  describe: "OpenSpec management commands",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "show", "verify"],
        describe: "Action to perform",
      })
      .option("name", {
        type: "string",
        describe: "Spec name (for show/verify)",
      })
      .option("all", {
        type: "boolean",
        default: false,
        describe: "Verify all specs",
      })
      .option("path", {
        type: "string",
        describe: "Path to spec file (for show/verify)",
      })
      .demandOption("action"),
  async handler(args) {
    const action = args.action as "list" | "show" | "verify"

    await rt.runPromise(Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service
      const judge = yield* OpenSpecJudge.Service

      if (action === "list") {
        const specs = yield* openSpec.parseAllSpecs()
        console.log(`Found ${specs.length} spec(s):`)
        for (const spec of specs) {
          const implemented = spec.requirements.filter((r) => r.status === "implemented").length
          const total = spec.requirements.length
          console.log(`  - ${spec.title}: ${implemented}/${total} implemented (${spec.filePath})`)
        }
        return
      }

      if (action === "show") {
        const specPath = args.path ?? findSpecPathByName(args.name)
        if (!specPath) {
          throw new Error("--name or --path is required for show")
        }
        const cfg = yield* openSpec.getConfig()
        const resolvedPath = specPath.startsWith("/") ? specPath : `${cfg.directory}/${specPath}`
        const spec = yield* openSpec.parseSpecFile(resolvedPath)
        console.log(`# ${spec.title}`)
        console.log(`Overview: ${spec.overview}`)
        console.log("Requirements:")
        for (const req of spec.requirements) {
          console.log(`  [${req.status}] ${req.id}: ${req.title}`)
          console.log(`    Verification: ${req.verification.type} ${req.verification.target}`)
        }
        return
      }

      if (action === "verify") {
        let specs: SpecDoc[]
        if (args.all) {
          specs = yield* openSpec.parseAllSpecs()
        } else {
          const rawPath = args.path ?? findSpecPathByName(args.name)
          if (!rawPath) throw new Error("--name, --path, or --all is required for verify")
          const cfg2 = yield* openSpec.getConfig()
          const resolved = rawPath.startsWith("/") ? rawPath : `${cfg2.directory}/${rawPath}`
          specs = [yield* openSpec.parseSpecFile(resolved)]
        }

        let allApproved = true
        for (const spec of specs) {
          const result = yield* judge.judgeSpecCompliance(spec)
          console.log(`\n${spec.title}: ${result.approved ? "APPROVED" : "REJECTED"}`)
          if (result.implementedRequirements.length) {
            console.log(`  Implemented: ${result.implementedRequirements.join(", ")}`)
          }
          if (result.missingRequirements.length) {
            console.log(`  Missing: ${result.missingRequirements.join(", ")}`)
          }
          if (result.issues.length) {
            for (const issue of result.issues) {
              console.log(`  Issue: ${issue}`)
            }
          }
          if (!result.approved) allApproved = false
        }

        if (!allApproved) {
          throw new Error("Some specs are not fully implemented")
        }
      }
    }))
  },
})

function findSpecPathByName(name: string | undefined): string | undefined {
  if (!name) return undefined
  if (name.endsWith(".md")) return name
  return `${name}/spec.md`
}
