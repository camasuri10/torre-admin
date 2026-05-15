import json
from .base import BaseProvider

DEFAULT_MODEL = "gpt-4o"


class OpenAIProvider(BaseProvider):
    def __init__(self, api_key: str, base_url: str | None = None):
        try:
            from openai import OpenAI
            self._client = OpenAI(api_key=api_key, base_url=base_url)
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")

    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        temperatura: float,
    ) -> tuple[str, list[dict]]:
        openai_tools = self._tools_to_openai_format(tools) if tools else []

        kwargs: dict = {
            "model": model or DEFAULT_MODEL,
            "temperature": temperatura,
            "messages": messages,
        }
        if openai_tools:
            kwargs["tools"] = openai_tools
            kwargs["tool_choice"] = "auto"

        response = self._client.chat.completions.create(**kwargs)
        msg = response.choices[0].message

        tool_calls: list[dict] = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append({
                    "name": tc.function.name,
                    "input": json.loads(tc.function.arguments),
                })

        return msg.content or "", tool_calls
