import { createMemo, createSignal, For, Show } from "solid-js"

interface HistoryResult {
  sessionID: string
  messageID: string
  snippet: string
  score: number
  kind: string
  time: number
}

export function DialogHistory(props: {
  onSearch: (query: string) => Promise<HistoryResult[]>
  onClose: () => void
}) {
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<HistoryResult[]>([])
  const [loading, setLoading] = createSignal(false)
  
  const search = async () => {
    if (!query().trim()) return
    setLoading(true)
    try {
      const data = await props.onSearch(query())
      setResults(data)
    } catch (error) {
      console.error("History search failed:", error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" justifyContent="space-between">
        <text>History Search</text>
        <text onClick={props.onClose}>esc</text>
      </box>
      
      <input 
        value={query()} 
        onInput={(e) => setQuery(e.target.value)} 
        onSubmit={search}
        placeholder="Search history..."
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
            <text>{result.sessionID} - {formatDate(result.time)} ({result.kind})</text>
            <text>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
