from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from db import get_db
import os, base64

router = APIRouter()

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
    es_programado: bool = False
    periodicidad: Optional[str] = None      # diario|semanal|mensual|trimestral|anual
    proveedor_id: Optional[int] = None
    contrato_url: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    presupuesto: Optional[float] = None
    torre_id: Optional[int] = None


class MantenimientoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    prioridad: Optional[str] = None
    estado: Optional[str] = None
    asignado_a: Optional[int] = None
    costo: Optional[float] = None
    fecha_resolucion: Optional[str] = None
    es_programado: Optional[bool] = None
    periodicidad: Optional[str] = None
    proveedor_id: Optional[int] = None
    contrato_url: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    presupuesto: Optional[float] = None
    torre_id: Optional[int] = None


class AlertaCreate(BaseModel):
    edificio_id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    fecha_programada: str


_MANTENIMIENTO_SELECT = """
    SELECT m.*,
           e.nombre as edificio_nombre,
           u.numero as unidad_numero,
           sol.nombre as solicitante_nombre,
           asig.nombre as asignado_nombre,
           p.nombre as proveedor_nombre,
           t.nombre as torre_nombre, t.numero as numero_torre,
           (SELECT json_agg(json_build_object('id',a.id,'tipo',a.tipo,'url',a.url,'nombre',a.nombre_archivo))
            FROM mantenimiento_archivos a WHERE a.mantenimiento_id = m.id) as archivos
    FROM mantenimientos m
    JOIN edificios e ON e.id = m.edificio_id
    LEFT JOIN unidades u ON u.id = m.unidad_id
    LEFT JOIN usuarios sol ON sol.id = m.solicitante_id
    LEFT JOIN usuarios asig ON asig.id = m.asignado_a
    LEFT JOIN proveedores p ON p.id = m.proveedor_id
    LEFT JOIN torres t ON t.id = m.torre_id
"""


# ── Alertas — MUST be defined BEFORE /{mantenimiento_id} to avoid route conflict ──

@router.get("/alertas")
def list_alertas(edificio_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute(
                    "SELECT a.*, e.nombre as edificio_nombre FROM mantenimiento_alertas a "
                    "JOIN edificios e ON e.id = a.edificio_id WHERE a.edificio_id = %s ORDER BY a.fecha_programada",
                    (edificio_id,),
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
                (estado, alerta_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Alerta no encontrada")
            return row


# ── Vencimientos — also before /{mantenimiento_id} ────────────────────────────

@router.get("/vencimientos")
def list_vencimientos(edificio_id: Optional[int] = None, dias: int = 30):
    """Mantenimientos con fecha_vencimiento en los próximos N días."""
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _MANTENIMIENTO_SELECT + """
                WHERE m.fecha_vencimiento IS NOT NULL
                  AND m.fecha_vencimiento <= CURRENT_DATE + INTERVAL '%s days'
                  AND m.fecha_vencimiento >= CURRENT_DATE
                  AND m.estado NOT IN ('resuelto','cancelado')
            """
            params = [dias]
            if edificio_id:
                query += " AND m.edificio_id = %s"
                params.append(edificio_id)
            query += " ORDER BY m.fecha_vencimiento"
            cur.execute(query, params)
            return cur.fetchall()


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_mantenimientos(
    edificio_id: Optional[int] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    es_programado: Optional[bool] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _MANTENIMIENTO_SELECT + " WHERE 1=1"
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
            if es_programado is not None:
                query += " AND m.es_programado = %s"
                params.append(es_programado)
            query += " ORDER BY m.created_at DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.get("/{mantenimiento_id}")
def get_mantenimiento(mantenimiento_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(_MANTENIMIENTO_SELECT + " WHERE m.id = %s", (mantenimiento_id,))
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
                    (edificio_id, unidad_id, titulo, descripcion, categoria, prioridad,
                     solicitante_id, es_programado, periodicidad, proveedor_id,
                     contrato_url, fecha_vencimiento, presupuesto, torre_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.edificio_id, data.unidad_id, data.titulo, data.descripcion,
                data.categoria, data.prioridad, data.solicitante_id,
                data.es_programado, data.periodicidad, data.proveedor_id,
                data.contrato_url, data.fecha_vencimiento, data.presupuesto, data.torre_id,
            ))
            return cur.fetchone()


@router.patch("/{mantenimiento_id}")
def update_mantenimiento(mantenimiento_id: int, data: MantenimientoUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            if data.titulo is not None:
                fields.append("titulo = %s"); params.append(data.titulo)
            if data.descripcion is not None:
                fields.append("descripcion = %s"); params.append(data.descripcion)
            if data.categoria is not None:
                fields.append("categoria = %s"); params.append(data.categoria)
            if data.prioridad is not None:
                fields.append("prioridad = %s"); params.append(data.prioridad)
            if data.estado is not None:
                fields.append("estado = %s")
                params.append(data.estado)
                if data.estado == "resuelto":
                    fields.append("fecha_resolucion = NOW()")
            if data.asignado_a is not None:
                fields.append("asignado_a = %s"); params.append(data.asignado_a)
            if data.costo is not None:
                fields.append("costo = %s"); params.append(data.costo)
            if data.fecha_resolucion is not None:
                fields.append("fecha_resolucion = %s"); params.append(data.fecha_resolucion)
            if data.es_programado is not None:
                fields.append("es_programado = %s"); params.append(data.es_programado)
            if data.periodicidad is not None:
                fields.append("periodicidad = %s"); params.append(data.periodicidad)
            if data.proveedor_id is not None:
                fields.append("proveedor_id = %s"); params.append(data.proveedor_id)
            if data.contrato_url is not None:
                fields.append("contrato_url = %s"); params.append(data.contrato_url)
            if data.fecha_vencimiento is not None:
                fields.append("fecha_vencimiento = %s"); params.append(data.fecha_vencimiento)
            if data.presupuesto is not None:
                fields.append("presupuesto = %s"); params.append(data.presupuesto)
            if data.torre_id is not None:
                fields.append("torre_id = %s"); params.append(data.torre_id)

            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")
            params.append(mantenimiento_id)
            cur.execute(
                f"UPDATE mantenimientos SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params,
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
    """Upload photo or invoice. Stores as base64 data URL for POC."""
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
