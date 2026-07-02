import { describe, it, expect } from "bun:test"
import { Embedder } from "@opencode-ai/core/memory/embedder"
import { VecStore } from "@opencode-ai/core/memory/vec-store"
import { hashContent } from "@opencode-ai/core/memory/semantic-hash"

const EMBEDDING_ENABLED = process.env.TEST_EMBEDDING === "1"

describe.skipIf(!EMBEDDING_ENABLED)("VecStore with real embedding", () => {
  const embedder = new Embedder({
    enabled: true,
    baseUrl: "http://localhost:1234/v1/embeddings",
    model: "text-embedding-bge-m3",
  })

  it("Embedder should return real embeddings", async () => {
    const vec = await embedder.embed("hello world")
    expect(vec.length).toBe(1024) // bge-m3 维度
    expect(vec.some((v) => v !== 0)).toBe(true) // 不全为 0
    console.log("Embedding dimension:", vec.length)
    console.log("First 5 values:", vec.slice(0, 5))
  })

  it("Embedder.cosine should compute similarity", async () => {
    const vec1 = await embedder.embed("API design patterns")
    const vec2 = await embedder.embed("REST API conventions")
    const vec3 = await embedder.embed("cooking recipes")

    const simRelated = Embedder.cosine(vec1, vec2)
    const simUnrelated = Embedder.cosine(vec1, vec3)

    console.log("Similar (API vs REST):", simRelated)
    console.log("Unrelated (API vs cooking):", simUnrelated)
    expect(simRelated).toBeGreaterThan(simUnrelated)
  })

  it("Embedder should handle batch embedding", async () => {
    const texts = ["hello", "world", "test"]
    const vecs = await embedder.embedBatch(texts)
    expect(vecs.length).toBe(3)
    expect(vecs[0].length).toBe(1024)
    console.log("Batch embedding returned", vecs.length, "vectors")
  })

  it("Embedder.cosine should return 1 for identical vectors", () => {
    const vec = [1, 0, 0]
    expect(Embedder.cosine(vec, vec)).toBe(1)
  })

  it("Embedder.cosine should return 0 for orthogonal vectors", () => {
    const vec1 = [1, 0, 0]
    const vec2 = [0, 1, 0]
    expect(Embedder.cosine(vec1, vec2)).toBe(0)
  })
})
