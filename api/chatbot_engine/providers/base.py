from abc import ABC, abstractmethod


class BaseProvider(ABC):
    """Abstract base for all AI provider adapters."""

    @abstractmethod
    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        temperatura: float,
    ) -> tuple[str, list[dict]]:
        """
        Send a conversation to the AI and handle tool calls.

        Args:
            messages: Conversation history in unified format [{role, content}]
            tools: Tool definitions in unified JSON Schema format
            model: Model identifier string
            temperatura: Temperature 0.0-1.0

        Returns:
            (response_text, tool_calls) where tool_calls is a list of
            {"name": str, "input": dict} dicts representing what the AI invoked.
        """

    def _tools_to_openai_format(self, tools: list[dict]) -> list[dict]:
        """Convert unified tool defs to OpenAI/OpenRouter/Ollama format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                },
            }
            for t in tools
        ]

    def _tools_to_anthropic_format(self, tools: list[dict]) -> list[dict]:
        """Convert unified tool defs to Anthropic Claude format."""
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "input_schema": t["parameters"],
            }
            for t in tools
        ]
