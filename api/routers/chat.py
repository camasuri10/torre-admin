from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class MensajeCreate(BaseModel):
    edificio_id: int
    remitente_id: int
    contenido: str
    tipo: str = "texto"   # texto | imagen | alerta


@router.get("/{edificio_id}")
def get_mensajes(edificio_id: int, limit: int = 50, offset: int = 0):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
                FROM chat_mensajes m
                JOIN usuarios u ON u.id = m.remitente_id
                WHERE m.edificio_id = %s
                ORDER BY m.created_at DESC
                LIMIT %s OFFSET %s
            """, (edificio_id, limit, offset))
            rows = cur.fetchall()
            # Return in chronological order
            return list(reversed(rows))


@router.post("", status_code=201)
def send_mensaje(data: MensajeCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO chat_mensajes (edificio_id, remitente_id, contenido, tipo)
                VALUES (%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.remitente_id, data.contenido, data.tipo))
            msg = cur.fetchone()
            # Fetch with sender info
            cur.execute("""
                SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
                FROM chat_mensajes m
                JOIN usuarios u ON u.id = m.remitente_id
                WHERE m.id = %s
            """, (msg["id"],))
            return cur.fetchone()


@router.patch("/{edificio_id}/marcar-leidos")
def marcar_leidos(edificio_id: int, usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE chat_mensajes SET leido = TRUE
                WHERE edificio_id = %s AND remitente_id != %s AND leido = FALSE
            """, (edificio_id, usuario_id))
            return {"updated": cur.rowcount}


@router.get("/{edificio_id}/no-leidos")
def count_no_leidos(edificio_id: int, usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as total FROM chat_mensajes
                WHERE edificio_id = %s AND remitente_id != %s AND leido = FALSE
            """, (edificio_id, usuario_id))
            return cur.fetchone()
