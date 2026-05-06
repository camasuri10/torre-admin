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

def _gen_numero_orden(cur, edificio_id: int) -> str:
    yr = date.today().year
    cur.execute(
        "SELECT COUNT(*)+1 AS seq FROM ordenes_compra WHERE edificio_id=%s AND EXTRACT(YEAR FROM created_at)=%s",
        (edificio_id, yr),
    )
    seq = int(cur.fetchone()["seq"])
    return f"ORD-{edificio_id}-{yr}-{seq:04d}"


def _needs_superadmin(monto: float, edificio_id: int, cur) -> bool:
    cur.execute("""
        SELECT approver_rol FROM flujos_aprobacion
        WHERE edificio_id=%s AND activo=TRUE
          AND monto_minimo <= %s AND (monto_maximo IS NULL OR monto_maximo >= %s)
        ORDER BY monto_minimo DESC LIMIT 1
    """, (edificio_id, monto, monto))
    row = cur.fetchone()
    if row:
        return row["approver_rol"] == "superadmin"
    return monto >= 1_000_000


_ORDEN_SELECT = """
    SELECT o.*,
           p.nombre AS proveedor_nombre,
           e.nombre AS edificio_nombre,
           u.nombre AS solicitante_nombre
    FROM ordenes_compra o
    LEFT JOIN proveedores p ON p.id = o.proveedor_id
    JOIN edificios e ON e.id = o.edificio_id
    LEFT JOIN usuarios u ON u.id = o.solicitante_id
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


class OrdenCreate(BaseModel):
    titulo: str
    tipo_orden: str
    proveedor_id: Optional[int] = None
    descripcion: Optional[str] = None
    monto_estimado: float = 0
    fecha_necesidad: Optional[str] = None
    edificio_id: int
    items: list[ItemIn] = []


class OrdenUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo_orden: Optional[str] = None
    proveedor_id: Optional[int] = None
    descripcion: Optional[str] = None
    monto_estimado: Optional[float] = None
    fecha_necesidad: Optional[str] = None
    items: Optional[list[ItemIn]] = None


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
    edificio_id: int


class FlujoCreate(BaseModel):
    nombre: str
    tipo_orden: Optional[str] = None
    monto_minimo: float = 0
    monto_maximo: Optional[float] = None
    approver_rol: str  # administrador | superadmin
    edificio_id: int


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(edificio_id: int, _: dict = Depends(_require_procurement)):
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
                    FROM ordenes_compra WHERE edificio_id = %s
                """, (edificio_id,))
                row = dict(cur.fetchone())

                cur.execute(
                    "SELECT COUNT(*) FROM solicitudes_cotizacion WHERE edificio_id=%s AND estado='abierta'",
                    (edificio_id,),
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
    edificio_id: Optional[int] = None,
    estado: Optional[str] = None,
    tipo_orden: Optional[str] = None,
    proveedor_id: Optional[int] = None,
    current_user: dict = Depends(_require_procurement),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = _ORDEN_SELECT + " WHERE 1=1"
            params: list = []
            if edificio_id:
                query += " AND o.edificio_id = %s"; params.append(edificio_id)
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
                SELECT o.*, p.nombre AS proveedor_nombre, e.nombre AS edificio_nombre,
                       u.nombre AS solicitante_nombre
                FROM ordenes_compra o
                JOIN orden_aprobaciones oa ON oa.orden_id = o.id AND oa.estado = 'pendiente'
                LEFT JOIN proveedores p ON p.id = o.proveedor_id
                JOIN edificios e ON e.id = o.edificio_id
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
            numero = _gen_numero_orden(cur, data.edificio_id)
            cur.execute("""
                INSERT INTO ordenes_compra
                    (numero_orden, titulo, tipo_orden, proveedor_id, descripcion,
                     monto_estimado, fecha_necesidad, edificio_id, solicitante_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                numero, data.titulo, data.tipo_orden, data.proveedor_id, data.descripcion,
                data.monto_estimado, data.fecha_necesidad, data.edificio_id, solicitante_id,
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

            fields, values = [], []
            if data.titulo is not None:
                fields.append("titulo=%s"); values.append(data.titulo)
            if data.tipo_orden is not None:
                fields.append("tipo_orden=%s"); values.append(data.tipo_orden)
            if data.proveedor_id is not None:
                fields.append("proveedor_id=%s"); values.append(data.proveedor_id)
            if data.descripcion is not None:
                fields.append("descripcion=%s"); values.append(data.descripcion)
            if data.monto_estimado is not None:
                fields.append("monto_estimado=%s"); values.append(data.monto_estimado)
            if data.fecha_necesidad is not None:
                fields.append("fecha_necesidad=%s"); values.append(data.fecha_necesidad)

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

            # Validar permisos para aprobar/rechazar
            if data.accion in ("aprobar", "rechazar"):
                cur.execute(
                    "SELECT * FROM orden_aprobaciones WHERE orden_id=%s AND estado='pendiente' ORDER BY nivel LIMIT 1",
                    (orden_id,),
                )
                aprobacion = cur.fetchone()
                if not aprobacion:
                    raise HTTPException(status_code=400, detail="No hay aprobación pendiente para esta orden")
                if aprobacion["approver_rol"] and aprobacion["approver_rol"] != rol:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Esta orden requiere aprobación de '{aprobacion['approver_rol']}'"
                    )
                new_ap_estado = "aprobada" if data.accion == "aprobar" else "rechazada"
                cur.execute("""
                    UPDATE orden_aprobaciones
                    SET estado=%s, approver_id=%s, comentario=%s, fecha_decision=NOW()
                    WHERE id=%s
                """, (new_ap_estado, uid, data.comentario, aprobacion["id"]))

            # Lógica especial para submit: auto-aprobar si admin con monto < 1M
            if data.accion == "submit":
                monto = float(orden["monto_estimado"] or 0)
                needs_sa = _needs_superadmin(monto, orden["edificio_id"], cur)
                if needs_sa:
                    cur.execute("""
                        INSERT INTO orden_aprobaciones (orden_id, approver_rol, nivel, estado)
                        VALUES (%s, 'superadmin', 1, 'pendiente')
                    """, (orden_id,))
                else:
                    # Auto-aprobación para admin con montos pequeños
                    new_estado = "aprobada"
                    cur.execute("""
                        INSERT INTO orden_aprobaciones (orden_id, approver_id, approver_rol, nivel, estado, fecha_decision, comentario)
                        VALUES (%s, %s, %s, 1, 'aprobada', NOW(), 'Auto-aprobada por monto')
                    """, (orden_id, uid, rol))

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
    edificio_id: Optional[int] = None,
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
            if edificio_id:
                query += " AND (s.edificio_id=%s OR s.edificio_id IS NULL)"; params.append(edificio_id)
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
                    numero = _gen_numero_orden(cur, sol["edificio_id"])
                    cur.execute("""
                        INSERT INTO ordenes_compra
                            (numero_orden, titulo, tipo_orden, proveedor_id, descripcion,
                             monto_estimado, edificio_id, solicitante_id)
                        VALUES (%s,%s,'compra_bienes',%s,%s,%s,%s,%s) RETURNING id
                    """, (
                        numero,
                        f"Orden de: {sol['titulo']}",
                        cot["proveedor_id"],
                        sol["descripcion"],
                        float(cot["monto"]),
                        sol["edificio_id"],
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
def list_solicitudes(edificio_id: Optional[int] = None, _: dict = Depends(_require_procurement)):
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
            if edificio_id:
                query += " AND s.edificio_id=%s"; params.append(edificio_id)
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
                    (titulo, tipo, descripcion, fecha_limite, criterios_evaluacion, edificio_id, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (
                data.titulo, data.tipo, data.descripcion, data.fecha_limite,
                data.criterios_evaluacion, data.edificio_id, uid,
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
def list_flujos(edificio_id: Optional[int] = None, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = "SELECT f.*, u.nombre AS approver_nombre FROM flujos_aprobacion f LEFT JOIN usuarios u ON u.id=f.approver_id WHERE 1=1"
            params: list = []
            if edificio_id:
                query += " AND f.edificio_id=%s"; params.append(edificio_id)
            query += " ORDER BY f.monto_minimo"
            cur.execute(query, params)
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/flujos", status_code=201)
def create_flujo(data: FlujoCreate, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO flujos_aprobacion
                    (nombre, tipo_orden, monto_minimo, monto_maximo, approver_rol, edificio_id)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.nombre, data.tipo_orden, data.monto_minimo, data.monto_maximo, data.approver_rol, data.edificio_id))
            return _safe_row(dict(cur.fetchone()))


@router.delete("/flujos/{flujo_id}", status_code=204)
def delete_flujo(flujo_id: int, _: dict = Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM flujos_aprobacion WHERE id=%s", (flujo_id,))
