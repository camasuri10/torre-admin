from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class MensajeCreate(BaseModel):
    conjunto_id: int
    remitente_id: int
    receptor_id: Optional[int] = None  # None = grupo, int = mensaje directo
    contenido: str
    tipo: str = "texto"   # texto | imagen | alerta


@router.get("/{conjunto_id}")
def get_mensajes(
    conjunto_id: int,
    limit: int = 100,
    offset: int = 0,
    usuario_a: Optional[int] = None,
    usuario_b: Optional[int] = None,
):
    """Mensajes de grupo (sin usuario_a/b) o DM entre dos usuarios."""
    with get_db() as conn:
        with conn.cursor() as cur:
            if usuario_a and usuario_b:
                cur.execute("""
                    SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
                    FROM chat_mensajes m
                    JOIN usuarios u ON u.id = m.remitente_id
                    WHERE m.conjunto_id = %s
                      AND (
                        (m.remitente_id = %s AND m.receptor_id = %s)
                        OR (m.remitente_id = %s AND m.receptor_id = %s)
                      )
                    ORDER BY m.created_at DESC
                    LIMIT %s OFFSET %s
                """, (conjunto_id, usuario_a, usuario_b, usuario_b, usuario_a, limit, offset))
            else:
                cur.execute("""
                    SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
                    FROM chat_mensajes m
                    JOIN usuarios u ON u.id = m.remitente_id
                    WHERE m.conjunto_id = %s AND m.receptor_id IS NULL
                    ORDER BY m.created_at DESC
                    LIMIT %s OFFSET %s
                """, (conjunto_id, limit, offset))
            return list(reversed(cur.fetchall()))


@router.post("", status_code=201)
def send_mensaje(data: MensajeCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chat_mensajes (conjunto_id, remitente_id, receptor_id, contenido, tipo)
                VALUES (%s,%s,%s,%s,%s) RETURNING id
            """, (data.conjunto_id, data.remitente_id, data.receptor_id, data.contenido, data.tipo))
            msg_id = cur.fetchone()["id"]
            cur.execute("""
                SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
                FROM chat_mensajes m
                JOIN usuarios u ON u.id = m.remitente_id
                WHERE m.id = %s
            """, (msg_id,))
            return cur.fetchone()


@router.get("/{conjunto_id}/conversaciones/{usuario_id}")
def list_conversaciones(conjunto_id: int, usuario_id: int):
    """Lista de usuarios con los que el usuario tiene DMs, con último mensaje y no-leídos."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH dm_pairs AS (
                    SELECT
                        CASE WHEN remitente_id = %s THEN receptor_id ELSE remitente_id END AS otro_id,
                        MAX(created_at) AS ultimo_at,
                        COUNT(*) FILTER (WHERE receptor_id = %s AND leido = FALSE) AS no_leidos,
                        (array_agg(contenido ORDER BY created_at DESC))[1] AS ultimo_mensaje
                    FROM chat_mensajes
                    WHERE conjunto_id = %s
                      AND receptor_id IS NOT NULL
                      AND (remitente_id = %s OR receptor_id = %s)
                    GROUP BY otro_id
                )
                SELECT dp.otro_id, u.nombre AS otro_nombre, u.rol AS otro_rol,
                       dp.ultimo_at, dp.no_leidos, dp.ultimo_mensaje
                FROM dm_pairs dp
                JOIN usuarios u ON u.id = dp.otro_id
                ORDER BY dp.ultimo_at DESC
            """, (usuario_id, usuario_id, conjunto_id, usuario_id, usuario_id))
            return cur.fetchall()


@router.patch("/{conjunto_id}/marcar-leidos")
def marcar_leidos(conjunto_id: int, usuario_id: int, otro_id: Optional[int] = None):
    """Marca como leídos: mensajes del grupo o DMs de otro_id hacia usuario_id."""
    with get_db() as conn:
        with conn.cursor() as cur:
            if otro_id is not None:
                cur.execute("""
                    UPDATE chat_mensajes SET leido = TRUE
                    WHERE conjunto_id = %s
                      AND remitente_id = %s AND receptor_id = %s AND leido = FALSE
                """, (conjunto_id, otro_id, usuario_id))
            else:
                cur.execute("""
                    UPDATE chat_mensajes SET leido = TRUE
                    WHERE conjunto_id = %s
                      AND receptor_id IS NULL AND remitente_id != %s AND leido = FALSE
                """, (conjunto_id, usuario_id))
            return {"updated": cur.rowcount}


@router.get("/{conjunto_id}/no-leidos")
def count_no_leidos(conjunto_id: int, usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE receptor_id IS NULL AND remitente_id != %s) AS grupo,
                    COUNT(*) FILTER (WHERE receptor_id = %s) AS dm
                FROM chat_mensajes
                WHERE conjunto_id = %s AND leido = FALSE
            """, (usuario_id, usuario_id, conjunto_id))
            row = cur.fetchone()
            return {"count": (row["grupo"] or 0) + (row["dm"] or 0), "grupo": row["grupo"] or 0, "dm": row["dm"] or 0}
