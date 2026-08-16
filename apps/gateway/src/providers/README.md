# Providers

**1.5 — Grok (xAI).** `createGrokCompleter` POSTs to `{GROK_BASE_URL}/chat/completions` with `Bearer GROK_API_KEY`. Non-streaming only.

Do not log API keys or raw prompts. Secret Manager wiring is a later deploy step (env only for now).
