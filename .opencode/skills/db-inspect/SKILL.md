---
name: db-inspect
description: Inspect opencode SQLite databases — list tables, view schemas, query sessions and tool usage patterns
---

# DB Inspect

Read-only inspection of opencode SQLite databases for debugging and analysis.

## When To Use

- Understanding database schema
- Analyzing session history and tool usage
- Debugging data issues
- Reviewing past sessions for patterns

## Database Locations

| Database | Path | Purpose |
|----------|------|---------|
| opencode-local.db | `~/.local/share/opencode/opencode-local.db` | Primary local database |
| opencode.db | `~/.local/share/opencode/opencode.db` | Shared/legacy database |

## Pattern

### 1. List tables

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db ".tables"
```

### 2. View table schema

```bash
# Session table
sqlite3 ~/.local/share/opencode/opencode-local.db ".schema session"

# Message table
sqlite3 ~/.local/share/opencode/opencode-local.db ".schema message"

# Part table (tool calls)
sqlite3 ~/.local/share/opencode/opencode-local.db ".schema part"
```

### 3. Count records

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "SELECT count(*) FROM session;"
sqlite3 ~/.local/share/opencode/opencode-local.db "SELECT count(*) FROM message;"
sqlite3 ~/.local/share/opencode/opencode-local.db "SELECT count(*) FROM part;"
```

### 4. Recent sessions

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT id, title, datetime(time_created/1000, 'unixepoch') as created, 
       tokens_input + tokens_output as total_tokens, cost
FROM session 
ORDER BY time_created DESC
LIMIT 20;
"
```

### 5. Tool usage statistics

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT json_extract(data, '$.tool') as tool_name, count(*) as cnt
FROM part 
WHERE json_extract(data, '$.type') = 'tool'
GROUP BY tool_name
ORDER BY cnt DESC
LIMIT 20;
"
```

### 6. Sessions by date range

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT title, datetime(time_created/1000, 'unixepoch') as created
FROM session 
WHERE time_created > (strftime('%s', 'now', '-7 days') * 1000)
ORDER BY time_created DESC;
"
```

### 7. Tool calls per session

```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT s.title, count(p.id) as tool_calls
FROM session s
JOIN part p ON p.session_id = s.id
WHERE json_extract(p.data, '$.type') = 'tool'
GROUP BY s.id
ORDER BY tool_calls DESC
LIMIT 10;
"
```

## Common Queries

### Find sessions by agent type
```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT title, agent, datetime(time_created/1000, 'unixepoch') as created
FROM session 
WHERE agent = 'build'
ORDER BY time_created DESC
LIMIT 10;
"
```

### Find most expensive sessions
```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT title, cost, tokens_input + tokens_output as total_tokens
FROM session 
ORDER BY cost DESC
LIMIT 10;
"
```

### Find tool usage in date range
```bash
sqlite3 ~/.local/share/opencode/opencode-local.db "
SELECT json_extract(data, '$.tool') as tool_name, count(*) as cnt
FROM part 
WHERE json_extract(data, '$.type') = 'tool'
  AND time_created > (strftime('%s', 'now', '-7 days') * 1000)
GROUP BY tool_name
ORDER BY cnt DESC;
"
```

## Anti-patterns

- Don't modify the database directly
- Don't run expensive queries without LIMIT
- Don't expose API keys from auth.json
