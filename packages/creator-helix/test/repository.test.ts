import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { Migration } from "../src/persistence/migrate"
import { StudioRepository } from "../src/studio/repository"
import { ProjectRepository } from "../src/project/repository"
import type { Studio } from "../src/studio/schema/studio"
import type { Project } from "../src/project/schema/project"

const testStudio: Studio = {
  id: "test_studio_001",
  name: "测试工作室",
  characters: [
    {
      id: "char_001",
      baseIdentity: {
        name: "李毅",
        gender: "male",
        race: "人类",
        distinguishingMarks: ["左脸疤痕"],
      },
      stateTimeline: [
        {
          stateId: "liyi_young",
          era: "地球时期",
          ageRange: [18, 22],
          appearance: {
            face: "方正脸庞",
            hair: "黑色短发",
            eyes: "深棕色眼睛",
            skin: "黄皮肤",
            bodyType: "健壮",
            typicalOutfit: "蓝色军装",
          },
          portrait: { url: "https://example.com/liyi.png", width: 720, height: 1280 },
          personalityShift: "冲动",
          relations: [],
        },
      ],
      expressionSheet: {
        neutral: { url: "https://example.com/n.png", width: 720, height: 1280 },
        angry: { url: "https://example.com/a.png", width: 720, height: 1280 },
        sad: { url: "https://example.com/s.png", width: 720, height: 1280 },
        surprised: { url: "https://example.com/su.png", width: 720, height: 1280 },
        happy: { url: "https://example.com/h.png", width: 720, height: 1280 },
        determined: { url: "https://example.com/d.png", width: 720, height: 1280 },
        fearful: { url: "https://example.com/f.png", width: 720, height: 1280 },
      },
    },
  ],
  locations: [],
  props: [],
  crowdPresets: [],
  stylePresets: [],
  worldRules: [],
  audioLibrary: { soundEffects: [], bgm: [], voicePresets: [] },
}

const testProject: Project = {
  id: "test_proj_001",
  meta: {
    title: "三体反击战",
    logline: "人类舰队反击",
    theme: "勇气",
    targetDuration: 120,
  },
  stylePresetId: "style_001",
  worldRules: [],
  scripts: [],
}

const setupTest = async () => {
  await Effect.runPromise(
    Migration.run.pipe(
      Effect.provide(Database.defaultLayer),
      Effect.catch(() => Effect.void),
    ),
  )
}

describe("StudioRepository", () => {
  it("saves and retrieves a studio", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        yield* repo.save(testStudio)

        const result = yield* repo.get("test_studio_001")
        expect(result).toBeDefined()
        expect(result!.name).toBe("测试工作室")
        expect(result!.characters.length).toBe(1)
        expect(result!.characters[0].baseIdentity.name).toBe("李毅")
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    )
  })

  it("finds studio by name", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        yield* repo.save(testStudio)

        const result = yield* repo.getByName("测试工作室")
        expect(result).toBeDefined()
        expect(result!.id).toBe("test_studio_001")
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    )
  })

  it("updates existing studio", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        yield* repo.save(testStudio)

        const updated = { ...testStudio, name: "更新工作室" }
        yield* repo.save(updated)

        const result = yield* repo.get("test_studio_001")
        expect(result!.name).toBe("更新工作室")
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    )
  })

  it("lists all studios", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* StudioRepository.Service
        yield* repo.save(testStudio)

        const result = yield* repo.list()
        expect(result.length).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(StudioRepository.defaultLayer)),
    )
  })
})

describe("ProjectRepository", () => {
  it("saves and retrieves a project", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        yield* repo.save(testProject, "test_studio_001")

        const result = yield* repo.get("test_proj_001")
        expect(result).toBeDefined()
        expect(result!.meta.title).toBe("三体反击战")
      }).pipe(Effect.provide(ProjectRepository.defaultLayer)),
    )
  })

  it("updates existing project", async () => {
    await setupTest()

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ProjectRepository.Service
        yield* repo.save(testProject, "test_studio_001")

        const updated = { ...testProject, meta: { ...testProject.meta, title: "新标题" } }
        yield* repo.save(updated, "test_studio_001")

        const result = yield* repo.get("test_proj_001")
        expect(result!.meta.title).toBe("新标题")
      }).pipe(Effect.provide(ProjectRepository.defaultLayer)),
    )
  })
})
