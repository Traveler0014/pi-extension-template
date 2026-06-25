/**
 * Example Provider Extension
 *
 * A minimal yet complete provider extension demonstrating the proper
 * structure for adding custom LLM API providers to pi.
 *
 * ## What this extension provides
 *
 * - A custom provider: "example" with one sample model
 * - Demonstrates model definition, compat settings, and API configuration
 *
 * ## Quick Start
 *
 * 1. Define your models in the MODELS array below
 * 2. Configure baseUrl, apiKey, and api format in registerProvider()
 * 3. Set compat options to match your API's behavior
 *
 * ## Testing
 *
 *   pi -e ./example-provider/index.ts
 *   /login → "Use an API key" → example → paste your key
 *   /model example/example-model
 *
 * ## Credits
 *
 * Real production providers are in the pi-providers repo.
 * See https://github.com/Traveler0014/pi-providers for examples.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// =============================================================================
// Model Definitions
// =============================================================================

interface ExampleModel {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  /** Cost per million tokens. Set to 0 for free/self-hosted models. */
  cost: {
    input: number;
    output: number;
    /** Cache read cost (for prompt caching, if supported) */
    cacheRead: number;
    /** Cache write cost (for prompt caching, if supported) */
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}

const MODELS: ExampleModel[] = [
  {
    id: "example-model",
    name: "Example Model",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
  },
  // Add more models here...
  // {
  //   id: "example-model-pro",
  //   name: "Example Model Pro",
  //   reasoning: true,
  //   input: ["text", "image"],
  //   cost: { input: 2.5, output: 10, cacheRead: 0.5, cacheWrite: 5 },
  //   contextWindow: 200000,
  //   maxTokens: 8192,
  // },
];

// =============================================================================
// Compat Settings
// =============================================================================

/**
 * Adjust these based on your API's behavior.
 *
 * Common API providers have different conventions. Use this as reference:
 *
 * ┌──────────────────────┬──────────┬───────────┬──────────┬──────────────────┐
 * │ Provider             │ OpenAI   │ Anthropic │ DeepSeek │ Google Gemini    │
 * ├──────────────────────┼──────────┼───────────┼──────────┼──────────────────┤
 * │ supportsDevRole      │ true     │ false     │ false    │ false            │
 * │ requiresToolResName  │ false    │ true      │ false    │ false            │
 * │ maxTokensField       │ max_tok. │ max_tok.  │ max_tok. │ max_output_tok.  │
 * │ thinkingFormat       │ none     │ anthropic │ none     │ gemini           │
 * └──────────────────────┴──────────┴───────────┴──────────┴──────────────────┘
 *
 * - supportsDeveloperRole:  Does the API accept "developer" role messages?
 *                           OpenAI uses it for system-like instructions.
 *                           Most other providers only accept "system".
 * - requiresToolResultName: Does the API require "name" field in tool result
 *                           messages? Anthropic requires it, OpenAI doesn't.
 * - maxTokensField:         Which field name does the API expect for max
 *                           output tokens? Check your provider's API docs.
 * - thinkingFormat:         For reasoning models — the format used for the
 *                           reasoning/thinking block.
 */
const BASE_COMPAT = {
  supportsDeveloperRole: false,
  requiresToolResultName: false,
  maxTokensField: "max_tokens" as const,
} as const;

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function (pi: ExtensionAPI) {
  pi.registerProvider("example", {
    name: "Example Provider",

    /**
     * The API base URL. Pi will append completions/chat endpoints.
     * For OpenAI-compatible APIs, this is typically the /v1 endpoint.
     *
     * Common patterns:
     *   - OpenAI:       https://api.openai.com/v1
     *   - Anthropic:    https://api.anthropic.com/v1
     *   - Local LLM:    http://localhost:11434/v1  (Ollama)
     *   - Self-hosted:  https://your-server.com/v1
     */
    baseUrl: "https://api.example.com/v1",

    /**
     * The environment variable name for the API key.
     * Prefix with $ to indicate it's read from env vars.
     * Pi will show it in /login for users to configure.
     *
     * The /login command flow:
     *   1. User types /login
     *   2. Selects "Use an API key"
     *   3. Chooses "example" from the provider list
     *   4. Enters their API key — stored via pi's credential manager
     */
    apiKey: "$EXAMPLE_API_KEY",

    /**
     * The API format. Supported values:
     *   - "openai-completions" — for OpenAI-compatible chat/completions APIs
     *     (this is the most common; works with OpenAI, DeepSeek, Ollama,
     *      vLLM, and many more)
     */
    api: "openai-completions",

    /**
     * Set to false if the API uses a custom auth mechanism
     * (e.g. x-api-key header instead of Authorization: Bearer).
     */
    authHeader: true,

    /**
     * Model definitions. Each model can have its own compat overrides
     * (e.g. a reasoning model within the same provider may need
     * different thinkingFormat than the base models).
     */
    models: MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: m.input,
      cost: m.cost,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      compat: BASE_COMPAT,
      // For individual model overrides, spread and override:
      // compat: { ...BASE_COMPAT, thinkingFormat: "anthropic" as const },
    })),
  });
}
