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
    contrato_id: Optional[int] = None
    inventario_id: Optional[int] = None
    fecha_vencimiento: Optional[str] = None
    fecha_proxima_ejecucion: Optional[str] = None
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
    contrato_id: Optional[int] = None
    inventario_id: Optional[int] = None
    fecha_vencimiento: Optional[str] = None
    fecha_proxima_ejecucion: Optional[str] = None
    presupuesto: Optional[float] = None
    torre_id: Optional[int] = None


class AlertaCreate(BaseModel):
    edificio_id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    fecha_programada: str


class InventarioCreate(BaseModel):
    edificio_id: int
    nombre: str
    tipo: str   # zona | componente
    descripcion: Optional[str] = None


class InventarioUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


_MANTENIMIENTO_SELECT = """
    SELECT m.*,
           e.nombre as edificio_nombre,
           u.numero as unidad_numero,
           sol.nombre as solicitante_nombre,
           asig.nombre as asignado_nombre,
           p.nombre as proveedor_nombre,
           t.nombre as torre_nombre, t.numero as numero_torre,
           inv.nombre as inventario_nombre, inv.tipo as inventario_tipo,
           cs.descripcion as contrato_descripcion, cs.archivo_url as contrato_archivo_url,
           (SELECT json_agg(json_build_object('id',a.id,'tipo',a.tipo,'url',a.url,'nombre',a.nombre_archivo))
            FROM mantenimiento_archivos a WHERE a.mantenimiento_id = m.id) as archivos
    FROM mantenimientos m
    JOIN edificios e ON e.id = m.edificio_id
    LEFT JOIN unidades u ON u.id = m.unidad_id
    LEFT JOIN usuarios sol ON sol.id = m.solicitante_id
    LEFT JOIN usuarios asig ON asig.id = m.asignado_a
    LEFT JOIN proveedores p ON p.id = m.proveedor_id
    LEFT JOIN torres t ON t.id = m.torre_id
    LEFT JOIN inventario_mantenimiento inv ON inv.id = m.inventario_id
    LEFT JOIN contratos_servicio cs ON cs.id = m.contrato_id
"""


# ── Inventario — MUST be before /{mantenimiento_id} ───────────────────────────

@router.get("/inventario")
def list_inventario(edificio_id: Optional[int] = None, tipo: Optional[str] = None, solo_activos: bool = True):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = "SELECT * FROM inventario_mantenimiento WHERE 1=1"
            params = []
            if edificio_id:
                query += " AND edificio_id = %s"
                params.append(edificio_id)
            if tipo:
                query += " AND tipo = %s"
                params.append(tipo)
            if solo_activos:
                query += " AND activo = TRUE"
            query += " ORDER BY tipo, nombre"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/inventario", status_code=201)
def create_inventario(data: InventarioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO inventario_mantenimiento (edificio_id, nombre, tipo, descripcion)
                VALUES (%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.nombre, data.tipo, data.descripcion))
            return cur.fetchone()


