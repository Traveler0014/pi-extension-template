/**
 * Example Plugin — Tool & Command Extension
 *
 * Demonstrates the complete patterns for registering custom tools and
 * slash commands in pi with proper TUI rendering and error handling.
 *
 * ## What this extension provides
 *
 * - Tool: `example_tool` — callable by the AI model (demonstrates structured
 *    result format, renderCall/renderResult, error handling)
 * - Command: `/example` — user-invokable slash command (demonstrates
 *    ctx.ui.notify, LLM fallback pattern)
 *
 * ## Testing
 *
 *   pi -e ./tools/example-plugin/index.ts
 *   /example hello world              # test command
 *   > Please call example_tool now    # test tool via agent
 *
 * ## Credits
 *
 * This template is based on patterns from pi-alarm and pi-github.
 * See https://github.com/Traveler0014/pi-alarm and
 * https://github.com/Traveler0014/pi-github for real-world examples.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Wrap a plain-text result into the structured format pi expects.
 *
 * IMPORTANT: Always return this shape from tool execute() methods.
 * NEVER return a plain string — the agent needs structured output
 * with a content array and optional details for the TUI to render.
 */
function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details: details ?? {},
  };
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function (pi: ExtensionAPI) {
  // ── Tool: example_tool ──────────────────────────────────────────────────
  //
  // Tools are callable by the AI model during conversations.
  // The agent decides when to call based on the tool's description.
  //
  // Key properties of a well-designed tool:
  //   1. name: snake_case with prefix (e.g. "example_tool")
  //   2. label: short human-readable label for TUI rendering
  //   3. description: detailed — the agent reads this to decide WHEN to call
  //   4. parameters: JSON Schema object describing accepted arguments
  //   5. execute: returns { content: [...], details: {...} }
  //   6. renderCall: how the tool invocation appears in the TUI conversation
  //   7. renderResult: how the tool result appears in the TUI conversation

  pi.registerTool({
    name: "example_tool",
    label: "Example Tool",

    description:
      "An example tool demonstrating proper pi extension patterns. " +
      "Replace this with your actual implementation. " +
      "See pi-github and pi-alarm for production examples.",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The input query to process",
        },
        format: {
          type: "string",
          enum: ["json", "text"],
          description: "Output format for the result (default: text)",
        },
      },
      required: ["query"],
    },

    // ── execute() — the actual tool logic ───────────────────────────────
    //
    // Parameters:
    //   _toolCallId   — unique ID for this invocation (use for logging/tracing)
    //   params        — the validated argument object (typed per your schema)
    //
    // Return value MUST be:
    //   { content: [{ type: "text", text: "..." }], details: { ... } }
    //
    // Do NOT return plain strings or bare objects.

    async execute(_toolCallId, params) {
      // 1. Validate inputs — agent-facing tools should be strict
      if (!params.query || params.query.trim().length === 0) {
        return textResult(
          `Error: 'query' must be a non-empty string. Received: "${params.query}"`,
          { error: "invalid query" },
        );
      }

      // 2. Execute your actual business logic
      const response = processQuery(params.query, params.format);

      // 3. Return structured result with details for TUI rendering
      return textResult(
        response.text,
        {
          formatted: response.formatted,
          format: params.format || "text",
          queryLength: params.query.length,
        },
      );
    },

    // ── renderCall() — how the tool invocation looks in the TUI ────────
    //
    // This renders BEFORE the tool executes (shows what's about to happen).
    // Use colors from theme to match pi's visual style:
    //   theme.fg("toolTitle", ...) for the tool name
    //   theme.fg("accent", ...)   for repo names, IDs, etc.
    //   theme.fg("muted", ...)    for secondary info
    //   theme.fg("text", ...)     for primary content
    //   theme.fg("dim", ...)      for tertiary/placeholder text

    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("example_tool"));
      text += " " + theme.fg("accent", `"${args.query}"`);
      if (args.format) {
        text += " " + theme.fg("dim", `(${args.format})`);
      }
      return new Text(text, 0, 0);
    },

    // ── renderResult() — how the tool result appears in the TUI ─────────
    //
    // This renders AFTER the tool executes (shows the outcome).
    // Access result.content[0].text for the plain text output.
    // Access result.details for the structured metadata.
    //
    // Common patterns:
    //   theme.fg("success", ...) for successful results
    //   theme.fg("error", ...)   for error results
    //   theme.fg("muted", ...)   for compact summary views

    renderResult(result, _options, theme, _context) {
      const content = result.content[0];
      const details = result.details as Record<string, unknown> | undefined;

      if (details?.error) {
        // Error state — show compact error in red
        return new Text(theme.fg("error", "Failed"), 0, 0);
      }

      if (content?.type === "text") {
        const firstLine = content.text.split("\n")[0];
        return new Text(theme.fg("muted", firstLine), 0, 0);
      }

      return new Text(theme.fg("success", "Done"), 0, 0);
    },
  });

  // ── Command: /example ───────────────────────────────────────────────────
  //
  // Commands are user-invokable via /command-name in the pi TUI.
  //
  // Key differences from tools:
  //   - Commands use kebab-case (/example-command)
  //   - Use ctx.ui.notify() for user feedback (NOT return values)
  //   - Can use ctx.ui.select() / ctx.ui.input() / ctx.ui.confirm() for
  //     interactive prompts
  //   - Parse loosely, fall back to LLM if parsing fails

  pi.registerCommand("example", {
    description: "An example command demonstrating proper patterns — /example <text>",

    async handler(args, ctx) {
      const input = args.trim();

      // ── Show usage if no input ──────────────────────────────────────
      if (!input) {
        ctx.ui.notify("Usage: /example <text>", "warning");
        return;
      }

      // ── Simple parsing attempt ──────────────────────────────────────
      const parts = input.split(/\s+/);
      const verb = parts[0];
      const rest = parts.slice(1).join(" ");

      // ── Handle known sub-commands ──────────────────────────────────
      if (verb === "greet") {
        ctx.ui.notify(`Hello, ${rest || "world"}! 👋`, "info");
        return;
      }

      // ── LLM fallback for unhandled input ───────────────────────────
      //
      // When the command parser doesn't understand the input, forward
      // it to the AI agent via pi.sendUserMessage(). This is the
      // RECOMMENDED pattern — never just show an error and quit.
      if (ctx.isIdle()) {
        pi.sendUserMessage(
          `User invoked /example with: "${input}". ` +
          `Process this request using the example_tool if appropriate.`,
        );
      } else {
        ctx.ui.notify("Agent is busy, try again in a moment", "warning");
      }
    },
  });
}

// =============================================================================
// Business Logic (your actual implementation goes here)
// =============================================================================

function processQuery(
  query: string,
  format?: string,
): { text: string; formatted: unknown } {
  const result = {
    query,
    processed: query.toUpperCase(),
    length: query.length,
    timestamp: new Date().toISOString(),
  };

  const formatted = format === "json" ? result : null;

  return {
    text: format === "json"
      ? JSON.stringify(result, null, 2)
      : `Processed: ${query} → ${result.processed} (length=${result.length})`,
    formatted,
  };
}
