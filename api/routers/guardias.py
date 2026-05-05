from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from db import get_db
import base64

router = APIRouter()


class GuardiaCreate(BaseModel):
    usuario_id: int
    edificio_id: int


class TurnoCreate(BaseModel):
    guardia_id: int
    edificio_id: int
    fecha_inicio: str   # ISO datetime
    fecha_fin: str
    tipo_turno: str     # dia | noche | fin_semana
    notas: Optional[str] = None


class TurnoUpdate(BaseModel):
    estado: Optional[str] = None
    notas: Optional[str] = None


class EventoCreate(BaseModel):
    turno_id: int
    guardia_id: int
    tipo: str           # novedad | incidente | ronda | alerta | otro
    descripcion: str


@router.get("")
def list_guardias(edificio_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute("""
                    SELECT g.*, u.nombre, u.cedula, u.telefono, u.email,
                           e.nombre as edificio_nombre
                    FROM guardias g
                    JOIN usuarios u ON u.id = g.usuario_id
                    JOIN edificios e ON e.id = g.edificio_id
                    WHERE g.edificio_id = %s AND g.activo = TRUE
                    ORDER BY u.nombre
                """, (edificio_id,))
            else:
                cur.execute("""
                    SELECT g.*, u.nombre, u.cedula, u.telefono, u.email,
                           e.nombre as edificio_nombre
                    FROM guardias g
                    JOIN usuarios u ON u.id = g.usuario_id
                    JOIN edificios e ON e.id = g.edificio_id
                    WHERE g.activo = TRUE ORDER BY u.nombre
                """)
            return cur.fetchall()


@router.post("", status_code=201)
def create_guardia(data: GuardiaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO guardias (usuario_id, edificio_id) VALUES (%s,%s) RETURNING *",
                (data.usuario_id, data.edificio_id)
            )
            return cur.fetchone()


# ── Turnos ────────────────────────────────────────────────────────────────────

@router.get("/turnos")
def list_turnos(
    edificio_id: Optional[int] = None,
    guardia_id: Optional[int] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT t.*, u.nombre as guardia_nombre, e.nombre as edificio_nombre
                FROM turnos t
                JOIN guardias g ON g.id = t.guardia_id
                JOIN usuarios u ON u.id = g.usuario_id
                JOIN edificios e ON e.id = t.edificio_id
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND t.edificio_id = %s"
                params.append(edificio_id)
            if guardia_id:
                query += " AND t.guardia_id = %s"
                params.append(guardia_id)
            if fecha_inicio:
                query += " AND t.fecha_inicio >= %s"
                params.append(fecha_inicio)
            if fecha_fin:
                query += " AND t.fecha_fin <= %s"
                params.append(fecha_fin)
            query += " ORDER BY t.fecha_inicio DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/turnos", status_code=201)
def create_turno(data: TurnoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO turnos (guardia_id, edificio_id, fecha_inicio, fecha_fin, tipo_turno, notas)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.guardia_id, data.edificio_id, data.fecha_inicio,
                  data.fecha_fin, data.tipo_turno, data.notas))
            return cur.fetchone()


@router.patch("/turnos/{turno_id}")
def update_turno(turno_id: int, data: TurnoUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            if data.estado:
                fields.append("estado = %s")
                params.append(data.estado)
            if data.notas:
                fields.append("notas = %s")
                params.append(data.notas)
            if not fields:
                raise HTTPException(status_code=400, detail="Sin campos")
            params.append(turno_id)
            cur.execute(
                f"UPDATE turnos SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Turno no encontrado")
            return row


# ── Eventos de turno ──────────────────────────────────────────────────────────

@router.get("/turnos/{turno_id}/eventos")
def list_eventos(turno_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ev.*, u.nombre as guardia_nombre
                FROM guardia_eventos ev
                JOIN guardias g ON g.id = ev.guardia_id
                JOIN usuarios u ON u.id = g.usuario_id
                WHERE ev.turno_id = %s ORDER BY ev.created_at
            """, (turno_id,))
            return cur.fetchall()


@router.post("/turnos/{turno_id}/eventos", status_code=201)
async def create_evento(
    turno_id: int,
    guardia_id: int = Form(...),
    tipo: str = Form(...),
    descripcion: str = Form(...),
    foto: Optional[UploadFile] = File(None),
):
    foto_url = None
    if foto:
        content = await foto.read()
        b64 = base64.b64encode(content).decode()
        mime = foto.content_type or "image/jpeg"
        foto_url = f"data:{mime};base64,{b64}"

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO guardia_eventos (turno_id, guardia_id, tipo, descripcion, foto_url)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (turno_id, guardia_id, tipo, descripcion, foto_url))
            return cur.fetchone()


@router.get("/cuadro-turnos/{edificio_id}")
def cuadro_turnos(edificio_id: int, mes: Optional[str] = None):
    """Returns the monthly schedule grid for all guards in a building.
    `mes` should be YYYY-MM (defaults to current month)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.*, u.nombre as guardia_nombre, g.id as guardia_id
                FROM turnos t
                JOIN guardias g ON g.id = t.guardia_id
                JOIN usuarios u ON u.id = g.usuario_id
                WHERE t.edificio_id = %s
                AND DATE_TRUNC('month', t.fecha_inicio) =
                    DATE_TRUNC('month', COALESCE(%s::date, NOW()::date))
                ORDER BY t.fecha_inicio, u.nombre
            """, (edificio_id, (mes + "-01") if mes else None))
            return cur.fetchall()
