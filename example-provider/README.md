# example-provider

Example provider extension for pi — demonstrates the complete structure for adding a custom LLM API provider with proper model definitions and compat settings.

> **This is a template.** Replace the placeholder values with your actual API details.  
> Real production providers are in [pi-providers](https://github.com/Traveler0014/pi-providers).

## Models

| Model | Context | Max Output | Image | Reasoning |
|-------|---------|------------|-------|-----------|
| `example-model` | 128K | 4K | ✗ | ✗ |

## Compat Settings Reference

Different API providers have different conventions. Adjust `BASE_COMPAT` accordingly:

| Provider | supportsDeveloperRole | requiresToolResultName | maxTokensField | thinkingFormat |
|----------|----------------------|----------------------|----------------|----------------|
| OpenAI | ✅ true | ❌ false | `max_tokens` | — |
| Anthropic | ❌ false | ✅ true | `max_tokens` | `anthropic` |
| DeepSeek | ❌ false | ❌ false | `max_tokens` | — |
| Google Gemini | ❌ false | ❌ false | `max_output_tokens` | `gemini` |
| Ollama / vLLM | ❌ false | ❌ false | `max_tokens` | — |

## Setup

### Option A: `/login` command (recommended)

```
/login → "Use an API key" → example → paste your key
```

The API key is stored via pi's credential manager, not in plaintext config files.

### Option B: Environment variable

```bash
export EXAMPLE_API_KEY="your-key-here"
```

Pi will read `$EXAMPLE_API_KEY` from the environment at startup.

## Usage

```bash
/model example/example-model
```

## Customization Checklist

- [ ] Replace `baseUrl` with your API endpoint (typically `/v1` for OpenAI-compatible)
- [ ] Replace `apiKey` env var name (`$EXAMPLE_API_KEY`)
- [ ] Update `MODELS` array with your actual models (id, name, contextWindow, maxTokens, cost)
- [ ] Adjust `BASE_COMPAT` settings for your API's behavior
- [ ] For reasoning models: add `thinkingFormat` to the model's compat override
- [ ] Set real `cost` values (per million tokens)
- [ ] Update this README

## License

MIT
