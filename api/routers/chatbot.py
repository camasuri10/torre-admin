import os
import time
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ConfigUpdate(BaseModel):
    proveedor: str
    api_key: Optional[str] = None
    modelo: Optional[str] = None
    base_url: Optional[str] = None
    temperatura: float = 0.3


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config() -> dict:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM chatbot_config WHERE id = 1")
            row = cur.fetchone()
            if row:
                return dict(row)
    return {"proveedor": "claude", "api_key": None, "modelo": None, "base_url": None, "temperatura": 0.3}


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede gestionar la configuración del chatbot")
    return current_user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/message")
async def chat_message(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    """Send a message to the AI assistant and get a response."""
    rol = current_user.get("rol", "propietario")
    allowed_roles = {"superadmin", "administrador", "propietario"}
    if rol not in allowed_roles:
        raise HTTPException(status_code=403, detail="Tu rol no tiene acceso al asistente IA.")

    config = _get_config()
    if not config.get("api_key") and config.get("proveedor") != "ollama":
        raise HTTPException(
            status_code=503,
            detail="El asistente IA no está configurado. Contacta al administrador.",
        )

    from chatbot_engine import ChatbotEngine

    engine = ChatbotEngine(config)

    # Determine API base URL for internal tool calls
    api_base = os.environ.get("INTERNAL_API_BASE") or os.environ.get("NEXT_PUBLIC_API_URL", "")
    raw_token = credentials.credentials if credentials else ""

    context = {
        "token": raw_token,
        "edificio_id": current_user.get("edificio_id"),
        "usuario_id": current_user.get("sub") or current_user.get("usuario_id"),
        "rol": rol,
        "api_base": api_base,
    }

    history = [{"role": m.role, "content": m.content} for m in body.history]

    try:
        result = await engine.process(
            message=body.message,
            history=history,
            context=context,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del asistente: {str(e)}")


@router.get("/config")
def get_config(sa=Depends(_require_superadmin)):
    """Get current chatbot configuration (api_key is masked)."""
    config = _get_config()
    # Mask the API key
    if config.get("api_key"):
        config["api_key"] = "***" + config["api_key"][-4:]
    return config


@router.put("/config")
def update_config(body: ConfigUpdate, sa=Depends(_require_superadmin)):
    """Create or update global chatbot configuration."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chatbot_config (id, proveedor, api_key, modelo, base_url, temperatura, updated_at)
                VALUES (1, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    proveedor   = EXCLUDED.proveedor,
                    api_key     = CASE WHEN EXCLUDED.api_key IS NOT NULL THEN EXCLUDED.api_key ELSE chatbot_config.api_key END,
                    modelo      = EXCLUDED.modelo,
                    base_url    = EXCLUDED.base_url,
                    temperatura = EXCLUDED.temperatura,
                    updated_at  = NOW()
                RETURNING *
            """, (body.proveedor, body.api_key, body.modelo, body.base_url, body.temperatura))
            return cur.fetchone()


@router.post("/test")
async def test_connection(sa=Depends(_require_superadmin)):
    """Test the current AI provider configuration."""
    config = _get_config()
    if not config.get("api_key") and config.get("proveedor") != "ollama":
        return {"ok": False, "message": "API key no configurada.", "latencia_ms": 0}

    from chatbot_engine import ChatbotEngine

    engine = ChatbotEngine(config)
    start = time.monotonic()
    try:
        result = await engine.process(
            message="Hola, ¿estás funcionando correctamente? Responde solo con 'Sí, estoy listo.'",
            history=[],
            context={
                "token": "",
                "edificio_id": 1,
                "usuario_id": 1,
                "rol": "superadmin",
                "api_base": "",
            },
        )
        latencia = int((time.monotonic() - start) * 1000)
        return {"ok": True, "message": result.get("message", ""), "latencia_ms": latencia}
    except Exception as e:
        latencia = int((time.monotonic() - start) * 1000)
        return {"ok": False, "message": str(e), "latencia_ms": latencia}


