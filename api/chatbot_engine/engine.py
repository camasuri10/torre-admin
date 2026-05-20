"""
ChatbotEngine: Orchestrates the AI provider + tool execution loop.
"""
import json
from datetime import date

from .tools import get_tools_for_role, execute_tool

_ROL_DISPLAY = {
    "superadmin": "Super Administrador",
    "administrador": "Administrador",
    "propietario": "Propietario",
    "inquilino": "Inquilino",
    "portero": "Portero / Seguridad",
    "servicios": "Servicios Generales",
    "backoffice": "Backoffice",
}

_CAPACIDADES_POR_ROL = {
    "superadmin": "gestión global de conjuntos, módulos, estadísticas de plataforma y todas las operaciones administrativas.",
    "administrador": "gestión de usuarios, cuotas, comunicados, mantenimientos, reservas, paquetes y accesos de tu conjunto.",
    "propietario": "consulta de tus cuotas, comunicados, hacer reservas de zonas comunes y reportar problemas de mantenimiento.",
    "inquilino": "consulta de comunicados, zonas comunes y reportar problemas de mantenimiento.",
}

SYSTEM_PROMPT_TEMPLATE = """Eres el asistente inteligente de TorreAdmin para el conjunto con ID {conjunto_id}.
Hoy es {fecha}.
Rol del usuario autenticado: {rol_display} (ID: {usuario_id}).

Puedes ayudar con: {capacidades}

Instrucciones importantes:
- Responde SIEMPRE en español, de forma concisa y amigable.
- Si vas a ejecutar una acción que crea, modifica o elimina datos, confirma brevemente qué vas a hacer.
- Si el usuario pide algo fuera de tus capacidades o de su rol, explícalo amablemente.
- Cuando uses una herramienta y obtengas resultados, preséntaselos de forma clara y legible, no como JSON crudo.
- Si hay un error de la herramienta, informa al usuario de forma amigable.
"""


class ChatbotEngine:
    def __init__(self, config: dict):
        """
        config: dict with keys proveedor, api_key, modelo, base_url, temperatura
        """
        self._provider = self._build_provider(config)
        self._model = config.get("modelo") or ""
        self._temperatura = float(config.get("temperatura", 0.3))

    def _build_provider(self, config: dict):
        proveedor = config.get("proveedor", "claude")
        api_key = config.get("api_key", "")
        base_url = config.get("base_url")

        if proveedor == "claude":
            from .providers.claude import ClaudeProvider
            return ClaudeProvider(api_key=api_key)
        elif proveedor == "openai":
            from .providers.openai_provider import OpenAIProvider
            return OpenAIProvider(api_key=api_key)
        elif proveedor == "gemini":
            from .providers.gemini import GeminiProvider
            return GeminiProvider(api_key=api_key)
        elif proveedor == "openrouter":
            from .providers.openrouter import OpenRouterProvider
            return OpenRouterProvider(api_key=api_key, base_url=base_url)
        elif proveedor == "ollama":
            from .providers.ollama import OllamaProvider
            return OllamaProvider(base_url=base_url, api_key=api_key)
        else:
            raise ValueError(f"Unknown provider: {proveedor}")

    async def process(
        self,
        message: str,
        history: list[dict],
        context: dict,
    ) -> dict:
        """
        Process a user message and return the assistant's response.

        context keys: token, conjunto_id, usuario_id, rol, conjunto_nombre, api_base
        Returns: { message: str, actions: list[{tool, success, summary}] }
        """
        rol = context.get("rol", "propietario")
        tools = get_tools_for_role(rol)

        system_content = SYSTEM_PROMPT_TEMPLATE.format(
            conjunto_id=context.get("conjunto_id", ""),
            fecha=str(date.today()),
            rol_display=_ROL_DISPLAY.get(rol, rol),
            usuario_id=context.get("usuario_id", ""),
            capacidades=_CAPACIDADES_POR_ROL.get(rol, "consultas generales."),
        )

        # Build messages with system prompt
        messages = [{"role": "system", "content": system_content}]
        messages.extend(history)
        messages.append({"role": "user", "content": message})

        # First AI call
        response_text, tool_calls = await self._provider.chat_with_tools(
            messages=messages,
            tools=tools,
            model=self._model,
            temperatura=self._temperatura,
        )

        # Some free models return the tool name as text instead of calling it —
        # detect and convert to an actual tool call so the result gets executed.
        if not tool_calls and response_text:
            tool_names = {t["name"] for t in tools}
            stripped = response_text.strip()
            if stripped in tool_names:
                tool_calls = [{"name": stripped, "input": {}}]
                response_text = ""

        actions: list[dict] = []

        if tool_calls:
            # Execute all tool calls
            tool_results = []
            for tc in tool_calls:
                tool_name = tc["name"]
                tool_input = tc.get("input", {})
                result = await execute_tool(tool_name, tool_input, context)

                success = "error" not in result
                actions.append({
                    "tool": tool_name,
                    "success": success,
                    "summary": result.get("mensaje", "") if success else result.get("error", ""),
                })
                tool_results.append({
                    "tool": tool_name,
                    "result": result,
                })

            # Second AI call: synthesize results into natural language
            tool_context = "\n".join(
                f"Herramienta '{r['tool']}': {json.dumps(r['result'], ensure_ascii=False, default=str)}"
                for r in tool_results
            )
            synthesis_messages = messages + [
                {
                    "role": "assistant",
                    "content": f"Ejecuté las siguientes herramientas y obtuve estos resultados:\n{tool_context}",
                },
                {
                    "role": "user",
                    "content": (
                        f"El usuario preguntó: \"{message}\"\n\n"
                        "Con base en los resultados anteriores, responde de forma clara, concisa y amigable en español. "
                        "Si los datos incluyen listas, preséntales con formato legible (usa viñetas o numeración). "
                        "No menciones nombres de herramientas técnicas ni JSON crudo."
                    ),
                },
            ]
            final_text, _ = await self._provider.chat_with_tools(
                messages=synthesis_messages,
                tools=[],
                model=self._model,
                temperatura=self._temperatura,
            )
            response_text = final_text or response_text or (
                "Obtuve los datos pero no pude generar una respuesta. Por favor intenta de nuevo."
            )

        return {
            "message": response_text,
            "actions": actions,
        }
