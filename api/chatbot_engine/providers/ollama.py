from .openai_provider import OpenAIProvider

DEFAULT_BASE_URL = "http://localhost:11434/v1"
DEFAULT_MODEL = "llama3.1"
# Ollama's OpenAI-compat endpoint requires a placeholder API key
_PLACEHOLDER_KEY = "ollama"


class OllamaProvider(OpenAIProvider):
    """Ollama uses the OpenAI-compatible API on a local base_url."""

    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        super().__init__(
            api_key=api_key or _PLACEHOLDER_KEY,
            base_url=base_url or DEFAULT_BASE_URL,
        )

    async def chat_with_tools(self, messages, tools, model, temperatura):
        return await super().chat_with_tools(
            messages, tools, model or DEFAULT_MODEL, temperatura
        )
