"""Procurement y Gestión — órdenes de compra, cotizaciones y flujos de aprobación."""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


def _safe(v):
    return float(v) if isinstance(v, Decimal) else v


def _safe_row(row: dict) -> dict:
    return {k: _safe(v) for k, v in row.items()}


def _require_procurement(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador", "backoffice"):
        raise HTTPException(status_code=403, detail="Sin acceso al módulo de procurement")
    return current_user


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin")
    return current_user


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _gen_numero_orden(cur, conjunto_id: int) -> str:
    yr = date.today().year
    cur.execute(
        "SELECT COUNT(*)+1 AS seq FROM ordenes_compra WHERE conjunto_id=%s AND EXTRACT(YEAR FROM created_at)=%s",
        (conjunto_id, yr),
    )
    seq = int(cur.fetchone()["seq"])
    return f"ORD-{conjunto_id}-{yr}-{seq:04d}"


def _needs_superadmin(monto: float, conjunto_id: int, cur) -> bool:
    cur.execute("""
        SELECT approver_rol FROM flujos_aprobacion
        WHERE conjunto_id=%s AND activo=TRUE
          AND monto_minimo <= %s AND (monto_maximo IS NULL OR monto_maximo >= %s)
        ORDER BY monto_minimo DESC LIMIT 1
    """, (conjunto_id, monto, monto))
    row = cur.fetchone()
    if row:
        return row["approver_rol"] == "superadmin"
    return monto >= 1_000_000


_ORDEN_SELECT = """
    SELECT o.*,
           p.nombre AS proveedor_nombre,
           e.nombre AS conjunto_nombre,
           u.nombre AS solicitante_nombre,
           pr.titulo AS proyecto_titulo
    FROM ordenes_compra o
    LEFT JOIN proveedores p ON p.id = o.proveedor_id
    JOIN conjuntos e ON e.id = o.conjunto_id
    LEFT JOIN usuarios u ON u.id = o.solicitante_id
    LEFT JOIN ordenes_compra pr ON pr.id = o.proyecto_id
"""


def _fetch_orden_detail(cur, orden_id: int) -> dict:
    cur.execute(_ORDEN_SELECT + " WHERE o.id = %s", (orden_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    orden = _safe_row(dict(row))

    cur.execute("SELECT * FROM orden_items WHERE orden_id = %s ORDER BY id", (orden_id,))
    orden["items"] = [_safe_row(dict(r)) for r in cur.fetchall()]

    cur.execute("""
        SELECT oa.*, u.nombre AS approver_nombre
        FROM orden_aprobaciones oa
        LEFT JOIN usuarios u ON u.id = oa.approver_id
        WHERE oa.orden_id = %s ORDER BY oa.created_at
    """, (orden_id,))
    orden["aprobaciones"] = [_safe_row(dict(r)) for r in cur.fetchall()]

    cur.execute("""
        SELECT c.*, p.nombre AS proveedor_nombre
        FROM cotizaciones c
        JOIN proveedores p ON p.id = c.proveedor_id
        WHERE c.orden_id = %s ORDER BY c.monto
    """, (orden_id,))
    orden["cotizaciones"] = [_safe_row(dict(r)) for r in cur.fetchall()]

    return orden


# ─── Pydantic models ──────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    descripcion: str
    cantidad: float = 1
    unidad_medida: str = "und"
    precio_unitario: float = 0


class EvidenciaIn(BaseModel):
    tipo: str  # foto | video | documento
    url: str
    descripcion: Optional[str] = None


class OrdenCreate(BaseModel):
    titulo: str
    tipo_orden: str
    clasificacion: Optional[str] = None  # proyecto | actividad (mantenimiento_* ya no aplica)
    proveedor_id: Optional[int] = None
    descripcion: Optional[str] = None
    justificacion: Optional[str] = None
    cantidad: Optional[float] = None
    monto_estimado: float = 0
    fecha_necesidad: Optional[str] = None
    conjunto_id: int
    items: list[ItemIn] = []
    evidencias: list[EvidenciaIn] = []
    requiere_cotizaciones: bool = False
    es_individual: bool = False
    requiere_aprobacion_consejo: bool = False
    proyecto_id: Optional[int] = None


class OrdenUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo_orden: Optional[str] = None
    clasificacion: Optional[str] = None
    proveedor_id: Optional[int] = None
    descripcion: Optional[str] = None
    justificacion: Optional[str] = None
    cantidad: Optional[float] = None
    monto_estimado: Optional[float] = None
    fecha_necesidad: Optional[str] = None
    items: Optional[list[ItemIn]] = None
    evidencias: Optional[list[EvidenciaIn]] = None
    requiere_cotizaciones: Optional[bool] = None
    es_individual: Optional[bool] = None
    requiere_aprobacion_consejo: Optional[bool] = None
    proyecto_id: Optional[int] = None


class ConsejoDecision(BaseModel):
    decision: str  # aprobada | rechazada
    comentario: Optional[str] = None


class EstadoAction(BaseModel):
    accion: str  # submit | aprobar | rechazar | iniciar | completar | cancelar | reabrir
    comentario: Optional[str] = None


class CotizacionCreate(BaseModel):
    solicitud_id: Optional[int] = None
    orden_id: Optional[int] = None
    proveedor_id: int
    numero_cotizacion: Optional[str] = None
    monto: float
    condiciones_pago: Optional[str] = None
    tiempo_entrega: Optional[str] = None
    vigencia: Optional[str] = None
    observaciones: Optional[str] = None


class SolicitudCreate(BaseModel):
    titulo: str
    tipo: str  # RFP | RFQ
    descripcion: Optional[str] = None
    fecha_limite: Optional[str] = None
    criterios_evaluacion: Optional[str] = None
    conjunto_id: int
    num_cotizaciones_requeridas: int = 1  # 1 o 3


class AsambleaToggle(BaseModel):
    requiere: bool

class CotizacionesToggle(BaseModel):
    requiere: bool

class CotizacionDirecta(BaseModel):
    proveedor_id: int
    numero_cotizacion: Optional[str] = None
    monto: float
    condiciones_pago: Optional[str] = None
    tiempo_entrega: Optional[str] = None
    vigencia: Optional[str] = None
    observaciones: Optional[str] = None


class AsambleaDecision(BaseModel):
    decision: str  # aprobada | rechazada
    acta_url: Optional[str] = None
    cotizacion_url: Optional[str] = None
    comentario: Optional[str] = None


class FlujoCreate(BaseModel):
    nombre: str
    tipo_orden: Optional[str] = None
    monto_minimo: float = 0
    monto_maximo: Optional[float] = None
    approver_rol: str  # administrador | superadmin
    conjunto_id: int


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(conjunto_id: int, _: dict = Depends(_require_procurement)):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) FILTER (WHERE estado = 'borrador')              AS borradores,
                        COUNT(*) FILTER (WHERE estado = 'pendiente_aprobacion')  AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'aprobada')              AS aprobadas,
                        COUNT(*) FILTER (WHERE estado = 'en_ejecucion')          AS en_ejecucion,
                        COUNT(*) FILTER (WHERE estado = 'completada')            AS completadas,
                        COALESCE(SUM(monto_estimado) FILTER (
                            WHERE estado NOT IN ('cancelada','rechazada')
                            AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
                        ), 0) AS gasto_mes
                    FROM ordenes_compra WHERE conjunto_id = %s
                """, (conjunto_id,))
                row = dict(cur.fetchone())

                cur.execute(
                    "SELECT COUNT(*) FROM solicitudes_cotizacion WHERE conjunto_id=%s AND estado='abierta'",
                    (conjunto_id,),
                )
                row["solicitudes_abiertas"] = int(cur.fetchone()["count"])

                return {k: _safe(v) for k, v in row.items()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"stats error: {e}")


# ─── Órdenes ─────────────────────────────────────────────────────────────────

@router.get("/ordenes")
def list_ordenes(
    conjunto_id: Optional[int] = None,
    estado: Optional[str] = None,
    tipo_orden: Optional[str] = None,
    proveedor_id: Optional[int] = None,
    current_user: dict = Depends(_require_procurement),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _ORDEN_SELECT + " WHERE 1=1"
            params: list = []
            if conjunto_id:
                query += " AND o.conjunto_id = %s"; params.append(conjunto_id)
            if estado:
                query += " AND o.estado = %s"; params.append(estado)
            if tipo_orden:
                query += " AND o.tipo_orden = %s"; params.append(tipo_orden)
            if proveedor_id:
                query += " AND o.proveedor_id = %s"; params.append(proveedor_id)
            query += " ORDER BY o.created_at DESC"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.get("/aprobaciones/pendientes")
def get_pendientes(current_user: dict = Depends(_require_procurement)):
    rol = current_user.get("rol")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.*, p.nombre AS proveedor_nombre, e.nombre AS conjunto_nombre,
                       u.nombre AS solicitante_nombre
                FROM ordenes_compra o
                JOIN orden_aprobaciones oa ON oa.orden_id = o.id AND oa.estado = 'pendiente'
                LEFT JOIN proveedores p ON p.id = o.proveedor_id
                JOIN conjuntos e ON e.id = o.conjunto_id
                LEFT JOIN usuarios u ON u.id = o.solicitante_id
                WHERE o.estado = 'pendiente_aprobacion' AND oa.approver_rol = %s
                ORDER BY o.created_at
            """, (rol,))
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.get("/ordenes/{orden_id}")
def get_orden(orden_id: int, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            return _fetch_orden_detail(cur, orden_id)


@router.post("/ordenes", status_code=201)
def create_orden(data: OrdenCreate, current_user: dict = Depends(_require_procurement)):
    solicitante_id = int(current_user.get("sub"))
    with get_db() as conn:
        with conn.cursor() as cur:
            numero = _gen_numero_orden(cur, data.conjunto_id)
            import json
            evidencias_json = json.dumps([e.model_dump() for e in data.evidencias]) if data.evidencias else "[]"
            cur.execute("""
                INSERT INTO ordenes_compra
                    (numero_orden, titulo, tipo_orden, clasificacion, proveedor_id,
                     descripcion, justificacion, cantidad, monto_estimado,
                     fecha_necesidad, conjunto_id, solicitante_id, evidencias,
                     requiere_cotizaciones, es_individual, requiere_aprobacion_consejo, proyecto_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s) RETURNING id
            """, (
                numero, data.titulo, data.tipo_orden, data.clasificacion, data.proveedor_id,
                data.descripcion, data.justificacion, data.cantidad, data.monto_estimado,
                data.fecha_necesidad, data.conjunto_id, solicitante_id, evidencias_json,
                data.requiere_cotizaciones, data.es_individual, data.requiere_aprobacion_consejo,
                data.proyecto_id,
            ))
            orden_id = cur.fetchone()["id"]

            for item in data.items:
                cur.execute("""
                    INSERT INTO orden_items (orden_id, descripcion, cantidad, unidad_medida, precio_unitario)
                    VALUES (%s,%s,%s,%s,%s)
                """, (orden_id, item.descripcion, item.cantidad, item.unidad_medida, item.precio_unitario))

            return _fetch_orden_detail(cur, orden_id)


@router.put("/ordenes/{orden_id}")
def update_orden(orden_id: int, data: OrdenUpdate, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT estado FROM ordenes_compra WHERE id=%s", (orden_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            if row["estado"] not in ("borrador", "rechazada"):
                raise HTTPException(status_code=400, detail="Solo se pueden editar órdenes en borrador o rechazadas")

            import json
            fields, values = [], []
            if data.titulo is not None:
                fields.append("titulo=%s"); values.append(data.titulo)
            if data.tipo_orden is not None:
                fields.append("tipo_orden=%s"); values.append(data.tipo_orden)
            if data.clasificacion is not None:
                fields.append("clasificacion=%s"); values.append(data.clasificacion)
            if data.proveedor_id is not None:
                fields.append("proveedor_id=%s"); values.append(data.proveedor_id)
            if data.descripcion is not None:
                fields.append("descripcion=%s"); values.append(data.descripcion)
            if data.justificacion is not None:
                fields.append("justificacion=%s"); values.append(data.justificacion)
            if data.cantidad is not None:
                fields.append("cantidad=%s"); values.append(data.cantidad)
            if data.monto_estimado is not None:
                fields.append("monto_estimado=%s"); values.append(data.monto_estimado)
            if data.fecha_necesidad is not None:
                fields.append("fecha_necesidad=%s"); values.append(data.fecha_necesidad)
            if data.evidencias is not None:
                fields.append("evidencias=%s::jsonb")
                values.append(json.dumps([e.model_dump() for e in data.evidencias]))
            if data.requiere_cotizaciones is not None:
                fields.append("requiere_cotizaciones=%s"); values.append(data.requiere_cotizaciones)
            if data.es_individual is not None:
                fields.append("es_individual=%s"); values.append(data.es_individual)
            if data.requiere_aprobacion_consejo is not None:
                fields.append("requiere_aprobacion_consejo=%s"); values.append(data.requiere_aprobacion_consejo)
            if data.proyecto_id is not None:
                fields.append("proyecto_id=%s"); values.append(data.proyecto_id)

            if fields:
                fields.append("updated_at=NOW()")
                values.append(orden_id)
                cur.execute(
                    f"UPDATE ordenes_compra SET {', '.join(fields)} WHERE id=%s",
                    values,
                )

            if data.items is not None:
                cur.execute("DELETE FROM orden_items WHERE orden_id=%s", (orden_id,))
                for item in data.items:
                    cur.execute("""
                        INSERT INTO orden_items (orden_id, descripcion, cantidad, unidad_medida, precio_unitario)
                        VALUES (%s,%s,%s,%s,%s)
                    """, (orden_id, item.descripcion, item.cantidad, item.unidad_medida, item.precio_unitario))

            return _fetch_orden_detail(cur, orden_id)


@router.patch("/ordenes/{orden_id}/estado")
def cambiar_estado(orden_id: int, data: EstadoAction, current_user: dict = Depends(_require_procurement)):
    rol = current_user.get("rol")
    uid = int(current_user.get("sub"))

    TRANSITIONS = {
        "submit":    ("borrador",              "pendiente_aprobacion"),
        "aprobar":   ("pendiente_aprobacion",  "aprobada"),
        "rechazar":  ("pendiente_aprobacion",  "rechazada"),
        "iniciar":   ("aprobada",              "en_ejecucion"),
        "completar": ("en_ejecucion",          "completada"),
        "cancelar":  (None,                    "cancelada"),
        "reabrir":   ("rechazada",             "borrador"),
    }

    if data.accion not in TRANSITIONS:
        raise HTTPException(status_code=400, detail=f"Acción inválida: {data.accion}")

    expected_from, new_estado = TRANSITIONS[data.accion]

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM ordenes_compra WHERE id=%s", (orden_id,))
            orden = cur.fetchone()
            if not orden:
                raise HTTPException(status_code=404, detail="Orden no encontrada")

            if data.accion == "cancelar":
                if orden["estado"] in ("completada", "cancelada"):
                    raise HTTPException(status_code=400, detail="No se puede cancelar una orden completada o ya cancelada")
                if not data.comentario:
                    raise HTTPException(status_code=400, detail="Se requiere motivo de cancelación")
                cur.execute(
                    "UPDATE ordenes_compra SET estado='cancelada', motivo_cancelacion=%s, updated_at=NOW() WHERE id=%s",
                    (data.comentario, orden_id),
                )
                return _fetch_orden_detail(cur, orden_id)

            if orden["estado"] != expected_from:
                raise HTTPException(
                    status_code=400,
                    detail=f"Estado actual '{orden['estado']}' no permite la acción '{data.accion}'"
                )

            # Registrar la acción en aprobaciones para trazabilidad
            if data.accion in ("aprobar", "rechazar"):
                ap_estado = "aprobada" if data.accion == "aprobar" else "rechazada"
                cur.execute("""
                    INSERT INTO orden_aprobaciones
                        (orden_id, approver_id, approver_rol, nivel, estado, fecha_decision, comentario)
                    VALUES (%s,%s,%s,1,%s,NOW(),%s)
                """, (orden_id, uid, rol, ap_estado, data.comentario))

            cur.execute(
                "UPDATE ordenes_compra SET estado=%s, updated_at=NOW() WHERE id=%s",
                (new_estado, orden_id),
            )
            return _fetch_orden_detail(cur, orden_id)


@router.post("/ordenes/{orden_id}/items", status_code=201)
def add_item(orden_id: int, data: ItemIn, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM ordenes_compra WHERE id=%s", (orden_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            cur.execute("""
                INSERT INTO orden_items (orden_id, descripcion, cantidad, unidad_medida, precio_unitario)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (orden_id, data.descripcion, data.cantidad, data.unidad_medida, data.precio_unitario))
            return _safe_row(dict(cur.fetchone()))


@router.delete("/ordenes/{orden_id}/items/{item_id}", status_code=204)
def remove_item(orden_id: int, item_id: int, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM orden_items WHERE id=%s AND orden_id=%s", (item_id, orden_id))


# ─── Cotizaciones ─────────────────────────────────────────────────────────────

@router.get("/cotizaciones")
def list_cotizaciones(
    solicitud_id: Optional[int] = None,
    orden_id: Optional[int] = None,
    conjunto_id: Optional[int] = None,
    _: dict = Depends(_require_procurement),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT c.*, p.nombre AS proveedor_nombre,
                       s.titulo AS solicitud_titulo
                FROM cotizaciones c
                JOIN proveedores p ON p.id = c.proveedor_id
                LEFT JOIN solicitudes_cotizacion s ON s.id = c.solicitud_id
                WHERE 1=1
            """
            params: list = []
            if solicitud_id:
                query += " AND c.solicitud_id=%s"; params.append(solicitud_id)
            if orden_id:
                query += " AND c.orden_id=%s"; params.append(orden_id)
            if conjunto_id:
                query += " AND (s.conjunto_id=%s OR s.conjunto_id IS NULL)"; params.append(conjunto_id)
            query += " ORDER BY c.monto"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/cotizaciones", status_code=201)
def create_cotizacion(data: CotizacionCreate, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO cotizaciones
                    (solicitud_id, orden_id, proveedor_id, numero_cotizacion,
                     monto, condiciones_pago, tiempo_entrega, vigencia, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.solicitud_id, data.orden_id, data.proveedor_id, data.numero_cotizacion,
                data.monto, data.condiciones_pago, data.tiempo_entrega, data.vigencia, data.observaciones,
            ))
            return _safe_row(dict(cur.fetchone()))


@router.patch("/cotizaciones/{cotizacion_id}/ganadora")
def marcar_ganadora(cotizacion_id: int, current_user: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM cotizaciones WHERE id=%s", (cotizacion_id,))
            cot = cur.fetchone()
            if not cot:
                raise HTTPException(status_code=404, detail="Cotización no encontrada")

            # Marcar otras como perdedoras en la misma solicitud
            if cot["solicitud_id"]:
                cur.execute(
                    "UPDATE cotizaciones SET estado='perdedora' WHERE solicitud_id=%s AND id <> %s",
                    (cot["solicitud_id"], cotizacion_id),
                )
            cur.execute("UPDATE cotizaciones SET estado='ganadora' WHERE id=%s", (cotizacion_id,))

            # Crear borrador de orden a partir de la cotización ganadora
            if cot["solicitud_id"]:
                cur.execute("SELECT * FROM solicitudes_cotizacion WHERE id=%s", (cot["solicitud_id"],))
                sol = cur.fetchone()
                if sol:
                    uid = int(current_user.get("sub"))
                    numero = _gen_numero_orden(cur, sol["conjunto_id"])
                    cur.execute("""
                        INSERT INTO ordenes_compra
                            (numero_orden, titulo, tipo_orden, proveedor_id, descripcion,
                             monto_estimado, conjunto_id, solicitante_id)
                        VALUES (%s,%s,'compra_bienes',%s,%s,%s,%s,%s) RETURNING id
                    """, (
                        numero,
                        f"Orden de: {sol['titulo']}",
                        cot["proveedor_id"],
                        sol["descripcion"],
                        float(cot["monto"]),
                        sol["conjunto_id"],
                        uid,
                    ))
                    new_orden_id = cur.fetchone()["id"]
                    cur.execute(
                        "UPDATE cotizaciones SET orden_id=%s WHERE id=%s",
                        (new_orden_id, cotizacion_id),
                    )

            cur.execute("SELECT * FROM cotizaciones WHERE id=%s", (cotizacion_id,))
            return _safe_row(dict(cur.fetchone()))


# ─── Solicitudes de cotización ────────────────────────────────────────────────

@router.get("/solicitudes")
def list_solicitudes(conjunto_id: Optional[int] = None, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT s.*,
                       u.nombre AS created_by_nombre,
                       (SELECT COUNT(*) FROM cotizaciones c WHERE c.solicitud_id=s.id) AS total_cotizaciones
                FROM solicitudes_cotizacion s
                LEFT JOIN usuarios u ON u.id = s.created_by
                WHERE 1=1
            """
            params: list = []
            if conjunto_id:
                query += " AND s.conjunto_id=%s"; params.append(conjunto_id)
            query += " ORDER BY s.created_at DESC"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/solicitudes", status_code=201)
def create_solicitud(data: SolicitudCreate, current_user: dict = Depends(_require_procurement)):
    uid = int(current_user.get("sub"))
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO solicitudes_cotizacion
                    (titulo, tipo, descripcion, fecha_limite, criterios_evaluacion,
                     conjunto_id, created_by, num_cotizaciones_requeridas)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.titulo, data.tipo, data.descripcion, data.fecha_limite,
                data.criterios_evaluacion, data.conjunto_id, uid,
                data.num_cotizaciones_requeridas,
            ))
            return dict(cur.fetchone())


@router.patch("/solicitudes/{solicitud_id}/cerrar")
def cerrar_solicitud(solicitud_id: int, _: dict = Depends(_require_procurement)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE solicitudes_cotizacion SET estado='cerrada' WHERE id=%s RETURNING id, estado",
                (solicitud_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Solicitud no encontrada")
            return dict(row)


# ─── Flujos de aprobación ─────────────────────────────────────────────────────

@router.get("/flujos")
def list_flujos(conjunto_id: Optional[int] = None, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = "SELECT f.*, u.nombre AS approver_nombre FROM flujos_aprobacion f LEFT JOIN usuarios u ON u.id=f.approver_id WHERE 1=1"
            params: list = []
            if conjunto_id:
                query += " AND f.conjunto_id=%s"; params.append(conjunto_id)
            query += " ORDER BY f.monto_minimo"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/flujos", status_code=201)
def create_flujo(data: FlujoCreate, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO flujos_aprobacion
                    (nombre, tipo_orden, monto_minimo, monto_maximo, approver_rol, conjunto_id)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.nombre, data.tipo_orden, data.monto_minimo, data.monto_maximo, data.approver_rol, data.conjunto_id))
            return _safe_row(dict(cur.fetchone()))


@router.delete("/flujos/{flujo_id}", status_code=204)
def delete_flujo(flujo_id: int, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM flujos_aprobacion WHERE id=%s", (flujo_id,))


# ─── Asamblea ─────────────────────────────────────────────────────────────────

@router.patch("/ordenes/{orden_id}/asamblea")
def toggle_asamblea(
    orden_id: int, data: AsambleaToggle, current_user: dict = Depends(_require_procurement)
):
    """Activa o desactiva el requerimiento de aprobación de asamblea en una orden."""
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden activar asamblea")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM ordenes_compra WHERE id=%s", (orden_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Orden no encontrada")

            if data.requiere:
                cur.execute("""
                    UPDATE ordenes_compra
                    SET requiere_asamblea=TRUE, asamblea_estado='pendiente', updated_at=NOW()
                    WHERE id=%s
                """, (orden_id,))
            else:
                cur.execute("""
                    UPDATE ordenes_compra
                    SET requiere_asamblea=FALSE, asamblea_estado=NULL,
                        asamblea_acta_url=NULL, asamblea_cotizacion_url=NULL,
                        asamblea_fecha=NULL, asamblea_comentario=NULL, updated_at=NOW()
                    WHERE id=%s
                """, (orden_id,))
            return _fetch_orden_detail(cur, orden_id)


@router.patch("/ordenes/{orden_id}/asamblea/decision")
def decidir_asamblea(
    orden_id: int, data: AsambleaDecision, current_user: dict = Depends(_require_procurement)
):
    """Registra la decisión de la asamblea (aprobada/rechazada) con documentos adjuntos."""
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden registrar decisión de asamblea")
    if data.decision not in ("aprobada", "rechazada"):
        raise HTTPException(status_code=400, detail="decision debe ser 'aprobada' o 'rechazada'")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, requiere_asamblea FROM ordenes_compra WHERE id=%s", (orden_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            if not row["requiere_asamblea"]:
                raise HTTPException(status_code=400, detail="Esta orden no tiene asamblea activada")

            cur.execute("""
                UPDATE ordenes_compra
                SET asamblea_estado=%s,
                    asamblea_acta_url=%s,
                    asamblea_cotizacion_url=%s,
                    asamblea_fecha=NOW(),
                    asamblea_comentario=%s,
                    updated_at=NOW()
                WHERE id=%s
            """, (
                data.decision, data.acta_url, data.cotizacion_url,
                data.comentario, orden_id,
            ))
            return _fetch_orden_detail(cur, orden_id)


@router.get("/asamblea")
def list_asamblea(
    conjunto_id: Optional[int] = None, current_user: dict = Depends(_require_procurement)
):
    """Lista todas las órdenes que requieren o han pasado por aprobación de asamblea."""
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _ORDEN_SELECT + " WHERE o.requiere_asamblea = TRUE"
            params: list = []
            if conjunto_id:
                query += " AND o.conjunto_id = %s"
                params.append(conjunto_id)
            query += " ORDER BY o.created_at DESC"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


# ─── Kanban ───────────────────────────────────────────────────────────────────

@router.get("/kanban")
def get_kanban(conjunto_id: Optional[int] = None, _: dict = Depends(_require_procurement)):
    """Retorna órdenes clasificadas como 'proyecto' o 'actividad' agrupadas por estado para el tablero."""
    COLUMNAS = [
        "borrador",
        "pendiente_aprobacion",
        "aprobada",
        "en_ejecucion",
        "completada",
        "cancelada",
    ]
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT o.id, o.numero_orden, o.titulo, o.estado, o.clasificacion,
                       o.monto_estimado, o.fecha_necesidad, o.created_at,
                       o.requiere_asamblea, o.asamblea_estado,
                       p.nombre AS proveedor_nombre,
                       e.nombre AS conjunto_nombre
                FROM ordenes_compra o
                LEFT JOIN proveedores p ON p.id = o.proveedor_id
                JOIN conjuntos e ON e.id = o.conjunto_id
                WHERE o.clasificacion IN ('proyecto', 'actividad')
            """
            params: list = []
            if conjunto_id:
                query += " AND o.conjunto_id = %s"
                params.append(conjunto_id)
            query += " ORDER BY o.created_at DESC"
            cur.execute(query, params)
            ordenes = [_safe_row(dict(r)) for r in cur.fetchall()]

        columnas = {col: [] for col in COLUMNAS}
        for o in ordenes:
            estado = o["estado"]
            if estado in columnas:
                columnas[estado].append(o)

        return {
            "columnas": COLUMNAS,
            "datos": columnas,
            "total": len(ordenes),
        }


# ─── Cotizaciones directas por orden ─────────────────────────────────────────

@router.patch("/ordenes/{orden_id}/cotizaciones/toggle")
def toggle_cotizaciones(
    orden_id: int, data: CotizacionesToggle, _: dict = Depends(_require_procurement)
):
    """Activa o desactiva el módulo de cotizaciones directas para una orden."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM ordenes_compra WHERE id=%s", (orden_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            cur.execute(
                "UPDATE ordenes_compra SET requiere_cotizaciones=%s, updated_at=NOW() WHERE id=%s",
                (data.requiere, orden_id),
            )
            return _fetch_orden_detail(cur, orden_id)


@router.post("/ordenes/{orden_id}/cotizaciones")
def create_cotizacion_directa(
    orden_id: int, data: CotizacionDirecta, _: dict = Depends(_require_procurement)
):
    """Crea una cotización directamente vinculada a una orden (sin solicitud de cotización)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM ordenes_compra WHERE id=%s", (orden_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            cur.execute("""
                INSERT INTO cotizaciones
                    (orden_id, proveedor_id, numero_cotizacion, monto,
                     condiciones_pago, tiempo_entrega, vigencia, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                orden_id, data.proveedor_id, data.numero_cotizacion, data.monto,
                data.condiciones_pago, data.tiempo_entrega,
                data.vigencia or None, data.observaciones,
            ))
            cot_id = cur.fetchone()["id"]
            cur.execute("""
                SELECT c.*, p.nombre AS proveedor_nombre
                FROM cotizaciones c JOIN proveedores p ON p.id = c.proveedor_id
                WHERE c.id = %s
            """, (cot_id,))
            return _safe_row(dict(cur.fetchone()))


@router.delete("/cotizaciones/{cot_id}")
def delete_cotizacion(cot_id: int, _: dict = Depends(_require_procurement)):
    """Elimina una cotización por su ID."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cotizaciones WHERE id=%s RETURNING id", (cot_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Cotización no encontrada")
            return {"ok": True}


# ─── Consejo ──────────────────────────────────────────────────────────────────

@router.patch("/ordenes/{orden_id}/consejo/decision")
def consejo_decision(
    orden_id: int, data: ConsejoDecision, current_user: dict = Depends(_require_procurement)
):
    """Registra la decisión del consejo sobre una orden."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, requiere_aprobacion_consejo FROM ordenes_compra WHERE id=%s", (orden_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            if not row["requiere_aprobacion_consejo"]:
                raise HTTPException(status_code=400, detail="Esta orden no requiere aprobación del consejo")
            if data.decision not in ("aprobada", "rechazada"):
                raise HTTPException(status_code=400, detail="decision debe ser 'aprobada' o 'rechazada'")
            cur.execute("""
                UPDATE ordenes_compra
                SET consejo_estado=%s, consejo_comentario=%s, updated_at=NOW()
                WHERE id=%s
            """, (data.decision, data.comentario, orden_id))
            return _fetch_orden_detail(cur, orden_id)
