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
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ConfigCreate(BaseModel):
    nombre: str
    proveedor: str
    api_key: str
    modelo: Optional[str] = None
    base_url: Optional[str] = None
    temperatura: float = 0.3


class ConfigUpdate(BaseModel):
    nombre: Optional[str] = None
    proveedor: Optional[str] = None
    api_key: Optional[str] = None   # None = no cambiar
    modelo: Optional[str] = None
    base_url: Optional[str] = None
    temperatura: Optional[float] = None


class TestRequest(BaseModel):
    proveedor: Optional[str] = None
    api_key: Optional[str] = None
    modelo: Optional[str] = None
    base_url: Optional[str] = None
    temperatura: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config() -> dict:
    """Returns the active global BO config (organizacion_id IS NULL), or a safe default."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM chatbot_config WHERE activo = TRUE ORDER BY id DESC LIMIT 1"
            )
            row = cur.fetchone()
            if row:
                return dict(row)
    return {"proveedor": "claude", "api_key": None, "modelo": None, "base_url": None, "temperatura": 0.3}


def _mask_key(config: dict) -> dict:
    c = dict(config)
    if c.get("api_key"):
        c["api_key"] = "***" + c["api_key"][-4:]
    return c


def _require_backoffice(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "backoffice":
        raise HTTPException(status_code=403, detail="Solo el Backoffice puede gestionar la configuración del chatbot")
    return current_user


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@router.post("/message")
async def chat_message(
    request: Request,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    rol = current_user.get("rol", "propietario")
    if rol not in {"superadmin", "administrador", "propietario", "backoffice"}:
        raise HTTPException(status_code=403, detail="Tu rol no tiene acceso al asistente IA.")

    config = _get_config()
    if not config.get("api_key") and config.get("proveedor") != "ollama":
        raise HTTPException(
            status_code=503,
            detail="El asistente IA no está configurado. Contacta al equipo de soporte.",
        )

    from chatbot_engine import ChatbotEngine

    engine = ChatbotEngine(config)
    api_base = os.environ.get("INTERNAL_API_BASE") or str(request.base_url).rstrip("/")
    raw_token = credentials.credentials if credentials else ""

    context = {
        "token": raw_token,
        "conjunto_id": current_user.get("conjunto_id"),
        "usuario_id": current_user.get("sub") or current_user.get("usuario_id"),
        "rol": rol,
        "api_base": api_base,
    }

    history = [{"role": m.role, "content": m.content} for m in body.history]

    try:
        result = await engine.process(message=body.message, history=history, context=context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del asistente: {str(e)}")


# ── Active config (backward compat) ──────────────────────────────────────────

@router.get("/config")
def get_active_config(bo=Depends(_require_backoffice)):
    """Returns the currently active global config (api_key masked)."""
    return _mask_key(_get_config())


# ── Multi-config CRUD (Backoffice only) ───────────────────────────────────────

@router.get("/configs")
def list_configs(bo=Depends(_require_backoffice)):
    """List all saved global configurations."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM chatbot_config ORDER BY activo DESC, id ASC",
            )
            rows = cur.fetchall()
    return [_mask_key(dict(r)) for r in rows]


@router.post("/configs")
def create_config(body: ConfigCreate, bo=Depends(_require_backoffice)):
    """Create a new global configuration (inactive by default)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chatbot_config (nombre, proveedor, api_key, modelo, base_url, temperatura, activo, organizacion_id, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE, NULL, NOW())
                RETURNING *
            """, (body.nombre, body.proveedor, body.api_key, body.modelo, body.base_url, body.temperatura))
            return _mask_key(dict(cur.fetchone()))


@router.put("/configs/{config_id}")
def update_config(config_id: int, body: ConfigUpdate, bo=Depends(_require_backoffice)):
    """Update an existing configuration. Only provided fields are changed."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM chatbot_config WHERE id = %s", (config_id,))
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Configuración no encontrada")

            updates = {}
            if body.nombre is not None:
                updates["nombre"] = body.nombre
            if body.proveedor is not None:
                updates["proveedor"] = body.proveedor
            if body.api_key is not None:
                updates["api_key"] = body.api_key
            if body.modelo is not None:
                updates["modelo"] = body.modelo
            if body.base_url is not None:
                updates["base_url"] = body.base_url
            if body.temperatura is not None:
                updates["temperatura"] = body.temperatura

            if not updates:
                return _mask_key(dict(existing))

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            values = list(updates.values()) + [config_id]
            cur.execute(
                f"UPDATE chatbot_config SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *",
                values,
            )
            return _mask_key(dict(cur.fetchone()))


@router.delete("/configs/{config_id}")
def delete_config(config_id: int, bo=Depends(_require_backoffice)):
    """Delete a configuration. Cannot delete the active one."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT activo FROM chatbot_config WHERE id = %s", (config_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Configuración no encontrada")
            if row["activo"]:
                raise HTTPException(status_code=400, detail="No se puede eliminar la configuración activa. Activa otra primero.")
            cur.execute("DELETE FROM chatbot_config WHERE id = %s", (config_id,))
    return {"ok": True}


@router.post("/configs/{config_id}/activate")
def activate_config(config_id: int, bo=Depends(_require_backoffice)):
    """Set a configuration as the active one (deactivates all others)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM chatbot_config WHERE id = %s", (config_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Configuración no encontrada")
            cur.execute("UPDATE chatbot_config SET activo = FALSE")
            cur.execute(
                "UPDATE chatbot_config SET activo = TRUE, updated_at = NOW() WHERE id = %s RETURNING *",
                (config_id,),
            )
            return _mask_key(dict(cur.fetchone()))


# ── Test endpoint ─────────────────────────────────────────────────────────────

@router.post("/test")
async def test_connection(body: TestRequest = TestRequest(), bo=Depends(_require_backoffice)):
    """Test an AI provider configuration."""
    config = _get_config()
    if body.proveedor is not None:
        config["proveedor"] = body.proveedor
    if body.api_key is not None:
        config["api_key"] = body.api_key
    if body.modelo is not None:
        config["modelo"] = body.modelo
    if body.base_url is not None:
        config["base_url"] = body.base_url
    if body.temperatura is not None:
        config["temperatura"] = body.temperatura

    if not config.get("api_key") and config.get("proveedor") != "ollama":
        return {"ok": False, "message": "API key no configurada.", "latencia_ms": 0}

    from chatbot_engine import ChatbotEngine

    engine = ChatbotEngine(config)
    start = time.monotonic()
    try:
        result = await engine.process(
            message="Hola, ¿estás funcionando correctamente? Responde solo con 'Sí, estoy listo.'",
            history=[],
            context={"token": "", "conjunto_id": 1, "usuario_id": 1, "rol": "backoffice", "api_base": ""},
        )
        latencia = int((time.monotonic() - start) * 1000)
        return {"ok": True, "message": result.get("message", ""), "latencia_ms": latencia}
    except Exception as e:
        latencia = int((time.monotonic() - start) * 1000)
        return {"ok": False, "message": str(e), "latencia_ms": latencia}
