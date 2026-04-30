from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from db import get_db
import os, uuid, base64

router = APIRouter()

# Storage: use Supabase Storage bucket via REST or local base64 for POC
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


class MantenimientoCreate(BaseModel):
    edificio_id: int
    unidad_id: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    categoria: str
    prioridad: str = "media"
    solicitante_id: Optional[int] = None


class MantenimientoUpdate(BaseModel):
    estado: Optional[str] = None
    asignado_a: Optional[int] = None
    costo: Optional[float] = None
    fecha_resolucion: Optional[str] = None


class AlertaCreate(BaseModel):
    edificio_id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    fecha_programada: str


@router.get("")
def list_mantenimientos(
    edificio_id: Optional[int] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT m.*,
                       e.nombre as edificio_nombre,
                       u.numero as unidad_numero,
                       sol.nombre as solicitante_nombre,
                       asig.nombre as asignado_nombre,
                       (SELECT json_agg(json_build_object('id',a.id,'tipo',a.tipo,'url',a.url,'nombre',a.nombre_archivo))
                        FROM mantenimiento_archivos a WHERE a.mantenimiento_id = m.id) as archivos
                FROM mantenimientos m
                JOIN edificios e ON e.id = m.edificio_id
                LEFT JOIN unidades u ON u.id = m.unidad_id
                LEFT JOIN usuarios sol ON sol.id = m.solicitante_id
                LEFT JOIN usuarios asig ON asig.id = m.asignado_a
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND m.edificio_id = %s"
                params.append(edificio_id)
            if estado:
                query += " AND m.estado = %s"
                params.append(estado)
            if prioridad:
                query += " AND m.prioridad = %s"
                params.append(prioridad)
            query += " ORDER BY m.created_at DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.get("/{mantenimiento_id}")
def get_mantenimiento(mantenimiento_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT m.*, e.nombre as edificio_nombre, u.numero as unidad_numero,
                       sol.nombre as solicitante_nombre, asig.nombre as asignado_nombre,
                       (SELECT json_agg(json_build_object('id',a.id,'tipo',a.tipo,'url',a.url,'nombre',a.nombre_archivo))
                        FROM mantenimiento_archivos a WHERE a.mantenimiento_id = m.id) as archivos
                FROM mantenimientos m
                JOIN edificios e ON e.id = m.edificio_id
                LEFT JOIN unidades u ON u.id = m.unidad_id
                LEFT JOIN usuarios sol ON sol.id = m.solicitante_id
                LEFT JOIN usuarios asig ON asig.id = m.asignado_a
                WHERE m.id = %s
            """, (mantenimiento_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")
            return row


@router.post("", status_code=201)
def create_mantenimiento(data: MantenimientoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mantenimientos
                    (edificio_id, unidad_id, titulo, descripcion, categoria, prioridad, solicitante_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.unidad_id, data.titulo, data.descripcion,
                  data.categoria, data.prioridad, data.solicitante_id))
            return cur.fetchone()


@router.patch("/{mantenimiento_id}")
def update_mantenimiento(mantenimiento_id: int, data: MantenimientoUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            if data.estado is not None:
                fields.append("estado = %s")
                params.append(data.estado)
                if data.estado == "resuelto":
                    fields.append("fecha_resolucion = NOW()")
            if data.asignado_a is not None:
                fields.append("asignado_a = %s")
                params.append(data.asignado_a)
            if data.costo is not None:
                fields.append("costo = %s")
                params.append(data.costo)
            if data.fecha_resolucion is not None:
                fields.append("fecha_resolucion = %s")
                params.append(data.fecha_resolucion)
            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")
            params.append(mantenimiento_id)
            cur.execute(
                f"UPDATE mantenimientos SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")
            return row


@router.post("/{mantenimiento_id}/archivos", status_code=201)
async def upload_archivo(
    mantenimiento_id: int,
    tipo: str = Form(...),
    nombre_archivo: str = Form(...),
    subido_por: Optional[int] = Form(None),
    file: UploadFile = File(...),
):
    """Upload photo or invoice. Stores as base64 data URL for POC (use Supabase Storage in prod)."""
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    mime = file.content_type or "application/octet-stream"
    data_url = f"data:{mime};base64,{b64}"

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mantenimiento_archivos (mantenimiento_id, tipo, url, nombre_archivo, subido_por)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (mantenimiento_id, tipo, data_url, nombre_archivo, subido_por))
            return cur.fetchone()


# ── Alertas ──────────────────────────────────────────────────────────────────

@router.get("/alertas")
def list_alertas(edificio_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute(
                    "SELECT a.*, e.nombre as edificio_nombre FROM mantenimiento_alertas a "
                    "JOIN edificios e ON e.id = a.edificio_id WHERE a.edificio_id = %s ORDER BY a.fecha_programada",
                    (edificio_id,)
                )
            else:
                cur.execute(
                    "SELECT a.*, e.nombre as edificio_nombre FROM mantenimiento_alertas a "
                    "JOIN edificios e ON e.id = a.edificio_id ORDER BY a.fecha_programada"
                )
            return cur.fetchall()


@router.post("/alertas", status_code=201)
def create_alerta(data: AlertaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mantenimiento_alertas (edificio_id, titulo, descripcion, tipo, fecha_programada)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.titulo, data.descripcion, data.tipo, data.fecha_programada))
            return cur.fetchone()


@router.patch("/alertas/{alerta_id}")
def update_alerta(alerta_id: int, estado: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE mantenimiento_alertas SET estado = %s WHERE id = %s RETURNING *",
                (estado, alerta_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Alerta no encontrada")
            return row
