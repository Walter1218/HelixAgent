import { describe, it, expect } from "bun:test"
import { Embedder } from "@opencode-ai/core/memory/embedder"
import { hashContent } from "@opencode-ai/core/memory/semantic-hash"

const EMBEDDING_ENABLED = process.env.TEST_EMBEDDING === "1"

describe.skipIf(!EMBEDDING_ENABLED)("Embedder real API test", () => {
  const embedder = new Embedder({
    enabled: true,
    baseUrl: "http://localhost:1234/v1/embeddings",
    model: "text-embedding-bge-m3",
  })

  it("should return 1024-dim vectors for bge-m3", async () => {
    const vec = await embedder.embed("hello world")
    expect(vec.length).toBe(1024)
    expect(vec.some((v) => v !== 0)).toBe(true)
    console.log("✓ Dimension:", vec.length)
  })

  it("should compute cosine similarity correctly", async () => {
    const vec1 = await embedder.embed("API design patterns")
    const vec2 = await embedder.embed("REST API conventions")
    const vec3 = await embedder.embed("cooking recipes")

    const simRelated = Embedder.cosine(vec1, vec2)
    const simUnrelated = Embedder.cosine(vec1, vec3)

    console.log("✓ Similar (API vs REST):", simRelated.toFixed(4))
    console.log("✓ Unrelated (API vs cooking):", simUnrelated.toFixed(4))
    expect(simRelated).toBeGreaterThan(simUnrelated)
  })

  it("should batch embed correctly", async () => {
    const texts = ["hello", "world", "test"]
    const vecs = await embedder.embedBatch(texts)
    expect(vecs.length).toBe(3)
    expect(vecs[0].length).toBe(1024)
    console.log("✓ Batch returned", vecs.length, "vectors")
  })

  it("semantic hash should be deterministic", () => {
    const h1 = hashContent("test content")
    const h2 = hashContent("test content")
    const h3 = hashContent("different")
    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3)
    console.log("✓ Hash consistent:", h1)
  })

  it("cosine identity and orthogonality", () => {
    expect(Embedder.cosine([1, 0, 0], [1, 0, 0])).toBe(1)
    expect(Embedder.cosine([1, 0, 0], [0, 1, 0])).toBe(0)
    console.log("✓ Identity=1, Orthogonal=0")
  })
})
