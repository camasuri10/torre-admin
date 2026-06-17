from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from db import get_db
from datetime import date, timedelta
import os, base64

router = APIRouter()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


class MantenimientoCreate(BaseModel):
    conjunto_id: int
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
    conjunto_id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    fecha_programada: str


class AtenderAlertaBody(BaseModel):
    nota: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


class ResolverAlertaBody(BaseModel):
    nota: str
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


class InventarioCreate(BaseModel):
    conjunto_id: int
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
           e.nombre as conjunto_nombre,
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
    JOIN conjuntos e ON e.id = m.conjunto_id
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
def list_inventario(conjunto_id: Optional[int] = None, tipo: Optional[str] = None, solo_activos: bool = True):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = "SELECT * FROM inventario_mantenimiento WHERE 1=1"
            params = []
            if conjunto_id:
                query += " AND conjunto_id = %s"
                params.append(conjunto_id)
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
                INSERT INTO inventario_mantenimiento (conjunto_id, nombre, tipo, descripcion)
                VALUES (%s,%s,%s,%s) RETURNING *
            """, (data.conjunto_id, data.nombre, data.tipo, data.descripcion))
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


# ── Alertas — MUST be before /{mantenimiento_id} ─────────────────────────────

@router.get("/alertas")
def list_alertas(conjunto_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if conjunto_id:
                try:
                    _sync_alertas_automaticas(cur, conjunto_id)
                except Exception:
                    pass
            query = """
                SELECT a.*,
                       e.nombre as conjunto_nombre,
                       m.titulo as mantenimiento_titulo,
                       inv.nombre as inventario_nombre
                FROM mantenimiento_alertas a
                JOIN conjuntos e ON e.id = a.conjunto_id
                LEFT JOIN mantenimientos m ON m.id = a.mantenimiento_id
                LEFT JOIN inventario_mantenimiento inv ON inv.id = m.inventario_id
                WHERE a.estado = 'pendiente'
            """
            params: list = []
            if conjunto_id:
                query += " AND a.conjunto_id = %s"
                params.append(conjunto_id)
            query += " ORDER BY a.auto_generada DESC, a.created_at DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/alertas", status_code=201)
def create_alerta(data: AlertaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mantenimiento_alertas
                    (conjunto_id, titulo, descripcion, tipo, tipo_alerta, fecha_programada, auto_generada)
                VALUES (%s,%s,%s,%s,'manual',%s,FALSE) RETURNING *
            """, (data.conjunto_id, data.titulo, data.descripcion, data.tipo, data.fecha_programada))
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


