import { beforeAll, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { Database } from "@opencode-ai/core/database/database"
import { Migration } from "../src/persistence/migrate"
import { studioApp } from "../src/server/studio-api"
import { projectApp } from "../src/server/project-api"

beforeAll(async () => {
  const { runPromise } = makeRuntime(Database.Service, Database.defaultLayer)
  await runPromise(() => Migration.run)
})

describe("Studio API", () => {
  test("POST /studios creates a studio", async () => {
    const res = await studioApp.request("/api/creator-helix/v2/studios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test Studio",
        characters: [],
        locations: [],
        props: [],
        crowdPresets: [],
        stylePresets: [],
        worldRules: [],
        audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; name: string }
    expect(body.name).toBe("Test Studio")
  })

  test("GET /studios lists studios", async () => {
    const res = await studioApp.request("/api/creator-helix/v2/studios")
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(body.length).toBeGreaterThanOrEqual(1)
  })

  test("GET /studios/:id returns studio", async () => {
    const createRes = await studioApp.request("/api/creator-helix/v2/studios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "studio_test_001",
        name: "Get Test",
        characters: [],
        locations: [],
        props: [],
        crowdPresets: [],
        stylePresets: [],
        worldRules: [],
        audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
      }),
    })
    const created = await createRes.json() as { id: string }

    const res = await studioApp.request(`/api/creator-helix/v2/studios/${created.id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; name: string }
    expect(body.id).toBe("studio_test_001")
  })

  test("GET /studios/:id returns 404 for unknown", async () => {
    const res = await studioApp.request("/api/creator-helix/v2/studios/nonexistent")
    expect(res.status).toBe(404)
  })

  test("PUT /studios/:id updates studio", async () => {
    const res = await studioApp.request("/api/creator-helix/v2/studios/studio_test_001", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { name: string }
    expect(body.name).toBe("Updated Name")
  })

  test("DELETE /studios/:id deletes studio", async () => {
    const res = await studioApp.request("/api/creator-helix/v2/studios/studio_test_001", {
      method: "DELETE",
    })
    expect(res.status).toBe(200)

    const getRes = await studioApp.request("/api/creator-helix/v2/studios/studio_test_001")
    expect(getRes.status).toBe(404)
  })

  test("POST /studios/:id/characters adds character", async () => {
    await studioApp.request("/api/creator-helix/v2/studios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "studio_char_test",
        name: "Char Test Studio",
        characters: [],
        locations: [],
        props: [],
        crowdPresets: [],
        stylePresets: [],
        worldRules: [],
        audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
      }),
    })

    const res = await studioApp.request("/api/creator-helix/v2/studios/studio_char_test/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "char_001",
        baseIdentity: { name: "李毅", gender: "male", race: "人类", distinguishingMarks: [] },
        stateTimeline: [],
        expressionSheet: {
          neutral: { url: "", width: 0, height: 0 },
          angry: { url: "", width: 0, height: 0 },
          sad: { url: "", width: 0, height: 0 },
          surprised: { url: "", width: 0, height: 0 },
          happy: { url: "", width: 0, height: 0 },
          determined: { url: "", width: 0, height: 0 },
          fearful: { url: "", width: 0, height: 0 },
        },
      }),
    })
    expect(res.status).toBe(201)

    const getRes = await studioApp.request("/api/creator-helix/v2/studios/studio_char_test")
    const body = await getRes.json() as { characters: { id: string }[] }
    expect(body.characters.length).toBe(1)
    expect(body.characters[0].id).toBe("char_001")
  })
})

describe("Project API", () => {
  test("POST /projects creates a project", async () => {
    const res = await projectApp.request("/api/creator-helix/v2/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        meta: { title: "Test Project", logline: "test", theme: "test", targetDuration: 60 },
        scripts: [],
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; meta: { title: string } }
    expect(body.meta.title).toBe("Test Project")
  })

  test("GET /projects/:id returns 404 for unknown", async () => {
    const res = await projectApp.request("/api/creator-helix/v2/projects/nonexistent")
    expect(res.status).toBe(404)
  })

  test("PUT /projects/:id updates project", async () => {
    const createRes = await projectApp.request("/api/creator-helix/v2/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "proj_test_001",
        meta: { title: "Original", logline: "", theme: "", targetDuration: 0 },
        scripts: [],
      }),
    })
    const created = await createRes.json() as { id: string }

    const res = await projectApp.request(`/api/creator-helix/v2/projects/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meta: { title: "Updated" } }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { meta: { title: string } }
    expect(body.meta.title).toBe("Updated")
  })

  test("DELETE /projects/:id deletes project", async () => {
    const res = await projectApp.request("/api/creator-helix/v2/projects/proj_test_001", {
      method: "DELETE",
    })
    expect(res.status).toBe(200)

    const getRes = await projectApp.request("/api/creator-helix/v2/projects/proj_test_001")
    expect(getRes.status).toBe(404)
  })
})
