export * as PromptBuilder from "./builder"

import { Effect } from "effect"
import type { Studio } from "../../studio/schema/studio"
import type { Shot } from "../../project/schema/shot"
import type { ShotDecision } from "../llm/decisions"
import { QualityTiers } from "../config"

export interface BuiltPrompt {
  readonly text: string
  readonly references: Array<{
    type: "image_url"
    url: string
    role: "reference_image"
  }>
}

export const buildShotPrompt = (
  shot: Shot,
  studio: Studio,
  decision: ShotDecision,
): Effect.Effect<BuiltPrompt, Error> =>
  Effect.gen(function* () {
    const references: BuiltPrompt["references"] = []
    const parts: string[] = []

    for (const charRef of shot.references.characters) {
      const char = studio.characters.find(c => c.id === charRef.characterId)
      if (!char) continue
      const state = char.stateTimeline.find(s => s.stateId === charRef.stateRef)
      if (!state) continue

      references.push({
        type: "image_url",
        url: state.portrait.url,
        role: "reference_image",
      })

      parts.push(describeCharacter(char.baseIdentity.name, state.appearance, charRef.outfitVariant))
    }

    const loc = studio.locations.find(l => l.id === shot.references.location.locationId)
    if (loc) {
      const locState = loc.stateTimeline.find(s => s.stateId === shot.references.location.stateRef)
      if (locState) {
        references.push({
          type: "image_url",
          url: locState.conceptImage.url,
          role: "reference_image",
        })
        parts.push(`Scene: ${loc.baseDefinition.name}, ${locState.condition}. Background: ${locState.depthLayers.background}`)
      }
    }

    parts.push(describeCamera(shot.camera))
    parts.push(`Lighting: ${decision.lighting}`)
    parts.push(`Mood: ${decision.mood}`)

    if (decision.colorPalette.length > 0) {
      parts.push(`Color palette: ${decision.colorPalette.join(", ")}`)
    }

    if (decision.postProcessing.length > 0) {
      parts.push(`Post-processing: ${decision.postProcessing.join(", ")}`)
    }

    const qualityText = QualityTiers[decision.qualityTier as keyof typeof QualityTiers] ?? QualityTiers.cinematic
    parts.push(`Quality: ${qualityText}`)

    return {
      text: parts.join(". "),
      references,
    }
  })

function describeCharacter(
  name: string,
  appearance: { face: string; hair: string; eyes: string; bodyType: string; typicalOutfit: string },
  outfitVariant: string | null,
): string {
  const parts = [name]
  if (appearance.hair) parts.push(`${appearance.hair} hair`)
  if (appearance.eyes) parts.push(`${appearance.eyes} eyes`)
  if (appearance.face) parts.push(appearance.face)
  if (outfitVariant) parts.push(`wearing ${outfitVariant}`)
  else if (appearance.typicalOutfit) parts.push(`wearing ${appearance.typicalOutfit}`)
  return parts.join(", ")
}

function describeCamera(camera: Shot["camera"]): string {
  const movementMap: Record<string, string> = {
    "push-in": "camera pushes forward",
    "pull-back": "camera pulls back to reveal",
    "pan": "camera pans horizontally",
    "tilt": "camera tilts vertically",
    "track": "camera tracks alongside the subject",
    "dolly": "camera dollies on a track",
    "crane": "camera crane shot moving upward",
    "orbit": "camera orbits around the subject",
    "static": "static camera",
  }

  const framingMap: Record<string, string> = {
    "extreme-wide": "extreme wide shot",
    wide: "wide establishing shot",
    full: "full body shot",
    medium: "medium shot",
    "close-up": "close-up shot",
    "extreme-close-up": "extreme close-up",
  }

  const angleMap: Record<string, string> = {
    front: "front view",
    side: "side profile",
    back: "from behind",
    high: "high angle looking down",
    low: "low angle looking up",
    dutch: "dutch angle",
    "birds-eye": "bird's eye view",
    "worms-eye": "worm's eye view",
  }

  const speedMap: Record<string, string> = {
    static: "",
    slow: "slowly",
    normal: "at normal speed",
    fast: "quickly",
  }

  const parts = [movementMap[camera.type] ?? camera.type]
  if (camera.movementSpeed !== "static" && speedMap[camera.movementSpeed]) {
    parts.push(speedMap[camera.movementSpeed])
  }
  parts.push(framingMap[camera.framing] ?? camera.framing)
  parts.push(angleMap[camera.angle] ?? camera.angle)

  return parts.filter(Boolean).join(", ")
}