@router.patch("/alertas/{alerta_id}/atender")
def atender_alerta_early(alerta_id: int, body: AtenderAlertaBody):
    """Mark an automatic alert as attended."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimiento_alertas WHERE id = %s", (alerta_id,))
            alerta = cur.fetchone()
            if not alerta:
                raise HTTPException(404, "Alerta no encontrada")
            cur.execute("""
                UPDATE mantenimiento_alertas SET atendida = TRUE, fecha_atencion = NOW()
                WHERE id = %s RETURNING *
            """, (alerta_id,))
            row = cur.fetchone()
            if alerta.get("mantenimiento_id"):
                cur.execute("""
                    INSERT INTO mantenimiento_bitacora
                        (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                    VALUES (%s, 'alerta_atendida', %s, %s, %s)
                """, (
                    alerta["mantenimiento_id"],
                    f"Alerta '{alerta['titulo']}' marcada como atendida.{f' Nota: {body.nota}' if body.nota else ''}",
                    body.usuario_id, body.usuario_nombre,
                ))
            return row


@router.patch("/alertas/{alerta_id}/resolver")
def resolver_alerta_manual_early(alerta_id: int, body: ResolverAlertaBody):
    """Resolve a manual alert with a required note."""
    if not body.nota or not body.nota.strip():
        raise HTTPException(400, "La nota de resolución es obligatoria")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimiento_alertas WHERE id = %s", (alerta_id,))
            alerta = cur.fetchone()
            if not alerta:
                raise HTTPException(404, "Alerta no encontrada")
            if alerta.get("auto_generada"):
                raise HTTPException(400, "Las alertas automáticas se resuelven al resolver la ocurrencia")
            cur.execute("""
                UPDATE mantenimiento_alertas
                SET estado = 'completado', nota_resolucion = %s, resuelta_por = %s, fecha_atencion = NOW()
                WHERE id = %s RETURNING *
            """, (body.nota, body.usuario_id, alerta_id))
            row = cur.fetchone()
            if alerta.get("mantenimiento_id"):
                cur.execute("""
                    INSERT INTO mantenimiento_bitacora
                        (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                    VALUES (%s, 'alerta_resuelta', %s, %s, %s)
                """, (
                    alerta["mantenimiento_id"],
                    f"Alerta '{alerta['titulo']}' resuelta. Nota: {body.nota}",
                    body.usuario_id, body.usuario_nombre,
                ))
            return row


# ── Vencimientos — also before /{mantenimiento_id} ────────────────────────────

@router.get("/vencimientos")
def list_vencimientos(conjunto_id: Optional[int] = None, dias: int = 30):
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
            if conjunto_id:
                query += " AND m.conjunto_id = %s"
                params.append(conjunto_id)
            query += " ORDER BY m.fecha_vencimiento"
            cur.execute(query, params)
            return cur.fetchall()


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_mantenimientos(
    conjunto_id: Optional[int] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    es_programado: Optional[bool] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _MANTENIMIENTO_SELECT + " WHERE 1=1"
            params = []
            if conjunto_id:
                query += " AND m.conjunto_id = %s"
                params.append(conjunto_id)
            if estado:
                query += " AND m.estado = %s"
                params.append(estado)
            if prioridad:
                query += " AND m.prioridad = %s"
                params.append(prioridad)
            if es_programado is not None:
                query += " AND m.es_programado = %s"
                params.append(es_programado)
            if fecha_desde:
                query += " AND DATE(m.created_at) >= %s"
                params.append(fecha_desde)
            if fecha_hasta:
                query += " AND DATE(m.created_at) <= %s"
                params.append(fecha_hasta)
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
                    (conjunto_id, unidad_id, titulo, descripcion, categoria, prioridad,
                     solicitante_id, es_programado, periodicidad, proveedor_id,
                     contrato_url, contrato_id, inventario_id,
                     fecha_vencimiento, fecha_proxima_ejecucion, presupuesto, torre_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.conjunto_id, data.unidad_id, data.titulo, data.descripcion,
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
                        INSERT INTO mantenimiento_alertas (conjunto_id, titulo, tipo, fecha_programada)
                        SELECT %s, %s, 'preventivo', (%s::date - %s * INTERVAL '1 day')
                        WHERE (%s::date - %s * INTERVAL '1 day') > CURRENT_DATE
                    """, (
                        data.conjunto_id,
                        f"Próx. mantenimiento en {dias} días: {data.titulo}",
                        data.fecha_proxima_ejecucion, dias,
                        data.fecha_proxima_ejecucion, dias,
                    ))

            # Log creation in bitácora
            cur.execute("""
                INSERT INTO mantenimiento_bitacora (mantenimiento_id, evento, descripcion, estado_nuevo)
                VALUES (%s, 'creacion', %s, 'pendiente')
            """, (row["id"], f"Solicitud creada: {data.titulo}"))

            # Detect date conflict and include warning in response
            warning = None
            if (data.es_programado and data.fecha_vencimiento and data.fecha_proxima_ejecucion
                    and data.fecha_vencimiento < data.fecha_proxima_ejecucion):
                warning = "fecha_conflicto"

            result = dict(row)
            if warning:
                result["warning"] = warning
            return result


class MantenimientoUpdateWithUser(MantenimientoUpdate):
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


@router.patch("/{mantenimiento_id}")
def update_mantenimiento(mantenimiento_id: int, data: MantenimientoUpdateWithUser):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Capture current estado before update
            cur.execute("SELECT estado, fecha_vencimiento, fecha_proxima_ejecucion FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            current = cur.fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")
            estado_anterior = current["estado"]

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

            # Auto-create alerts if fecha_proxima_ejecucion was updated for trimestral/anual
            if (data.fecha_proxima_ejecucion and data.es_programado
                    and data.periodicidad in ("trimestral", "anual")):
                for dias in (30, 15):
                    cur.execute("""
                        INSERT INTO mantenimiento_alertas (conjunto_id, titulo, tipo, fecha_programada)
                        SELECT %s, %s, 'preventivo', (%s::date - %s * INTERVAL '1 day')
                        WHERE (%s::date - %s * INTERVAL '1 day') > CURRENT_DATE
                    """, (
                        row["conjunto_id"],
                        f"Próx. mantenimiento en {dias} días: {row['titulo']}",
                        data.fecha_proxima_ejecucion, dias,
                        data.fecha_proxima_ejecucion, dias,
                    ))

            # Log state change to bitácora
            if data.estado is not None and data.estado != estado_anterior:
                cur.execute("""
                    INSERT INTO mantenimiento_bitacora
                        (mantenimiento_id, evento, descripcion, estado_anterior, estado_nuevo, usuario_id, usuario_nombre)
                    VALUES (%s, 'cambio_estado', %s, %s, %s, %s, %s)
                """, (
                    mantenimiento_id,
                    f"Estado cambiado de {estado_anterior} a {data.estado}",
                    estado_anterior, data.estado,
                    data.usuario_id, data.usuario_nombre,
                ))

            # Detect date conflict
            fv = data.fecha_vencimiento or (str(current["fecha_vencimiento"]) if current["fecha_vencimiento"] else None)
            fpe = data.fecha_proxima_ejecucion or (str(current["fecha_proxima_ejecucion"]) if current["fecha_proxima_ejecucion"] else None)
            warning = None
            if fv and fpe and fv < fpe:
                warning = "fecha_conflicto"

            result = dict(row)
            if warning:
                result["warning"] = warning
            return result


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
                    (conjunto_id, unidad_id, torre_id, titulo, descripcion, categoria, prioridad,
                     solicitante_id, es_programado, periodicidad, proveedor_id,
                     contrato_url, contrato_id, inventario_id,
                     fecha_vencimiento, fecha_proxima_ejecucion, presupuesto)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                original["conjunto_id"], original["unidad_id"], original["torre_id"],
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


@router.get("/{mantenimiento_id}/bitacora")
def get_bitacora(mantenimiento_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM mantenimiento_bitacora
                WHERE mantenimiento_id = %s
                ORDER BY created_at DESC
            """, (mantenimiento_id,))
            return cur.fetchall()


class BitacoraEvento(BaseModel):
    evento: str
    descripcion: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


@router.post("/{mantenimiento_id}/bitacora", status_code=201)
def add_bitacora(mantenimiento_id: int, data: BitacoraEvento):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mantenimiento_bitacora
                    (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (mantenimiento_id, data.evento, data.descripcion, data.usuario_id, data.usuario_nombre))
            return cur.fetchone()


@router.post("/{mantenimiento_id}/crear-hijos", status_code=201)
def crear_hijos_recurrentes(mantenimiento_id: int):
    """Genera registros hijos en estado pendiente basados en la periodicidad del padre."""
    from datetime import date, timedelta

    periodos = {
        "diario": 1, "semanal": 7, "mensual": 30,
        "trimestral": 90, "semestral": 180, "anual": 365,
    }

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            padre = cur.fetchone()
            if not padre:
                raise HTTPException(status_code=404, detail="Mantenimiento no encontrado")
            if not padre["es_programado"] or not padre["periodicidad"]:
                raise HTTPException(status_code=400, detail="El mantenimiento no es programado o no tiene periodicidad")

            dias = periodos.get(padre["periodicidad"], 30)
            hoy = date.today()
            hijos_creados = []

            # Crear 3 instancias futuras
            for i in range(1, 4):
                fecha_hijo = hoy + timedelta(days=dias * i)
                cur.execute("""
                    INSERT INTO mantenimientos
                        (conjunto_id, unidad_id, torre_id, titulo, descripcion, categoria, prioridad,
                         solicitante_id, es_programado, periodicidad, proveedor_id,
                         contrato_url, contrato_id, inventario_id, presupuesto, padre_id,
                         fecha_proxima_ejecucion)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id, titulo, fecha_proxima_ejecucion
                """, (
                    padre["conjunto_id"], padre["unidad_id"], padre["torre_id"],
                    f"{padre['titulo']} (instancia {i})", padre["descripcion"],
                    padre["categoria"], padre["prioridad"], padre["solicitante_id"],
                    True, padre["periodicidad"], padre["proveedor_id"],
                    padre["contrato_url"], padre["contrato_id"], padre["inventario_id"],
                    padre["presupuesto"], mantenimiento_id,
                    str(fecha_hijo),
                ))
                hijo = cur.fetchone()
                hijos_creados.append(hijo)
                cur.execute("""
                    INSERT INTO mantenimiento_bitacora (mantenimiento_id, evento, descripcion, estado_nuevo)
                    VALUES (%s, 'hijo_creado', %s, 'pendiente')
                """, (hijo["id"], f"Instancia generada automáticamente desde mantenimiento #{mantenimiento_id}"))

            return {"creados": len(hijos_creados), "hijos": hijos_creados}


@router.post("/{mantenimiento_id}/archivos", status_code=201)
async def upload_archivo(
    mantenimiento_id: int,
    tipo: str = Form("otro"),
    nombre_archivo: str = Form(...),
    subido_por: Optional[int] = Form(None),
    file: UploadFile = File(...),
):
    """Upload a generic file. Stores as base64 data URL for POC."""
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
            row = cur.fetchone()
            # Log upload in bitácora
            cur.execute("""
                INSERT INTO mantenimiento_bitacora (mantenimiento_id, evento, descripcion, usuario_id)
                VALUES (%s, 'archivo_subido', %s, %s)
            """, (mantenimiento_id, f"Archivo subido: {nombre_archivo}", subido_por))
            return row


# ── Ciclo de vida de ocurrencias (Doc 2) ─────────────────────────────────────

_PERIODICIDAD_DIAS = {
    "diario": 1, "semanal": 7, "mensual": 30,
    "trimestral": 90, "semestral": 180, "anual": 365,
}


def _next_due_date(fecha_vencimiento: date | None, periodicidad: str) -> date:
    """Calculate next occurrence due date from current due date + periodicity."""
    base = fecha_vencimiento or date.today()
    dias = _PERIODICIDAD_DIAS.get(periodicidad, 30)
    return base + timedelta(days=dias)


def _create_next_occurrence(cur, padre: dict, usuario_id: Optional[int], usuario_nombre: Optional[str]):
    """Auto-generate the next recurring occurrence after resolving the current one."""
    if not padre.get("es_programado") or not padre.get("periodicidad"):
        return None
    if padre.get("ciclo_activo") is False or padre.get("ciclo_cerrado"):
        return None

    next_due = _next_due_date(padre.get("fecha_vencimiento"), padre["periodicidad"])
    num_occ = (padre.get("numero_ocurrencia") or 1) + 1

    cur.execute("""
        INSERT INTO mantenimientos
            (conjunto_id, unidad_id, torre_id, titulo, descripcion, categoria, prioridad,
             solicitante_id, es_programado, periodicidad, proveedor_id,
             contrato_id, inventario_id, presupuesto, padre_id,
             fecha_vencimiento, numero_ocurrencia, ciclo_activo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE)
        RETURNING id, titulo, fecha_vencimiento, numero_ocurrencia
    """, (
        padre["conjunto_id"], padre.get("unidad_id"), padre.get("torre_id"),
        padre["titulo"], padre.get("descripcion"),
        padre["categoria"], padre["prioridad"], padre.get("solicitante_id"),
        True, padre["periodicidad"], padre.get("proveedor_id"),
        padre.get("contrato_id"), padre.get("inventario_id"),
        padre.get("presupuesto"),
        padre["id"],
        str(next_due), num_occ,
    ))
    hijo = cur.fetchone()

    # Log in parent bitacora
    cur.execute("""
        INSERT INTO mantenimiento_bitacora
            (mantenimiento_id, evento, descripcion, estado_nuevo, usuario_id, usuario_nombre)
        VALUES (%s, 'hijo_creado', %s, 'pendiente', %s, %s)
    """, (
        padre["id"],
        f"Siguiente ocurrencia generada automáticamente: #{hijo['id']} (vence {next_due})",
        usuario_id, usuario_nombre,
    ))
    # Log in child bitacora
    cur.execute("""
        INSERT INTO mantenimiento_bitacora
            (mantenimiento_id, evento, descripcion, estado_nuevo, usuario_id, usuario_nombre)
        VALUES (%s, 'creacion', %s, 'pendiente', %s, %s)
    """, (
        hijo["id"],
        f"Ocurrencia #{num_occ} generada automáticamente desde #{padre['id']}",
        usuario_id, usuario_nombre,
    ))
    return hijo


class AvanzarMantenimientoBody(BaseModel):
    estado: str
    descripcion: str
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


@router.post("/{mantenimiento_id}/avanzar", status_code=200)
def avanzar_mantenimiento(mantenimiento_id: int, body: AvanzarMantenimientoBody):
    """Advance maintenance state with mandatory description. Auto-generates next occurrence on resolution."""
    ESTADOS_VALIDOS = ("pendiente", "en_proceso", "resuelto", "cancelado")
    if body.estado not in ESTADOS_VALIDOS:
        raise HTTPException(400, f"Estado inválido: {body.estado}")
    if not body.descripcion or not body.descripcion.strip():
        raise HTTPException(400, "La descripción es obligatoria")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            m = cur.fetchone()
            if not m:
                raise HTTPException(404, "Mantenimiento no encontrado")

            estado_anterior = m["estado"]

            # Update state
            extra = ""
            if body.estado == "resuelto":
                extra = ", fecha_resolucion = NOW()"
            cur.execute(
                f"UPDATE mantenimientos SET estado = %s{extra} WHERE id = %s",
                (body.estado, mantenimiento_id),
            )

            # Log state change in bitacora
            cur.execute("""
                INSERT INTO mantenimiento_bitacora
                    (mantenimiento_id, evento, descripcion, estado_anterior, estado_nuevo, usuario_id, usuario_nombre)
                VALUES (%s, 'cambio_estado', %s, %s, %s, %s, %s)
            """, (
                mantenimiento_id,
                body.descripcion,
                estado_anterior, body.estado,
                body.usuario_id, body.usuario_nombre,
            ))

            # Auto-generate next occurrence when resolved if programmed
            hijo = None
            if body.estado == "resuelto":
                hijo = _create_next_occurrence(cur, dict(m), body.usuario_id, body.usuario_nombre)

            return {
                "id": mantenimiento_id,
                "estado": body.estado,
                "siguiente_ocurrencia_id": hijo["id"] if hijo else None,
            }


@router.get("/{mantenimiento_id}/ocurrencias")
def list_ocurrencias(mantenimiento_id: int):
    """List all occurrences (chain) for a recurring maintenance."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Find the root (original) mantenimiento
            cur.execute("SELECT padre_id FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Mantenimiento no encontrado")
            raiz_id = row["padre_id"] or mantenimiento_id

            # List root + all children ordered by numero_ocurrencia
            cur.execute("""
                SELECT m.id, m.titulo, m.estado, m.fecha_vencimiento, m.fecha_resolucion,
                       m.numero_ocurrencia, m.padre_id,
                       asig.nombre as asignado_nombre
                FROM mantenimientos m
                LEFT JOIN usuarios asig ON asig.id = m.asignado_a
                WHERE m.id = %s OR m.padre_id = %s
                ORDER BY COALESCE(m.numero_ocurrencia, 1) ASC
            """, (raiz_id, raiz_id))
            return cur.fetchall()


class CicloDesactivarBody(BaseModel):
    motivo: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


class CicloReactivarBody(BaseModel):
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


class CicloCerrarBody(BaseModel):
    motivo: str
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None


@router.post("/{mantenimiento_id}/desactivar-ciclo")
def desactivar_ciclo(mantenimiento_id: int, body: CicloDesactivarBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            m = cur.fetchone()
            if not m:
                raise HTTPException(404, "Mantenimiento no encontrado")
            if not m["es_programado"]:
                raise HTTPException(400, "Este mantenimiento no es programado")
            if m.get("ciclo_cerrado"):
                raise HTTPException(400, "El ciclo ya está cerrado definitivamente")

            cur.execute("UPDATE mantenimientos SET ciclo_activo = FALSE WHERE id = %s", (mantenimiento_id,))
            desc = f"Ciclo desactivado.{f' Motivo: {body.motivo}' if body.motivo else ''}"
            cur.execute("""
                INSERT INTO mantenimiento_bitacora
                    (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                VALUES (%s, 'ciclo_desactivado', %s, %s, %s)
            """, (mantenimiento_id, desc, body.usuario_id, body.usuario_nombre))
            return {"ciclo_activo": False}


@router.post("/{mantenimiento_id}/reactivar-ciclo")
def reactivar_ciclo(mantenimiento_id: int, body: CicloReactivarBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            m = cur.fetchone()
            if not m:
                raise HTTPException(404, "Mantenimiento no encontrado")
            if not m["es_programado"]:
                raise HTTPException(400, "Este mantenimiento no es programado")
            if m.get("ciclo_cerrado"):
                raise HTTPException(400, "El ciclo está cerrado definitivamente y no puede reactivarse")

            cur.execute("UPDATE mantenimientos SET ciclo_activo = TRUE WHERE id = %s", (mantenimiento_id,))
            cur.execute("""
                INSERT INTO mantenimiento_bitacora
                    (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                VALUES (%s, 'ciclo_reactivado', 'Ciclo de mantenimiento reactivado.', %s, %s)
            """, (mantenimiento_id, body.usuario_id, body.usuario_nombre))

            # Generate next occurrence from today + periodicity
            m_updated = dict(m)
            m_updated["ciclo_activo"] = True
            m_updated["fecha_vencimiento"] = date.today()
            hijo = _create_next_occurrence(cur, m_updated, body.usuario_id, body.usuario_nombre)
            return {"ciclo_activo": True, "siguiente_ocurrencia_id": hijo["id"] if hijo else None}


@router.post("/{mantenimiento_id}/cerrar-definitivo")
def cerrar_ciclo_definitivo(mantenimiento_id: int, body: CicloCerrarBody):
    if not body.motivo or not body.motivo.strip():
        raise HTTPException(400, "El motivo de cierre es obligatorio")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM mantenimientos WHERE id = %s", (mantenimiento_id,))
            m = cur.fetchone()
            if not m:
                raise HTTPException(404, "Mantenimiento no encontrado")
            if m.get("ciclo_cerrado"):
                raise HTTPException(400, "El ciclo ya está cerrado")

            cur.execute("""
                UPDATE mantenimientos
                SET ciclo_cerrado = TRUE, ciclo_activo = FALSE,
                    motivo_cierre = %s, fecha_cierre_ciclo = NOW(),
                    cerrado_por = %s
                WHERE id = %s
            """, (body.motivo, body.usuario_id, mantenimiento_id))

            cur.execute("""
                INSERT INTO mantenimiento_bitacora
                    (mantenimiento_id, evento, descripcion, usuario_id, usuario_nombre)
                VALUES (%s, 'ciclo_cerrado', %s, %s, %s)
            """, (
                mantenimiento_id,
                f"Ciclo cerrado definitivamente. Motivo: {body.motivo}",
                body.usuario_id, body.usuario_nombre,
            ))
            return {"ciclo_cerrado": True, "motivo_cierre": body.motivo}


# ── Alertas preventivas automáticas (Doc 2) ───────────────────────────────────

def _sync_alertas_automaticas(cur, conjunto_id: int):
    """Check programmed maintenances and create/update automatic alerts."""
    hoy = date.today()

    # Get all active programmed maintenances
    cur.execute("""
        SELECT m.id, m.titulo, m.estado, m.fecha_vencimiento, m.presupuesto, m.costo,
               m.ciclo_activo, m.ciclo_cerrado, m.es_programado,
               inv.nombre as inventario_nombre
        FROM mantenimientos m
        LEFT JOIN inventario_mantenimiento inv ON inv.id = m.inventario_id
        WHERE m.conjunto_id = %s AND m.es_programado = TRUE
          AND (m.ciclo_cerrado IS NULL OR m.ciclo_cerrado = FALSE)
          AND m.estado NOT IN ('cancelado')
    """, (conjunto_id,))
    mantenimientos = cur.fetchall()

    for m in mantenimientos:
        mid = m["id"]
        # For each condition, upsert alert (check if active alert of same type exists)
        _upsert_alerta(cur, conjunto_id, mid, m, hoy)


def _upsert_alerta(cur, conjunto_id: int, mid: int, m: dict, hoy: date):
    """Create or resolve automatic alerts based on current state."""
    fv = m["fecha_vencimiento"]

    def get_active_alert(tipo_alerta: str):
        cur.execute("""
            SELECT id, atendida, estado FROM mantenimiento_alertas
            WHERE mantenimiento_id = %s AND tipo_alerta = %s AND estado = 'pendiente'
        """, (mid, tipo_alerta))
        return cur.fetchone()

    def create_alert(tipo_alerta: str, titulo: str, descripcion: str, prioridad: str):
        cur.execute("""
            INSERT INTO mantenimiento_alertas
                (conjunto_id, mantenimiento_id, titulo, descripcion, tipo_alerta,
                 prioridad_alerta, auto_generada, tipo, fecha_programada, estado)
            VALUES (%s,%s,%s,%s,%s,%s,TRUE,'preventivo',%s,'pendiente')
            ON CONFLICT DO NOTHING
        """, (conjunto_id, mid, titulo, descripcion, tipo_alerta, prioridad, str(hoy)))

    def resolve_auto_alert(tipo_alerta: str):
        cur.execute("""
            UPDATE mantenimiento_alertas
            SET estado = 'completado'
            WHERE mantenimiento_id = %s AND tipo_alerta = %s AND estado = 'pendiente' AND auto_generada = TRUE
        """, (mid, tipo_alerta))

    estado = m["estado"]
    titulo_base = m["titulo"]
    elemento = f" ({m['inventario_nombre']})" if m.get("inventario_nombre") else ""

    # ── Alerta: Vencida ──────────────────────────────────────────────────────
    if fv and fv < hoy and estado not in ("resuelto",):
        if not get_active_alert("vencida"):
            create_alert("vencida",
                f"🔴 Vencida: {titulo_base}",
                f"La ocurrencia{elemento} superó su fecha de vencimiento ({fv}) sin resolverse.",
                "alta")
    else:
        resolve_auto_alert("vencida")

    # ── Alerta: Próxima a vencer (≤ 7 días) ─────────────────────────────────
    if fv and date.today() <= fv <= hoy + timedelta(days=7) and estado not in ("resuelto",):
        dias = (fv - hoy).days
        if not get_active_alert("proxima_vencer"):
            create_alert("proxima_vencer",
                f"🟡 Próxima a vencer: {titulo_base}",
                f"La ocurrencia{elemento} vence en {dias} día(s) ({fv}).",
                "media")
    else:
        resolve_auto_alert("proxima_vencer")

    # ── Alerta: Sin ocurrencia activa ────────────────────────────────────────
    if m.get("ciclo_activo") is not False and estado in ("resuelto",):
        # Resolved but no new occurrence generated yet
        cur.execute("""
            SELECT id FROM mantenimientos
            WHERE padre_id = %s AND estado NOT IN ('resuelto','cancelado')
            LIMIT 1
        """, (mid,))
        tiene_ocurrencia_activa = cur.fetchone()
        if not tiene_ocurrencia_activa:
            if not get_active_alert("sin_ocurrencia"):
                create_alert("sin_ocurrencia",
                    f"🔵 Sin ocurrencia activa: {titulo_base}",
                    f"El mantenimiento programado{elemento} no tiene una ocurrencia activa pendiente.",
                    "media")
        else:
            resolve_auto_alert("sin_ocurrencia")

    # ── Alerta: Exceso de presupuesto ────────────────────────────────────────
    pres = m.get("presupuesto")
    costo = m.get("costo")
    if pres and costo and costo > pres:
        if not get_active_alert("exceso_presupuesto"):
            create_alert("exceso_presupuesto",
                f"🟠 Exceso de presupuesto: {titulo_base}",
                f"El costo real (${costo:,.0f}) supera el presupuesto (${pres:,.0f}){elemento}.",
                "alta")
    else:
        resolve_auto_alert("exceso_presupuesto")


