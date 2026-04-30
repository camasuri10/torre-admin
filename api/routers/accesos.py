from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class AccesoCreate(BaseModel):
    edificio_id: int
    visitante_nombre: str
    visitante_documento: Optional[str] = None
    destino_unidad_id: Optional[int] = None
    anfitrion_id: Optional[int] = None
    motivo: str
    autorizado: bool = True
    registrado_por: Optional[int] = None


class SalidaRegistro(BaseModel):
    fecha_salida: Optional[str] = None  # ISO datetime, defaults to NOW()


@router.get("")
def list_accesos(
    edificio_id: Optional[int] = None,
    fecha: Optional[str] = None,
    activos: Optional[bool] = None,   # True = still inside (no salida)
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT a.*, e.nombre as edificio_nombre,
                       u.numero as unidad_numero,
                       anf.nombre as anfitrion_nombre,
                       reg.nombre as registrado_por_nombre
                FROM accesos a
                JOIN edificios e ON e.id = a.edificio_id
                LEFT JOIN unidades u ON u.id = a.destino_unidad_id
                LEFT JOIN usuarios anf ON anf.id = a.anfitrion_id
                LEFT JOIN usuarios reg ON reg.id = a.registrado_por
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND a.edificio_id = %s"
                params.append(edificio_id)
            if fecha:
                query += " AND DATE(a.fecha_entrada) = %s"
                params.append(fecha)
            if activos is True:
                query += " AND a.fecha_salida IS NULL"
            query += " ORDER BY a.fecha_entrada DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("", status_code=201)
def registrar_ingreso(data: AccesoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO accesos
                    (edificio_id, visitante_nombre, visitante_documento,
                     destino_unidad_id, anfitrion_id, motivo, autorizado, registrado_por)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.visitante_nombre, data.visitante_documento,
                  data.destino_unidad_id, data.anfitrion_id, data.motivo,
                  data.autorizado, data.registrado_por))
            return cur.fetchone()


@router.patch("/{acceso_id}/salida")
def registrar_salida(acceso_id: int, data: SalidaRegistro):
    with get_db() as conn:
        with conn.cursor() as cur:
            ts = data.fecha_salida or "NOW()"
            if data.fecha_salida:
                cur.execute(
                    "UPDATE accesos SET fecha_salida = %s WHERE id = %s RETURNING *",
                    (data.fecha_salida, acceso_id)
                )
            else:
                cur.execute(
                    "UPDATE accesos SET fecha_salida = NOW() WHERE id = %s RETURNING *",
                    (acceso_id,)
                )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Registro no encontrado")
            return row


@router.get("/stats/{edificio_id}")
def acceso_stats(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE DATE(fecha_entrada) = CURRENT_DATE) AS ingresos_hoy,
                    COUNT(*) FILTER (WHERE fecha_salida IS NULL AND DATE(fecha_entrada) = CURRENT_DATE) AS dentro_ahora,
                    COUNT(*) FILTER (WHERE autorizado = FALSE AND DATE(fecha_entrada) = CURRENT_DATE) AS no_autorizados_hoy
                FROM accesos WHERE edificio_id = %s
            """, (edificio_id,))
            return cur.fetchone()
