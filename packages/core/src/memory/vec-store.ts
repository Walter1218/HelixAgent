import { Embedder } from "./embedder"

export interface VecSearchRow {
  memory_path: string
  score: number
}

export class VecStore {
  public readonly embedder: Embedder

  constructor(embedder: Embedder) {
    this.embedder = embedder
  }

  get isEmbeddingEnabled(): boolean {
    return this.embedder.enabled
  }

  async indexOne(memoryPath: string, body: string): Promise<void> {
    if (!this.embedder.enabled) return
    try {
      await this.embedder.embed(body.slice(0, 8000))
    } catch (err) {
      console.warn("indexOne failed", { path: memoryPath, error: String(err) })
    }
  }

  async indexMany(items: Array<{ memoryPath: string; body: string }>): Promise<void> {
    if (!this.embedder.enabled || items.length === 0) return
    const bodies = items.map((i) => i.body.slice(0, 8000))
    await this.embedder.embedBatch(bodies)
  }

  async search(queryText: string, limit = 5): Promise<VecSearchRow[]> {
    if (!this.embedder.enabled) return []
    try {
      await this.embedder.embed(queryText)
      return []
    } catch (err) {
      console.warn("search failed", { error: String(err) })
      return []
    }
  }
}
