/**
 * Generate asset images (character portraits, concept art) for a Studio
 *
 * Usage: bun run scripts/generate-assets.ts <studio_id>
 */

import { Effect, Layer } from "effect"
import { ConfigProvider } from "effect"
import { SeedDream } from "../src/v2/seedream"
import { StudioRepository } from "../src/studio/repository"
import type { Studio } from "../src/studio/schema/studio"

const env: Record<string, string> = {
  SEEDANCE_API_KEY: process.env.SEEDANCE_API_KEY ?? "",
  LONGCAT_API_KEY: process.env.LONGCAT_API_KEY ?? "",
}
const configProvider = ConfigProvider.make((path: string) =>
  Effect.succeed(env[path] ? ConfigProvider.makeValue(env[path]) : undefined),
)

const provideConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(ConfigProvider.layer(configProvider)))

async function main() {
  const studioId = process.argv[2]
  if (!studioId) {
    console.error("Usage: bun run scripts/generate-assets.ts <studio_id>")
    process.exit(1)
  }

  const studio = await Effect.runPromise(
    provideConfig(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        return yield* repo.get(studioId)
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    ),
  )

  if (!studio) {
    console.error(`Studio not found: ${studioId}`)
    process.exit(1)
  }

  console.log(`Studio: ${studio.name}`)
  console.log(`Characters: ${studio.characters.length}`)
  console.log(`Locations: ${studio.locations.length}`)

  // Generate character portraits
  for (const char of studio.characters) {
    for (const state of char.stateTimeline) {
      const prompt = `Character portrait, ${state.appearance.face}, ${state.appearance.hair}, ${state.appearance.eyes}, ${state.appearance.skin}, ${state.appearance.bodyType}, wearing ${state.appearance.typicalOutfit}, frontal view, cinematic lighting, highly detailed, Star Wars style`
      console.log(`\n[${char.baseIdentity.name}] Generating ${state.stateId}...`)

      try {
        const result = await Effect.runPromise(
          provideConfig(SeedDream.generatePortrait(prompt)),
        )
        console.log(`  ✅ ${result.url}`)
        ;(state.portrait as { url: string }).url = result.url
      } catch (e) {
        console.log(`  ❌ Failed: ${e}`)
      }
    }
  }

  // Generate location concept art
  for (const loc of studio.locations) {
    for (const state of loc.stateTimeline) {
      const prompt = `Cinematic environment concept art, ${loc.baseDefinition.name}, ${loc.baseDefinition.architecture}, condition: ${state.condition}, foreground: ${state.depthLayers.foreground}, midground: ${state.depthLayers.midground}, background: ${state.depthLayers.background}, ${state.atmosphere.lighting}, epic scale, Star Wars style, highly detailed`
      console.log(`\n[${loc.baseDefinition.name}] Generating ${state.stateId}...`)

      try {
        const result = await Effect.runPromise(
          provideConfig(SeedDream.generateConceptArt(prompt)),
        )
        console.log(`  ✅ ${result.url}`)
        ;(state.conceptImage as { url: string }).url = result.url
      } catch (e) {
        console.log(`  ❌ Failed: ${e}`)
      }
    }
  }

  // Save updated studio
  await Effect.runPromise(
    provideConfig(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        yield* repo.save(studio)
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    ),
  )

  console.log("\n✅ All assets generated and saved!")
}

main().catch(e => { console.error(e); process.exit(1) })
