import json
from .base import BaseProvider

DEFAULT_MODEL = "gemini-1.5-pro"


class GeminiProvider(BaseProvider):
    def __init__(self, api_key: str):
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self._genai = genai
        except ImportError:
            raise RuntimeError("google-generativeai package not installed. Run: pip install google-generativeai")

    async def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        model: str,
        temperatura: float,
    ) -> tuple[str, list[dict]]:
        from google.generativeai.types import FunctionDeclaration, Tool

        system_parts: list[str] = []
        history: list[dict] = []
        last_user_msg = ""

        for m in messages:
            if m["role"] == "system":
                system_parts.append(m["content"])
            elif m["role"] == "user":
                last_user_msg = m["content"]
                history.append({"role": "user", "parts": [m["content"]]})
            elif m["role"] == "assistant":
                history.append({"role": "model", "parts": [m["content"]]})

        gemini_tools = None
        if tools:
            declarations = []
            for t in tools:
                declarations.append(FunctionDeclaration(
                    name=t["name"],
                    description=t["description"],
                    parameters=t["parameters"],
                ))
            gemini_tools = [Tool(function_declarations=declarations)]

        genai_model = self._genai.GenerativeModel(
            model_name=model or DEFAULT_MODEL,
            system_instruction="\n".join(system_parts) if system_parts else None,
            tools=gemini_tools,
            generation_config={"temperature": temperatura},
        )

        # history[-1] is always the current user message; pass the rest as prior turns.
        prior_history = history[:-1] if len(history) > 1 else []
        chat = genai_model.start_chat(history=prior_history)
        response = chat.send_message(last_user_msg or " ")

        tool_calls: list[dict] = []
        text_parts: list[str] = []

        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call.name:
                tool_calls.append({
                    "name": part.function_call.name,
                    "input": dict(part.function_call.args),
                })
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        return "\n".join(text_parts), tool_calls
