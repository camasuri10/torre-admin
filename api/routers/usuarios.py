from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class UsuarioCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: str  # administrador | propietario | inquilino | portero


class OcupacionCreate(BaseModel):
    unidad_id: int
    usuario_id: int
    tipo: str  # propietario | inquilino
    fecha_inicio: str


@router.get("")
def list_usuarios(rol: Optional[str] = None, edificio_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute("""
                    SELECT DISTINCT u.*, o.tipo as tipo_ocupacion,
                           un.numero as unidad_numero, e.nombre as edificio_nombre
                    FROM usuarios u
                    JOIN ocupaciones o ON o.usuario_id = u.id AND o.activo = TRUE
                    JOIN unidades un ON un.id = o.unidad_id
                    JOIN edificios e ON e.id = un.edificio_id
                    WHERE un.edificio_id = %s
                    ORDER BY u.nombre
                """, (edificio_id,))
            elif rol:
                cur.execute("SELECT * FROM usuarios WHERE rol = %s AND activo = TRUE ORDER BY nombre", (rol,))
            else:
                cur.execute("SELECT * FROM usuarios WHERE activo = TRUE ORDER BY nombre")
            return cur.fetchall()


@router.get("/{usuario_id}")
def get_usuario(usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.*,
                       o.tipo as tipo_ocupacion, o.fecha_inicio,
                       un.numero as unidad_numero,
                       e.nombre as edificio_nombre, e.id as edificio_id
                FROM usuarios u
                LEFT JOIN ocupaciones o ON o.usuario_id = u.id AND o.activo = TRUE
                LEFT JOIN unidades un ON un.id = o.unidad_id
                LEFT JOIN edificios e ON e.id = un.edificio_id
                WHERE u.id = %s
            """, (usuario_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return row


@router.post("", status_code=201)
def create_usuario(data: UsuarioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO usuarios (nombre, cedula, email, telefono, rol) VALUES (%s,%s,%s,%s,%s) RETURNING *",
                (data.nombre, data.cedula, data.email, data.telefono, data.rol)
            )
            return cur.fetchone()


@router.put("/{usuario_id}")
def update_usuario(usuario_id: int, data: UsuarioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET nombre=%s, cedula=%s, email=%s, telefono=%s, rol=%s WHERE id=%s RETURNING *",
                (data.nombre, data.cedula, data.email, data.telefono, data.rol, usuario_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return row


@router.delete("/{usuario_id}", status_code=204)
def delete_usuario(usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET activo = FALSE WHERE id = %s", (usuario_id,))


@router.post("/ocupaciones", status_code=201)
def create_ocupacion(data: OcupacionCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Deactivate previous occupations for this unit
            cur.execute(
                "UPDATE ocupaciones SET activo = FALSE WHERE unidad_id = %s AND tipo = %s",
                (data.unidad_id, data.tipo)
            )
            cur.execute(
                "INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio) VALUES (%s,%s,%s,%s) RETURNING *",
                (data.unidad_id, data.usuario_id, data.tipo, data.fecha_inicio)
            )
            return cur.fetchone()
