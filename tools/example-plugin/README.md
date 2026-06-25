# example-plugin

Example tool and command extension for pi — demonstrates the complete patterns for registering custom tools and slash commands with proper TUI rendering.

> **This is a template.** Replace the placeholder logic with your actual implementation.  
> See [pi-alarm](https://github.com/Traveler0014/pi-alarm) and [pi-github](https://github.com/Traveler0014/pi-github) for production examples.

## Naming convention

| Layer | Style | Format | Example |
|-------|-------|--------|---------|
| Tool (agent) | `snake_case` | `<prefix>_<verb>` | `example_tool`, `gh_issue_create`, `alarm_set` |
| Command (user) | `kebab-case` | `/<prefix>-<verb>` | `/example`, `/gh-login`, `/alarm-list` |

- **prefix**: identifies the source extension
- **verb**: a single action word (`set`, `list`, `cancel`, `create`, `delete`)
- **exception**: non-verb getters with self-explanatory names (e.g. `alarm_now`)

## Features

- **Tool:** `example_tool` — AI-callable tool with structured result format, TUI rendering, and error handling
- **Command:** `/example` — user-invokable slash command with `ctx.ui.notify()` and LLM fallback

## Tools (agent-facing, snake_case)

### `example_tool`

An example tool demonstrating proper pi extension patterns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | The input query to process |
| `format` | string ("json", "text") | ❌ | Output format (default: text) |

**Tool result format** — always return this shape:

```typescript
{
  content: [{ type: "text", text: "..." }],
  details: { /* optional metadata for TUI rendering */ }
}
```

Never return a plain string from `execute()` — pi requires structured output.

## Commands (user-facing, kebab-case)

### `/example`

Interactive slash command with sub-commands and LLM fallback.

```bash
/example greet Alice           # Direct handling
/example process this text     # Falls back to LLM if parser doesn't understand
```

When the command parser doesn't understand the input, use `pi.sendUserMessage()` to forward it to the AI agent — never just show an error.

## Key Patterns Demonstrated

### 1. Structured tool results

```typescript
function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details: details ?? {},
  };
}
```

### 2. renderCall / renderResult for TUI

```typescript
renderCall(args, theme, _context) {
  return new Text(theme.fg("toolTitle", theme.bold("example_tool")), 0, 0);
},

renderResult(result, _options, theme, _context) {
  return new Text(theme.fg("success", "Done"), 0, 0);
},
```

### 3. LLM fallback for commands

```typescript
if (ctx.isIdle()) {
  pi.sendUserMessage(`User invoked /example: "${input}". Process this...`);
} else {
  ctx.ui.notify("Agent is busy, try again in a moment", "warning");
}
```

## Customization Checklist

- [ ] Replace tool `name`, `label`, and `description`
- [ ] Define tool `parameters` schema (JSON Schema)
- [ ] Implement tool `execute()` returning structured result
- [ ] Implement `renderCall()` and `renderResult()` with theme colors
- [ ] Replace command `name` and `description`
- [ ] Implement command `handler()` with `ctx.ui.notify()`
- [ ] Add LLM fallback for unparseable command input
- [ ] Update this README

## Install

```bash
pi install https://github.com/Traveler0014/pi-extension-template.git
```

## License

MIT
