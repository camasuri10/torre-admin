from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class ComunicadoCreate(BaseModel):
    edificio_id: Optional[int] = None   # None = todos los edificios
    titulo: str
    contenido: str
    tipo: str   # informativo | urgente | convocatoria | recordatorio
    autor_id: Optional[int] = None
    fecha: Optional[str] = None


@router.get("/")
def list_comunicados(edificio_id: Optional[int] = None, tipo: Optional[str] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT c.*, e.nombre as edificio_nombre, u.nombre as autor_nombre
                FROM comunicados c
                LEFT JOIN edificios e ON e.id = c.edificio_id
                LEFT JOIN usuarios u ON u.id = c.autor_id
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND (c.edificio_id = %s OR c.edificio_id IS NULL)"
                params.append(edificio_id)
            if tipo:
                query += " AND c.tipo = %s"
                params.append(tipo)
            query += " ORDER BY c.created_at DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.get("/{comunicado_id}")
def get_comunicado(comunicado_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*, e.nombre as edificio_nombre, u.nombre as autor_nombre
                FROM comunicados c
                LEFT JOIN edificios e ON e.id = c.edificio_id
                LEFT JOIN usuarios u ON u.id = c.autor_id
                WHERE c.id = %s
            """, (comunicado_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comunicado no encontrado")
            return row


@router.post("/", status_code=201)
def create_comunicado(data: ComunicadoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO comunicados (edificio_id, titulo, contenido, tipo, autor_id, fecha)
                VALUES (%s,%s,%s,%s,%s, COALESCE(%s, CURRENT_DATE)) RETURNING *
            """, (data.edificio_id, data.titulo, data.contenido, data.tipo, data.autor_id, data.fecha))
            return cur.fetchone()


@router.put("/{comunicado_id}")
def update_comunicado(comunicado_id: int, data: ComunicadoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE comunicados SET edificio_id=%s, titulo=%s, contenido=%s, tipo=%s, autor_id=%s
                WHERE id=%s RETURNING *
            """, (data.edificio_id, data.titulo, data.contenido, data.tipo, data.autor_id, comunicado_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comunicado no encontrado")
            return row


@router.delete("/{comunicado_id}", status_code=204)
def delete_comunicado(comunicado_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM comunicados WHERE id = %s", (comunicado_id,))