@router.patch("/inventario/{item_id}")
def update_inventario(item_id: int, data: InventarioUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            if data.nombre is not None:
                fields.append("nombre = %s"); params.append(data.nombre)
            if data.tipo is not None:
                fields.append("tipo = %s"); params.append(data.tipo)
            if data.descripcion is not None:
                fields.append("descripcion = %s"); params.append(data.descripcion)
            if data.activo is not None:
                fields.append("activo = %s"); params.append(data.activo)
            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")
            params.append(item_id)
            cur.execute(
                f"UPDATE inventario_mantenimiento SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Elemento no encontrado")
            return row


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
                     contrato_url, contrato_id, inventario_id,
                     fecha_vencimiento, fecha_proxima_ejecucion, presupuesto, torre_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.edificio_id, data.unidad_id, data.titulo, data.descripcion,
                data.categoria, data.prioridad, data.solicitante_id,
                data.es_programado, data.periodicidad, data.proveedor_id,
                data.contrato_url, data.contrato_id, data.inventario_id,
                data.fecha_vencimiento, data.fecha_proxima_ejecucion,
                data.presupuesto, data.torre_id,
            ))
            row = cur.fetchone()

            # Auto-create 30 and 15 day alerts for scheduled trimestral/anual
            if (data.es_programado and data.fecha_proxima_ejecucion
                    and data.periodicidad in ("trimestral", "anual")):
                for dias in (30, 15):
                    cur.execute("""
                        INSERT INTO mantenimiento_alertas (edificio_id, titulo, tipo, fecha_programada)
                        SELECT %s, %s, 'preventivo', (%s::date - %s * INTERVAL '1 day')
                        WHERE (%s::date - %s * INTERVAL '1 day') > CURRENT_DATE
                    """, (
                        data.edificio_id,
                        f"Próx. mantenimiento en {dias} días: {data.titulo}",
                        data.fecha_proxima_ejecucion, dias,
                        data.fecha_proxima_ejecucion, dias,
                    ))

            return row


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
            else:
                fields.append("proveedor_id = NULL")
            if data.contrato_url is not None:
                fields.append("contrato_url = %s"); params.append(data.contrato_url)
            else:
                fields.append("contrato_url = NULL")
            if data.contrato_id is not None:
                fields.append("contrato_id = %s"); params.append(data.contrato_id)
            else:
                fields.append("contrato_id = NULL")
            if data.inventario_id is not None:
                fields.append("inventario_id = %s"); params.append(data.inventario_id)
            else:
                fields.append("inventario_id = NULL")
            if data.fecha_vencimiento is not None:
                fields.append("fecha_vencimiento = %s"); params.append(data.fecha_vencimiento)
            else:
                fields.append("fecha_vencimiento = NULL")
            if data.fecha_proxima_ejecucion is not None:
                fields.append("fecha_proxima_ejecucion = %s"); params.append(data.fecha_proxima_ejecucion)
            else:
                fields.append("fecha_proxima_ejecucion = NULL")
            if data.presupuesto is not None:
                fields.append("presupuesto = %s"); params.append(data.presupuesto)

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

            # Auto-create alerts if fecha_proxima_ejecucion was updated for trimestral/anual
            if (data.fecha_proxima_ejecucion and data.es_programado
                    and data.periodicidad in ("trimestral", "anual")):
                for dias in (30, 15):
                    cur.execute("""
                        INSERT INTO mantenimiento_alertas (edificio_id, titulo, tipo, fecha_programada)
                        SELECT %s, %s, 'preventivo', (%s::date - %s * INTERVAL '1 day')
                        WHERE (%s::date - %s * INTERVAL '1 day') > CURRENT_DATE
                    """, (
                        row["edificio_id"],
                        f"Próx. mantenimiento en {dias} días: {row['titulo']}",
                        data.fecha_proxima_ejecucion, dias,
                        data.fecha_proxima_ejecucion, dias,
                    ))

            return row


@router.post("/{mantenimiento_id}/clonar", status_code=201)
def clonar_mantenimiento(mantenimiento_id: int):
    """Clone a maintenance request resetting estado to pendiente and clearing dates."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            original = cur.fetchone()
            if not original:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")

            cur.execute("""
                INSERT INTO mantenimientos
                    (edificio_id, unidad_id, torre_id, titulo, descripcion, categoria, prioridad,
                     solicitante_id, es_programado, periodicidad, proveedor_id,
                     contrato_url, contrato_id, inventario_id,
                     fecha_vencimiento, fecha_proxima_ejecucion, presupuesto)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                original["edificio_id"], original["unidad_id"], original["torre_id"],
                original["titulo"], original["descripcion"],
                original["categoria"], original["prioridad"],
                original["solicitante_id"],
                original["es_programado"], original["periodicidad"],
                original["proveedor_id"],
                original["contrato_url"], original["contrato_id"], original["inventario_id"],
                original["fecha_vencimiento"], original["fecha_proxima_ejecucion"],
                original["presupuesto"],
            ))
            return cur.fetchone()


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
