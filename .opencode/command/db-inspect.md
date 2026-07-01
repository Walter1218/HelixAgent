---
description: Read-only inspection of opencode trajectory database (sessions, messages, tool usage)
model: opencode/claude-haiku-4-5
---

Inspect the opencode trajectory database to answer questions about sessions, messages, and tool usage.

## Input

$ARGUMENTS — a natural language query about the database (e.g., "last 10 sessions", "tool usage stats", "messages in session X")

## Database Locations

- **Main DB**: `~/.local/share/opencode/opencode.db`
- **Local DB**: `~/.local/share/opencode/opencode-local.db`

## Available Tables

- `session` — sessions with title, model, cost, tokens, timestamps
- `message` — messages with session_id, role, data (JSON)
- `part` — message parts with tool calls, text, reasoning (JSON in data column)
- `project` — projects with directory paths
- `event` — events with session_id and data

## Common Queries

### List recent sessions
```sql
SELECT id, title, datetime(time_created/1000, 'unixepoch') as created, cost
FROM session ORDER BY time_created DESC LIMIT 20;
```

### Tool usage stats
```sql
SELECT json_extract(data, '$.tool') as tool_name, count(*) as cnt
FROM part WHERE json_extract(data, '$.type') = 'tool'
GROUP BY tool_name ORDER BY cnt DESC;
```

### Session message count
```sql
SELECT s.title, count(m.id) as msgs
FROM session s LEFT JOIN message m ON m.session_id = s.id
GROUP BY s.id ORDER BY s.time_created DESC LIMIT 20;
```

### User messages in a session
```sql
SELECT json_extract(p.data, '$.text') as user_text
FROM part p JOIN message m ON p.message_id = m.id
WHERE json_extract(p.data, '$.type') = 'text'
  AND json_extract(m.data, '$.role') = 'user'
  AND m.session_id = 'SESSION_ID'
  AND json_extract(p.data, '$.text') != ''
ORDER BY m.time_created;
```

## Rules

- This is READ ONLY. Never INSERT, UPDATE, DELETE, or DROP anything.
- Always use `sqlite3` from bash, not interactive mode.
- Trim long output with `LIMIT` clauses.
- Use `json_extract()` to parse JSON columns in `message` and `part` tables.
- Session IDs start with `ses_`, message IDs start with `msg_`.
- Timestamps are in milliseconds since epoch — divide by 1000 for `datetime()`.
