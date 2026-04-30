from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class ZonaCreate(BaseModel):
    edificio_id: int
    nombre: str
    descripcion: Optional[str] = None
    capacidad: Optional[int] = None
    icono: Optional[str] = None
    duracion_min_horas: float = 1.0
    duracion_max_horas: float = 4.0
    anticipacion_min_dias: int = 1
    anticipacion_max_dias: int = 30
    horario_inicio: str = "07:00"
    horario_fin: str = "22:00"


class ZonaConfigUpdate(BaseModel):
    duracion_min_horas: Optional[float] = None
    duracion_max_horas: Optional[float] = None
    anticipacion_min_dias: Optional[int] = None
    anticipacion_max_dias: Optional[int] = None
    horario_inicio: Optional[str] = None
    horario_fin: Optional[str] = None
    disponible: Optional[bool] = None


class ReservaCreate(BaseModel):
    zona_id: int
    usuario_id: int
    unidad_id: Optional[int] = None
    fecha: str
    hora_inicio: str
    hora_fin: str
    notas: Optional[str] = None


@router.get("/")
def list_zonas(edificio_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute(
                    "SELECT z.*, e.nombre as edificio_nombre FROM zonas_comunes z "
                    "JOIN edificios e ON e.id = z.edificio_id WHERE z.edificio_id = %s ORDER BY z.nombre",
                    (edificio_id,)
                )
            else:
                cur.execute(
                    "SELECT z.*, e.nombre as edificio_nombre FROM zonas_comunes z "
                    "JOIN edificios e ON e.id = z.edificio_id ORDER BY e.nombre, z.nombre"
                )
            return cur.fetchall()


@router.post("/", status_code=201)
def create_zona(data: ZonaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO zonas_comunes
                    (edificio_id, nombre, descripcion, capacidad, icono,
                     duracion_min_horas, duracion_max_horas,
                     anticipacion_min_dias, anticipacion_max_dias,
                     horario_inicio, horario_fin)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.nombre, data.descripcion, data.capacidad, data.icono,
                  data.duracion_min_horas, data.duracion_max_horas,
                  data.anticipacion_min_dias, data.anticipacion_max_dias,
                  data.horario_inicio, data.horario_fin))
            return cur.fetchone()


@router.patch("/{zona_id}/config")
def update_zona_config(zona_id: int, data: ZonaConfigUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            for field, val in data.model_dump(exclude_none=True).items():
                fields.append(f"{field} = %s")
                params.append(val)
            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")
            params.append(zona_id)
            cur.execute(
                f"UPDATE zonas_comunes SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Zona no encontrada")
            return row


# ── Reservas ─────────────────────────────────────────────────────────────────

@router.get("/reservas")
def list_reservas(
    edificio_id: Optional[int] = None,
    zona_id: Optional[int] = None,
    fecha: Optional[str] = None,
    estado: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT r.*, z.nombre as zona_nombre, z.icono as zona_icono,
                       u.nombre as usuario_nombre, un.numero as unidad_numero,
                       e.id as edificio_id, e.nombre as edificio_nombre
                FROM reservas r
                JOIN zonas_comunes z ON z.id = r.zona_id
                JOIN edificios e ON e.id = z.edificio_id
                JOIN usuarios u ON u.id = r.usuario_id
                LEFT JOIN unidades un ON un.id = r.unidad_id
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND e.id = %s"
                params.append(edificio_id)
            if zona_id:
                query += " AND r.zona_id = %s"
                params.append(zona_id)
            if fecha:
                query += " AND r.fecha = %s"
                params.append(fecha)
            if estado:
                query += " AND r.estado = %s"
                params.append(estado)
            query += " ORDER BY r.fecha DESC, r.hora_inicio"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/reservas", status_code=201)
def create_reserva(data: ReservaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Check for conflicts
            cur.execute("""
                SELECT id FROM reservas
                WHERE zona_id = %s AND fecha = %s AND estado != 'cancelada'
                AND (hora_inicio, hora_fin) OVERLAPS (%s::time, %s::time)
            """, (data.zona_id, data.fecha, data.hora_inicio, data.hora_fin))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="La zona ya está reservada en ese horario")

            # Validate against zone config
            cur.execute("SELECT * FROM zonas_comunes WHERE id = %s", (data.zona_id,))
            zona = cur.fetchone()
            if not zona:
                raise HTTPException(status_code=404, detail="Zona no encontrada")

            cur.execute("""
                INSERT INTO reservas (zona_id, usuario_id, unidad_id, fecha, hora_inicio, hora_fin, notas)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.zona_id, data.usuario_id, data.unidad_id,
                  data.fecha, data.hora_inicio, data.hora_fin, data.notas))
            return cur.fetchone()


@router.patch("/reservas/{reserva_id}")
def update_reserva_estado(reserva_id: int, estado: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reservas SET estado = %s WHERE id = %s RETURNING *",
                (estado, reserva_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")
            return row


@router.get("/{zona_id}/disponibilidad")
def check_disponibilidad(zona_id: int, fecha: str):
    """Returns list of reserved time slots for a zone on a given date."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.hora_inicio, r.hora_fin, u.nombre as reservado_por
                FROM reservas r
                JOIN usuarios u ON u.id = r.usuario_id
                WHERE r.zona_id = %s AND r.fecha = %s AND r.estado != 'cancelada'
                ORDER BY r.hora_inicio
            """, (zona_id, fecha))
            ocupados = cur.fetchall()
            cur.execute("SELECT horario_inicio, horario_fin FROM zonas_comunes WHERE id = %s", (zona_id,))
            config = cur.fetchone()
            return {"ocupados": ocupados, "config": config}
