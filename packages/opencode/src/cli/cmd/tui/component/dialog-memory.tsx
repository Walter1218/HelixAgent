import { createMemo, createSignal, For, Show } from "solid-js"

interface MemoryResult {
  path: string
  snippet: string
  score: number
}

export function DialogMemory(props: {
  onSearch: (query: string) => Promise<MemoryResult[]>
}) {
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<MemoryResult[]>([])
  const [loading, setLoading] = createSignal(false)
  
  const search = async () => {
    if (!query().trim()) return
    setLoading(true)
    try {
      const data = await props.onSearch(query())
      setResults(data)
    } catch (error) {
      console.error("Memory search failed:", error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <text>Memory Search</text>
      
      <input 
        value={query()} 
        onInput={(e) => setQuery(typeof e === 'string' ? e : '')} 
        onSubmit={search}
        placeholder="Search memory..."
      />
      
      <Show when={loading()}>
        <text>Searching...</text>
      </Show>
      
      <Show when={!loading() && results().length === 0 && query().trim()}>
        <text>No results found</text>
      </Show>
      
      <For each={results()}>
        {(result) => (
          <box flexDirection="column" gap={0} padding={1}>
            <text>{result.path} (score: {result.score.toFixed(2)})</text>
            <text>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
