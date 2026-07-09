export * as StudioApi from "./studio-api"

import { Hono } from "hono"
import { Effect, Layer } from "effect"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { Database } from "@opencode-ai/core/database/database"
import { StudioRepository } from "../studio/repository"
import type { Studio } from "../studio/schema/studio"
import type { Character } from "../studio/schema/character"
import type { Location } from "../studio/schema/location"
import type { Prop } from "../studio/schema/prop"
import type { StylePreset } from "../studio/schema/style-preset"

const studioLayer = StudioRepository.defaultLayer.pipe(
  Layer.provide(Database.defaultLayer),
)

const { runPromise } = makeRuntime(StudioRepository.Service, studioLayer)

export const studioApp = new Hono().basePath("/api/creator-helix/v2")

// ─── Studio CRUD ───

studioApp
  .post("/studios", async (c) => {
    const body = await c.req.json() as Partial<Studio>
    const studio: Studio = {
      id: body.id ?? `studio_${Date.now()}`,
      name: body.name ?? "Untitled Studio",
      characters: body.characters ?? [],
      locations: body.locations ?? [],
      props: body.props ?? [],
      crowdPresets: body.crowdPresets ?? [],
      stylePresets: body.stylePresets ?? [],
      worldRules: body.worldRules ?? [],
      audioLibrary: body.audioLibrary ?? { soundEffects: [], bgm: [], voicePresets: [] },
    }
    await runPromise((repo) => repo.save(studio))
    return c.json(studio, 201)
  })
  .get("/studios", async (c) => {
    const studios = await runPromise((repo) => repo.list())
    return c.json(studios)
  })
  .get("/studios/:id", async (c) => {
    const id = c.req.param("id")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)
    return c.json(studio)
  })
  .put("/studios/:id", async (c) => {
    const id = c.req.param("id")
    const existing = await runPromise((repo) => repo.get(id))
    if (!existing) return c.json({ error: "Studio not found" }, 404)

    const body = await c.req.json() as Partial<Studio>
    const updated: Studio = { ...existing, ...body, id }
    await runPromise((repo) => repo.save(updated))
    return c.json(updated)
  })
  .delete("/studios/:id", async (c) => {
    const id = c.req.param("id")
    await runPromise((repo) => repo.delete(id))
    return c.json({ success: true })
  })

// ─── Character CRUD ───

studioApp
  .post("/studios/:id/characters", async (c) => {
    const id = c.req.param("id")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const character = await c.req.json() as Character
    const characters = [...studio.characters.filter(c => c.id !== character.id), character]
    await runPromise((repo) => repo.save({ ...studio, characters }))
    return c.json(character, 201)
  })
  .put("/studios/:id/characters/:charId", async (c) => {
    const id = c.req.param("id")
    const charId = c.req.param("charId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const character = await c.req.json() as Character
    const characters = studio.characters.map(ch => ch.id === charId ? { ...character, id: charId } : ch)
    await runPromise((repo) => repo.save({ ...studio, characters }))
    return c.json({ ...character, id: charId })
  })
  .delete("/studios/:id/characters/:charId", async (c) => {
    const id = c.req.param("id")
    const charId = c.req.param("charId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const characters = studio.characters.filter(ch => ch.id !== charId)
    await runPromise((repo) => repo.save({ ...studio, characters }))
    return c.json({ success: true })
  })

// ─── Location CRUD ───

studioApp
  .post("/studios/:id/locations", async (c) => {
    const id = c.req.param("id")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const location = await c.req.json() as Location
    const locations = [...studio.locations.filter(l => l.id !== location.id), location]
    await runPromise((repo) => repo.save({ ...studio, locations }))
    return c.json(location, 201)
  })
  .put("/studios/:id/locations/:locId", async (c) => {
    const id = c.req.param("id")
    const locId = c.req.param("locId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const location = await c.req.json() as Location
    const locations = studio.locations.map(l => l.id === locId ? { ...location, id: locId } : l)
    await runPromise((repo) => repo.save({ ...studio, locations }))
    return c.json({ ...location, id: locId })
  })
  .delete("/studios/:id/locations/:locId", async (c) => {
    const id = c.req.param("id")
    const locId = c.req.param("locId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const locations = studio.locations.filter(l => l.id !== locId)
    await runPromise((repo) => repo.save({ ...studio, locations }))
    return c.json({ success: true })
  })

// ─── Prop CRUD ───

studioApp
  .post("/studios/:id/props", async (c) => {
    const id = c.req.param("id")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const prop = await c.req.json() as Prop
    const props = [...studio.props.filter(p => p.id !== prop.id), prop]
    await runPromise((repo) => repo.save({ ...studio, props }))
    return c.json(prop, 201)
  })
  .put("/studios/:id/props/:propId", async (c) => {
    const id = c.req.param("id")
    const propId = c.req.param("propId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const prop = await c.req.json() as Prop
    const props = studio.props.map(p => p.id === propId ? { ...prop, id: propId } : p)
    await runPromise((repo) => repo.save({ ...studio, props }))
    return c.json({ ...prop, id: propId })
  })
  .delete("/studios/:id/props/:propId", async (c) => {
    const id = c.req.param("id")
    const propId = c.req.param("propId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const props = studio.props.filter(p => p.id !== propId)
    await runPromise((repo) => repo.save({ ...studio, props }))
    return c.json({ success: true })
  })

// ─── StylePreset CRUD ───

studioApp
  .post("/studios/:id/style-presets", async (c) => {
    const id = c.req.param("id")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const preset = await c.req.json() as StylePreset
    const stylePresets = [...studio.stylePresets.filter(s => s.id !== preset.id), preset]
    await runPromise((repo) => repo.save({ ...studio, stylePresets }))
    return c.json(preset, 201)
  })
  .put("/studios/:id/style-presets/:presetId", async (c) => {
    const id = c.req.param("id")
    const presetId = c.req.param("presetId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const preset = await c.req.json() as StylePreset
    const stylePresets = studio.stylePresets.map(s => s.id === presetId ? { ...preset, id: presetId } : s)
    await runPromise((repo) => repo.save({ ...studio, stylePresets }))
    return c.json({ ...preset, id: presetId })
  })
  .delete("/studios/:id/style-presets/:presetId", async (c) => {
    const id = c.req.param("id")
    const presetId = c.req.param("presetId")
    const studio = await runPromise((repo) => repo.get(id))
    if (!studio) return c.json({ error: "Studio not found" }, 404)

    const stylePresets = studio.stylePresets.filter(s => s.id !== presetId)
    await runPromise((repo) => repo.save({ ...studio, stylePresets }))
    return c.json({ success: true })
  })
