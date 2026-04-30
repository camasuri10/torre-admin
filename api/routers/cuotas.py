from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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


@router.get("/")
def list_cuotas(
    edificio_id: Optional[int] = None,
    estado: Optional[str] = None,
    mes: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT c.*, u.numero as unidad_numero, e.nombre as edificio_nombre,
                       e.id as edificio_id,
                       usr.nombre as residente_nombre
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN edificios e ON e.id = u.edificio_id
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
            query += " ORDER BY c.fecha_vencimiento DESC, u.numero"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/", status_code=201)
def create_cuota(data: CuotaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO cuotas (unidad_id, mes, monto, fecha_vencimiento, estado) VALUES (%s,%s,%s,%s,%s) RETURNING *",
                (data.unidad_id, data.mes, data.monto, data.fecha_vencimiento, data.estado)
            )
            return cur.fetchone()


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


@router.get("/resumen/{edificio_id}")
def resumen_financiero(edificio_id: int, mes: Optional[str] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            mes_filter = mes or "TO_CHAR(NOW(),'YYYY-MM')"
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
                WHERE u.edificio_id = %s AND c.mes = %s
            """, (edificio_id, mes or "2025-07"))
            return cur.fetchone()
