from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class ZonaCreate(BaseModel):
    edificio_id: int
    torre_id: Optional[int] = None
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
    activo: Optional[bool] = None
    torre_id: Optional[int] = None


class ReservaCreate(BaseModel):
    zona_id: int
    usuario_id: int
    registrado_por_id: Optional[int] = None
    unidad_id: Optional[int] = None
    fecha: str
    hora_inicio: str
    hora_fin: Optional[str] = None   # si no se provee, se calcula con duracion_min_horas
    notas: Optional[str] = None


class ReservaCancelar(BaseModel):
    cancelada_por: str = "admin"   # 'residente' | 'admin'
    motivo: Optional[str] = None


@router.get("")
def list_zonas(edificio_id: Optional[int] = None, incluir_inactivas: bool = False):
    with get_db() as conn:
        with conn.cursor() as cur:
            base = """
                SELECT z.*, e.nombre as edificio_nombre,
                       t.nombre as torre_nombre, t.numero_torre
                FROM zonas_comunes z
                JOIN edificios e ON e.id = z.edificio_id
                LEFT JOIN edificios t ON t.id = z.torre_id
                WHERE 1=1
            """
            params = []
            if not incluir_inactivas:
                base += " AND z.activo = TRUE"
            if edificio_id:
                base += " AND z.edificio_id = %s"
                params.append(edificio_id)
            base += " ORDER BY e.nombre, z.nombre"
            cur.execute(base, params)
            return cur.fetchall()


@router.post("", status_code=201)
def create_zona(data: ZonaCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO zonas_comunes
                    (edificio_id, torre_id, nombre, descripcion, capacidad, icono,
                     duracion_min_horas, duracion_max_horas,
                     anticipacion_min_dias, anticipacion_max_dias,
                     horario_inicio, horario_fin)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.torre_id, data.nombre, data.descripcion,
                  data.capacidad, data.icono,
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
                params,
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
                SELECT r.*,
                       z.nombre as zona_nombre, z.icono as zona_icono,
                       u.nombre as usuario_nombre,
                       reg.nombre as registrado_por_nombre,
                       un.numero as unidad_numero,
                       e.id as edificio_id, e.nombre as edificio_nombre
                FROM reservas r
                JOIN zonas_comunes z ON z.id = r.zona_id
                JOIN edificios e ON e.id = z.edificio_id
                JOIN usuarios u ON u.id = r.usuario_id
                LEFT JOIN usuarios reg ON reg.id = r.registrado_por_id
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
            # Obtener config de la zona
            cur.execute("SELECT * FROM zonas_comunes WHERE id = %s AND activo = TRUE", (data.zona_id,))
            zona = cur.fetchone()
            if not zona:
                raise HTTPException(status_code=404, detail="Zona no encontrada o inactiva")

            # Calcular hora_fin por defecto si no se provee
            hora_fin = data.hora_fin
            if not hora_fin:
                cur.execute("""
                    SELECT (%s::time + (%s || ' hours')::interval)::time AS hora_fin
                """, (data.hora_inicio, float(zona["duracion_min_horas"])))
                hora_fin = str(cur.fetchone()["hora_fin"])

            # Verificar conflictos (ignorar canceladas y no_usadas)
            cur.execute("""
                SELECT id FROM reservas
                WHERE zona_id = %s AND fecha = %s AND estado NOT IN ('cancelada','no_usada')
                AND (hora_inicio, hora_fin) OVERLAPS (%s::time, %s::time)
            """, (data.zona_id, data.fecha, data.hora_inicio, hora_fin))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="La zona ya está reservada en ese horario")

            cur.execute("""
                INSERT INTO reservas
                    (zona_id, usuario_id, registrado_por_id, unidad_id, fecha, hora_inicio, hora_fin, notas)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.zona_id, data.usuario_id, data.registrado_por_id,
                  data.unidad_id, data.fecha, data.hora_inicio, hora_fin, data.notas))
            return cur.fetchone()


@router.patch("/reservas/{reserva_id}")
def update_reserva_estado(reserva_id: int, estado: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reservas SET estado = %s WHERE id = %s RETURNING *",
                (estado, reserva_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")
            return row


@router.patch("/reservas/{reserva_id}/cancelar")
def cancelar_reserva(reserva_id: int, data: ReservaCancelar):
    """Cancela una reserva sin borrarla — libera el slot y guarda la razón."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, estado FROM reservas WHERE id = %s", (reserva_id,))
            reserva = cur.fetchone()
            if not reserva:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")
            if reserva["estado"] == "cancelada":
                raise HTTPException(status_code=400, detail="La reserva ya está cancelada")

            cur.execute("""
                UPDATE reservas
                SET estado = 'cancelada',
                    cancelada_por = %s,
                    motivo_cancelacion = %s
                WHERE id = %s RETURNING *
            """, (data.cancelada_por, data.motivo, reserva_id))
            return cur.fetchone()


@router.get("/reservas/pendientes-alerta")
def reservas_pendientes_alerta():
    """Reservas confirmadas en los próximos 30 minutos sin alerta enviada."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.*, z.nombre as zona_nombre,
                       u.nombre as usuario_nombre, u.email, u.notif_sistema, u.notif_email, u.notif_whatsapp,
                       un.numero as unidad_numero
                FROM reservas r
                JOIN zonas_comunes z ON z.id = r.zona_id
                JOIN usuarios u ON u.id = r.usuario_id
                LEFT JOIN unidades un ON un.id = r.unidad_id
                WHERE r.estado = 'confirmada'
                  AND r.alerta_enviada = FALSE
                  AND (r.fecha + r.hora_inicio) BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
            """)
            return cur.fetchall()


@router.patch("/reservas/{reserva_id}/alerta-enviada")
def marcar_alerta_enviada(reserva_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reservas SET alerta_enviada = TRUE WHERE id = %s RETURNING id",
                (reserva_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return {"message": "Alerta marcada como enviada"}


@router.get("/{zona_id}/disponibilidad")
def check_disponibilidad(zona_id: int, fecha: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.hora_inicio, r.hora_fin, r.estado,
                       u.nombre as reservado_por, un.numero as unidad_numero
                FROM reservas r
                JOIN usuarios u ON u.id = r.usuario_id
                LEFT JOIN unidades un ON un.id = r.unidad_id
                WHERE r.zona_id = %s AND r.fecha = %s AND r.estado NOT IN ('cancelada','no_usada')
                ORDER BY r.hora_inicio
            """, (zona_id, fecha))
            ocupados = cur.fetchall()
            cur.execute("SELECT horario_inicio, horario_fin, duracion_min_horas FROM zonas_comunes WHERE id = %s", (zona_id,))
            config = cur.fetchone()
            return {"ocupados": ocupados, "config": config}
