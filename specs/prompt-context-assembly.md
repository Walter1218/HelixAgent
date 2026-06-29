# Prompt Context Assembly Specification

This document defines the canonical order and placement rules for assembling the prompt context sent to LLM providers. The goal is to maximize KV prefix-cache hit rate across provider turns while preserving all existing product behavior.

All future changes that inject, reorder, or transform prompt context must follow this specification.

## 1. Background

Modern LLM APIs (OpenAI, Anthropic, Google, OpenAI-compatible providers) compute a KV cache for the prompt prefix. When the same prefix is sent in a subsequent request, the provider can reuse the cached KV state, reducing latency and cost.

Prefix caches match from the **start of the prompt sequence**. Once a single token differs, every token after it must be recomputed. Therefore:

- **Stable content must appear first**.
- **Dynamic content must appear last**.
- **No dynamic token may be placed between two stable blocks**.

## 2. Prompt Sequence

For a normal provider turn, HelixAgent sends the model a sequence of the following form:

```
┌─────────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (joined into one or more system messages)             │
│   [0] Provider persona prompt                                       │
│   [1] Static instructions (AGENTS.md / CLAUDE.md / config)          │
│   [2] Environment metadata (model, directory, platform, date)       │
│   [3] Project references                                            │
│   [4] MCP server instructions                                       │
│   [5] Available skills listing                                      │
│   [6] Structured-output reminder (conditional)                      │
│   [7] Per-user system override (input.user.system)                  │
├─────────────────────────────────────────────────────────────────────┤
│ MESSAGE HISTORY                                                     │
│   ... prior user / assistant / tool turns ...                       │
├─────────────────────────────────────────────────────────────────────┤
│ NEW USER MESSAGE                                                    │
│   user text + synthetic reminder parts + attachments                │
├─────────────────────────────────────────────────────────────────────┤
│ TOOL RESULTS (this turn)                                            │
│   ... results of tools executed in this turn ...                    │
└─────────────────────────────────────────────────────────────────────┘
```

The exact rendering of the system prompt is implemented in:

- `packages/opencode/src/session/prompt.ts` (lines ~1267-1281) — assembles `env`, `instructions`, `mcpInstructions`, `skills`.
- `packages/opencode/src/session/llm/request.ts` (lines ~56-78) — prepends provider persona, appends `input.user.system`, runs plugin hook, splits system into messages.

## 3. Ordering Rules

### 3.1 Stable prefix first

The following content is considered **stable for the lifetime of a session** and must appear at the start of the system prompt, in this order:

1. **Provider persona prompt** — selected by model ID at session start. Do not change mid-session.
2. **Static instructions** — output of `Instruction.system()` from `packages/opencode/src/session/instruction.ts`. Includes `AGENTS.md`, `CLAUDE.md`, and `config.instructions`. File contents are treated as stable within a session.

No dynamic content may be inserted between these two blocks.

### 3.2 Low-frequency dynamic content next

The following content may change during a session, but changes are infrequent:

3. **Environment metadata** — working directory, workspace root, git status, platform, today's date.
4. **Project references** — list of available project references.

These are placed after the stable prefix so that daily date changes or reference updates invalidate only the tokens that follow them, not the large instruction block.

### 3.3 High-frequency dynamic content last

The following content may change every turn and must appear at the end of the system prompt:

5. **MCP server instructions** — depend on connected servers and permissions.
6. **Skills listing** — depends on agent permissions and registered skills.
7. **Structured-output reminder** — only present when `format.type === "json_schema"`.
8. **Per-user system override** — from `input.user.system`.

### 3.4 Per-turn dynamic content belongs in user messages or tool results

Any context that is derived from the current turn's execution must be placed in the **latest user message** or in a **tool result**, never in the system prompt. This includes, but is not limited to:

- Changed files list / blast radius
- Memory retrieval results
- Workflow run status
- Team member context
- AST analysis output
- Any content produced by a tool call

This placement ensures the system prompt prefix remains cacheable while the dynamic content naturally appears at the end of the prompt sequence.

## 4. Content Placement Reference

| Content | Type | Allowed location | Forbidden location |
|---------|------|------------------|-------------------|
| Provider persona (beast.txt, anthropic.txt, etc.) | Stable/session | System prompt [0] | User messages, tool results |
| AGENTS.md / CLAUDE.md / config instructions | Stable/session | System prompt [1] | User messages, tool results |
| Environment metadata (model, dir, date, platform) | Dynamic/day | System prompt [2] | Between persona and instructions |
| Project references | Dynamic/session | System prompt [3] | Between persona and instructions |
| MCP instructions | Dynamic/turn | System prompt [4] | Between persona and instructions |
| Skills listing | Dynamic/turn | System prompt [5] | Between persona and instructions |
| `input.user.system` | Dynamic/turn | System prompt [7] | Between persona and instructions |
| Structured-output reminder | Conditional/turn | System prompt [6] | Between persona and instructions |
| Blast radius / changed files | Dynamic/turn | User message, tool result | System prompt |
| Memory search results | Dynamic/turn | User message, tool result | System prompt |
| Workflow status | Dynamic/turn | User message, tool result | System prompt |
| Team context | Dynamic/turn | User message, tool result | System prompt |
| Agent mode reminders (plan/build/compose) | Dynamic/turn | User message synthetic parts | System prompt |

