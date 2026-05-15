from .openai_provider import OpenAIProvider

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash:free"


class OpenRouterProvider(OpenAIProvider):
    """OpenRouter uses the OpenAI-compatible API."""

    def __init__(self, api_key: str, base_url: str | None = None):
        super().__init__(api_key=api_key, base_url=base_url or DEFAULT_BASE_URL)

    async def chat_with_tools(self, messages, tools, model, temperatura):
        return await super().chat_with_tools(
            messages, tools, model or DEFAULT_MODEL, temperatura
        )
