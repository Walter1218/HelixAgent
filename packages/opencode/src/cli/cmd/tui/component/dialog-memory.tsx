import { createMemo, createSignal, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"

interface MemoryResult {
  path: string
  snippet: string
  score: number
  scope: string
  type: string
}

export function DialogMemory() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<MemoryResult[]>([])
  const [loading, setLoading] = createSignal(false)
  
  const search = async () => {
    if (!query().trim()) return
    setLoading(true)
    try {
      const response = await sdk.client.memory.search({ query: query() })
      setResults(response.data ?? [])
    } catch (error) {
      console.error("Memory search failed:", error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Memory Search</text>
        <text fg={theme.textMuted} onClick={() => dialog.clear()}>esc</text>
      </box>
      
      <input 
        value={query()} 
        onInput={(e) => setQuery(e.target.value)} 
        onSubmit={search}
        placeholder="Search memory..."
      />
      
      <Show when={loading()}>
        <text fg={theme.textMuted}>Searching...</text>
      </Show>
      
      <Show when={!loading() && results().length === 0 && query().trim()}>
        <text fg={theme.textMuted}>No results found</text>
      </Show>
      
      <For each={results()}>
        {(result) => (
          <box flexDirection="column" gap={0} padding={1}>
            <text fg={theme.text}>
              {result.path} (score: {result.score.toFixed(2)})
            </text>
            <text fg={theme.textMuted}>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
