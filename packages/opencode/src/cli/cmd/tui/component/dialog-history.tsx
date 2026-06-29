import { createMemo, createSignal, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"

interface HistoryResult {
  sessionID: string
  messageID: string
  snippet: string
  score: number
  kind: string
  time: number
}

export function DialogHistory() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<HistoryResult[]>([])
  const [loading, setLoading] = createSignal(false)
  
  const search = async () => {
    if (!query().trim()) return
    setLoading(true)
    try {
      const response = await sdk.client.history.search({ query: query() })
      setResults(response.data ?? [])
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
        <text fg={theme.text} attributes={TextAttributes.BOLD}>History Search</text>
        <text fg={theme.textMuted} onClick={() => dialog.clear()}>esc</text>
      </box>
      
      <input 
        value={query()} 
        onInput={(e) => setQuery(e.target.value)} 
        onSubmit={search}
        placeholder="Search history..."
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
              {result.sessionID} - {formatDate(result.time)} ({result.kind})
            </text>
            <text fg={theme.textMuted}>{result.snippet}</text>
          </box>
        )}
      </For>
    </box>
  )
}
