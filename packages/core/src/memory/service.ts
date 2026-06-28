import { buildFtsQuery } from "./fts-query"
import { Embedder } from "./embedder"
import { reconcileMemory } from "./reconcile"

export interface Interface {
  readonly root: () => Promise<string>
  readonly reconcile: () => Promise<{ indexed: number; pruned: number; embedded: number }>
  readonly search: (input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }) => Promise<Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }>>
}

export class MemoryService implements Interface {
  private rootPath: string
  private embedder: Embedder

  constructor(rootPath: string, embedderConfig?: { baseUrl?: string; model?: string; enabled?: boolean }) {
    this.rootPath = rootPath
    this.embedder = new Embedder({
      enabled: embedderConfig?.enabled ?? true,
      baseUrl: embedderConfig?.baseUrl ?? "http://localhost:1234/v1/embeddings",
      model: embedderConfig?.model ?? "text-embedding-nomic-embed-text-v1.5",
    })
  }

  async root(): Promise<string> {
    return this.rootPath
  }

  async reconcile(): Promise<{ indexed: number; pruned: number; embedded: number }> {
    const result = await reconcileMemory({ mimo: this.rootPath })
    return { ...result, embedded: 0 }
  }

  async search(input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }): Promise<Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }>> {
    const ftsQuery = buildFtsQuery(input.query)
    if (!ftsQuery) return []
    
    return []
  }
}

export * as Memory from "./service"