## 5. Implementation Requirements

### 5.1 `packages/opencode/src/session/system-prompt-builder.ts`

All system prompt assembly must go through the `SystemPromptBuilder.build` function. It is the single point of construction for the system prompt array and enforces the canonical order:

```ts
const system = SystemPromptBuilder.build({
  instructions,       // static instructions first
  environment: env,   // environment metadata
  mcpInstructions,    // MCP server instructions
  skills,             // available skills
  structuredOutput,   // structured-output reminder
  userSystem,         // per-user system override
})
```

Direct construction of the system prompt array (e.g. `[...instructions, ...env, ...]`) outside of `SystemPromptBuilder.build` is prohibited in new code.

### 5.2 `packages/opencode/src/session/prompt.ts`

`runLoop` must use `SystemPromptBuilder.build(...)` to assemble the system prompt. The previous inline array construction has been replaced by the builder call (lines ~1266-1280).

### 5.3 `packages/opencode/src/session/llm/request.ts`

The final system string is built as:

```ts
const system = [
  [
    // provider persona + static instructions from SystemPromptBuilder
    ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)),
    ...input.system,
    // per-user system override (dynamic, allowed at the tail)
    ...(input.user.system ? [input.user.system] : []),
  ]
    .filter((x) => x)
    .join("\n"),
]
```

`input.system` is produced by `SystemPromptBuilder.build(...)` and already follows the correct order. `request.ts` prepends the provider persona and appends the per-user override. No reordering should be introduced here.

### 5.4 Plugin hook compatibility

The plugin hook `experimental.chat.system.transform` receives the `system` array and may modify it. Plugins must obey the following rule:

> **Do not insert content before `system[0]` or between `system[0]` and the rest of the array.**
> If a plugin needs to add system content, append it to the end of the array.

The existing fallback code in `request.ts` (lines 74-78) preserves `system[0]` as the provider persona and joins the remaining elements. This fallback only works if plugins do not insert content between the persona and the rest of the system prompt.

### 5.5 Per-turn context injection helper

When a feature needs to inject per-turn context into the prompt, use the existing pattern from `SessionReminders` (`packages/opencode/src/session/reminders.ts`): append a synthetic text part to the **last user message**.

Example pattern:

```ts
userMessage.parts.push({
  id: PartID.ascending(),
  messageID: userMessage.info.id,
  sessionID: userMessage.info.sessionID,
  type: "text",
  text: formatDynamicContext(context),
  synthetic: true,
})
```

This keeps the context at the end of the prompt sequence where it belongs.

### 5.6 Test coverage

The builder order is covered by unit tests in `packages/opencode/test/session/system-prompt-builder.test.ts`. Any change to the builder must keep these tests green.

## 6. Provider-Specific Cache Key Notes

### OpenAI Responses API

`prompt_cache_key` is supported by the OpenAI Responses API and is set via `ProviderTransform.options` in `packages/opencode/src/provider/transform.ts`. This is the only provider family where an explicit cache key is currently effective.

### OpenAI Chat Completions and OpenAI-compatible providers

The Chat Completions API does not expose a `prompt_cache_key` field. The `@ai-sdk/openai-compatible` package does not forward this option. Therefore, setting `promptCacheKey` for providers that use `@ai-sdk/openai-compatible` (including Kimi for Coding) has **no effect**.

For these providers, cache hit rate depends entirely on the provider's automatic prefix matching. Following the ordering rules in this document is the only available optimization.

### Anthropic Messages API

Anthropic uses content-based prefix caching with explicit `cache_control` breakpoints. Stable content placed early in the prompt is automatically cached. Per-turn dynamic content placed in user messages or tool results does not invalidate the cached system prefix.

### Gemini

Gemini also uses content-based prefix caching. The same ordering principles apply.

## 7. Sub-Agent Sessions

Sub-agent sessions (dream, distill, checkpoint-writer, judge, etc.) are spawned as new sessions with independent session IDs. For providers that use session-scoped cache keys (OpenAI Responses), the cache key cannot be shared with the parent session.

However, for content-based caches (Anthropic, Gemini), sub-agent sessions naturally share the same KV prefix because they load the same provider persona and static instructions. Do not introduce arbitrary dynamic content into sub-agent system prompts; follow the same ordering rules as primary sessions.

## 8. Change Checklist

Before merging any change that touches prompt assembly, verify:

- [ ] No dynamic content is inserted between the provider persona and static instructions.
- [ ] No dynamic content is inserted into the system prompt when it could be placed in a user message or tool result.
- [ ] The order in `packages/opencode/src/session/prompt.ts` matches Section 3.
- [ ] The plugin hook `experimental.chat.system.transform` does not break the stable prefix.
- [ ] For OpenAI-compatible providers, no new `promptCacheKey` setting is added unless the underlying AI SDK package is confirmed to forward it.

## 9. References

- `packages/opencode/src/session/prompt.ts` — main system prompt assembly
- `packages/opencode/src/session/llm/request.ts` — request preparation and system message splitting
- `packages/opencode/src/session/system.ts` — provider persona, env, skills, MCP instructions
- `packages/opencode/src/session/instruction.ts` — AGENTS.md / CLAUDE.md loading
- `packages/opencode/src/session/reminders.ts` — user-message synthetic parts pattern
- `packages/opencode/src/provider/transform.ts` — provider options and cache key configuration
