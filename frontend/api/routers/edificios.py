from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class EdificioCreate(BaseModel):
    nombre: str
    direccion: str
    unidades: int = 0
    pisos: int = 1


@router.get("/")
def list_edificios():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM edificios ORDER BY nombre")
            return cur.fetchall()


@router.get("/{edificio_id}")
def get_edificio(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM edificios WHERE id = %s", (edificio_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            return row


@router.post("/", status_code=201)
def create_edificio(data: EdificioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, unidades, pisos) VALUES (%s,%s,%s,%s) RETURNING *",
                (data.nombre, data.direccion, data.unidades, data.pisos)
            )
            return cur.fetchone()


@router.put("/{edificio_id}")
def update_edificio(edificio_id: int, data: EdificioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE edificios SET nombre=%s, direccion=%s, unidades=%s, pisos=%s WHERE id=%s RETURNING *",
                (data.nombre, data.direccion, data.unidades, data.pisos, edificio_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            return row


@router.get("/{edificio_id}/unidades")
def get_unidades(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT u.*, o.tipo as tipo_ocupacion, usr.nombre as residente_nombre "
                "FROM unidades u "
                "LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE "
                "LEFT JOIN usuarios usr ON usr.id = o.usuario_id "
                "WHERE u.edificio_id = %s ORDER BY u.numero",
                (edificio_id,)
            )
            return cur.fetchall()


@router.get("/{edificio_id}/stats")
def get_stats(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM unidades WHERE edificio_id = %s) AS total_unidades,
                    (SELECT COUNT(*) FROM cuotas c
                        JOIN unidades u ON u.id = c.unidad_id
                        WHERE u.edificio_id = %s AND c.estado = 'vencido') AS morosos,
                    (SELECT COUNT(*) FROM mantenimientos
                        WHERE edificio_id = %s AND estado IN ('pendiente','en_proceso')) AS solicitudes_pendientes,
                    (SELECT COALESCE(SUM(monto),0) FROM cuotas c
                        JOIN unidades u ON u.id = c.unidad_id
                        WHERE u.edificio_id = %s AND c.estado = 'pagado'
                        AND c.mes = TO_CHAR(NOW(),'YYYY-MM')) AS recaudo_mes,
                    (SELECT COALESCE(SUM(monto),0) FROM cuotas c
                        JOIN unidades u ON u.id = c.unidad_id
                        WHERE u.edificio_id = %s
                        AND c.mes = TO_CHAR(NOW(),'YYYY-MM')) AS meta_recaudo
            """, (edificio_id,) * 5)
            return cur.fetchone()
