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


class UnidadCreate(BaseModel):
    numero: str
    piso: int = 1
    area_m2: Optional[float] = None
    coeficiente: Optional[float] = None


class UnidadUpdate(BaseModel):
    numero: Optional[str] = None
    piso: Optional[int] = None
    area_m2: Optional[float] = None
    coeficiente: Optional[float] = None


@router.get("")
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


@router.post("", status_code=201)
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


@router.post("/{edificio_id}/unidades", status_code=201)
def create_unidad(edificio_id: int, data: UnidadCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO unidades (edificio_id, numero, piso, area_m2, coeficiente) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING *",
                (edificio_id, data.numero, data.piso, data.area_m2, data.coeficiente),
            )
            row = cur.fetchone()
            cur.execute(
                "UPDATE edificios SET unidades = (SELECT COUNT(*) FROM unidades WHERE edificio_id=%s) WHERE id=%s",
                (edificio_id, edificio_id),
            )
            return row


@router.put("/{edificio_id}/unidades/{unidad_id}")
def update_unidad(edificio_id: int, unidad_id: int, data: UnidadUpdate):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.extend([unidad_id, edificio_id])
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE unidades SET {', '.join(fields)} WHERE id=%s AND edificio_id=%s RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Unidad no encontrada")
            return row


@router.delete("/{edificio_id}/unidades/{unidad_id}", status_code=204)
def delete_unidad(edificio_id: int, unidad_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM ocupaciones WHERE unidad_id=%s AND activo=TRUE",
                (unidad_id,),
            )
            if cur.fetchone()["cnt"] > 0:
                raise HTTPException(
                    status_code=409,
                    detail="La unidad tiene residentes activos. Retírelos primero.",
                )
            cur.execute(
                "DELETE FROM unidades WHERE id=%s AND edificio_id=%s",
                (unidad_id, edificio_id),
            )
            cur.execute(
                "UPDATE edificios SET unidades = (SELECT COUNT(*) FROM unidades WHERE edificio_id=%s) WHERE id=%s",
                (edificio_id, edificio_id),
            )


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
