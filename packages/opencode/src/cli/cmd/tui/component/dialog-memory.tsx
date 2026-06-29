import { createMemo, createSignal, For, Show } from "solid-js"

interface MemoryResult {
  path: string
  snippet: string
  score: number
}

export function DialogMemory(props: {
  onSearch: (query: string) => Promise<MemoryResult[]>
  onClose: () => void
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
      <box flexDirection="row" justifyContent="space-between">
        <text style={{ bold: true }}>Memory Search</text>
        <text style={{ color: "#888" }} onClick={props.onClose}>esc</text>
      </box>
      
      <input 
        value={query()} 
        onInput={(e) => setQuery(e.target.value)} 
        onSubmit={search}
        placeholder="Search memory..."
      />
      
      <Show when={loading()}>
        <text style={{ color: "#888" }}>Searching...</text>
      </Show>
      
      <Show when={!loading() && results().length === 0 && query().trim()}>
        <text style={{ color: "#888" }}>No results found</text>
      </Show>
      
      <For each={results()}>
        {(result) => (
          <box flexDirection="column" gap={0} padding={1}>
            <text>
              {result.path} (score: {result.score.toFixed(2)})
            </text>
            <text style={{ color: "#888" }}>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
