from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from db import get_db

router = APIRouter()


class CuotaCreate(BaseModel):
    unidad_id: int
    mes: str           # "2025-07"
    monto: float
    fecha_vencimiento: str
    estado: str = "pendiente"


class PagoRegistro(BaseModel):
    fecha_pago: str
    metodo_pago: Optional[str] = None


class GenerarCuotasRequest(BaseModel):
    edificio_id: int
    mes: str           # "2026-05"
    monto: float
    fecha_vencimiento: str


# ── Resumen — before /{cuota_id} to avoid route conflict ─────────────────────

@router.get("/resumen/{edificio_id}")
def resumen_financiero(edificio_id: int, mes: Optional[str] = None):
    mes_actual = mes or datetime.now().strftime("%Y-%m")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE c.estado = 'pagado') AS pagadas,
                    COUNT(*) FILTER (WHERE c.estado = 'pendiente') AS pendientes,
                    COUNT(*) FILTER (WHERE c.estado = 'vencido') AS vencidas,
                    COALESCE(SUM(c.monto) FILTER (WHERE c.estado = 'pagado'), 0) AS total_recaudado,
                    COALESCE(SUM(c.monto) FILTER (WHERE c.estado IN ('pendiente','vencido')), 0) AS total_pendiente,
                    COALESCE(SUM(c.monto), 0) AS total_meta
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE t.edificio_id = %s AND c.mes = %s
            """, (edificio_id, mes_actual))
            return cur.fetchone()


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_cuotas(
    edificio_id: Optional[int] = None,
    estado: Optional[str] = None,
    mes: Optional[str] = None,
    usuario_id: Optional[int] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT c.*, u.numero as unidad_numero, e.nombre as edificio_nombre,
                       e.id as edificio_id,
                       t.nombre as torre_nombre,
                       usr.nombre as residente_nombre
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                JOIN edificios e ON e.id = t.edificio_id
                LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE
                LEFT JOIN usuarios usr ON usr.id = o.usuario_id
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND e.id = %s"
                params.append(edificio_id)
            if estado:
                query += " AND c.estado = %s"
                params.append(estado)
            if mes:
                query += " AND c.mes = %s"
                params.append(mes)
            if usuario_id:
                query += " AND usr.id = %s"
                params.append(usuario_id)
            query += " ORDER BY c.fecha_vencimiento DESC, u.numero"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("", status_code=201)
def create_cuota(data: CuotaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO cuotas (unidad_id, mes, monto, fecha_vencimiento, estado) VALUES (%s,%s,%s,%s,%s) RETURNING *",
                (data.unidad_id, data.mes, data.monto, data.fecha_vencimiento, data.estado)
            )
            return cur.fetchone()


@router.post("/generar-mes", status_code=201)
def generar_cuotas_mes(data: GenerarCuotasRequest):
    """Crea cuotas para todas las unidades del edificio para el mes dado."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                WHERE t.edificio_id = %s AND u.activo = TRUE
            """, (data.edificio_id,))
            unidades = cur.fetchall()
            if not unidades:
                raise HTTPException(status_code=404, detail="No hay unidades en el edificio")

            creadas = 0
            omitidas = 0
            for u in unidades:
                cur.execute(
                    "SELECT id FROM cuotas WHERE unidad_id = %s AND mes = %s",
                    (u["id"], data.mes),
                )
                if cur.fetchone():
                    omitidas += 1
                    continue
                cur.execute(
                    "INSERT INTO cuotas (unidad_id, mes, monto, fecha_vencimiento, estado) "
                    "VALUES (%s,%s,%s,%s,'pendiente')",
                    (u["id"], data.mes, data.monto, data.fecha_vencimiento),
                )
                creadas += 1
            return {"creadas": creadas, "omitidas": omitidas, "mes": data.mes}


@router.patch("/{cuota_id}/pagar")
def registrar_pago(cuota_id: int, data: PagoRegistro):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cuotas SET estado='pagado', fecha_pago=%s, metodo_pago=%s WHERE id=%s RETURNING *",
                (data.fecha_pago, data.metodo_pago, cuota_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Cuota no encontrada")
            return row


@router.patch("/{cuota_id}/estado")
def update_estado_cuota(cuota_id: int, estado: str):
    if estado not in ("pendiente", "vencido", "pagado"):
        raise HTTPException(status_code=400, detail="Estado inválido. Use: pendiente, vencido, pagado")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cuotas SET estado = %s WHERE id = %s RETURNING *",
                (estado, cuota_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Cuota no encontrada")
            return row
