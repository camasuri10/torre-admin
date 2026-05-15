import json
from .base import BaseProvider

DEFAULT_MODEL = "claude-sonnet-4-6"


class ClaudeProvider(BaseProvider):
    def __init__(self, api_key: str):
        try:
            import anthropic
            self._client = anthropic.Anthropic(api_key=api_key)
        except ImportError:
            raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        temperatura: float,
    ) -> tuple[str, list[dict]]:
        import anthropic

        system_msg = None
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                filtered.append({"role": m["role"], "content": m["content"]})

        anthropic_tools = self._tools_to_anthropic_format(tools) if tools else []

        kwargs: dict = {
            "model": model or DEFAULT_MODEL,
            "max_tokens": 2048,
            "temperature": temperatura,
            "messages": filtered,
        }
        if system_msg:
            kwargs["system"] = system_msg
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        response = self._client.messages.create(**kwargs)

        tool_calls: list[dict] = []
        text_parts: list[str] = []

        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({"name": block.name, "input": block.input})

        return "\n".join(text_parts), tool_calls
