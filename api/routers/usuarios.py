from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class UsuarioCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: str  # administrador | propietario | inquilino | portero | servicios
    password: Optional[str] = None
    edificio_id: Optional[int] = None  # contexto del admin — auto-asocia al edificio


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[str] = None
    notif_sistema: Optional[bool] = None
    notif_email: Optional[bool] = None
    notif_whatsapp: Optional[bool] = None


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
                    SELECT DISTINCT ON (u.id)
                           u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                           u.notif_sistema, u.notif_email, u.notif_whatsapp,
                           o.tipo as tipo_ocupacion,
                           un.numero as unidad_numero,
                           COALESCE(eu.nombre, ed.nombre) as edificio_nombre
                    FROM usuarios u
                    LEFT JOIN ocupaciones o ON o.usuario_id = u.id AND o.activo = TRUE
                    LEFT JOIN unidades un ON un.id = o.unidad_id
                    LEFT JOIN torres tor ON tor.id = un.torre_id
                    LEFT JOIN edificios eu ON eu.id = tor.edificio_id
                    LEFT JOIN usuario_edificios ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                    LEFT JOIN edificios ed ON ed.id = ue.edificio_id
                    WHERE u.activo = TRUE
                      AND (
                        eu.id = %s
                        OR ue.edificio_id = %s
                      )
                    ORDER BY u.id, u.nombre
                """, (edificio_id, edificio_id))
            elif rol:
                cur.execute(
                    "SELECT id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp "
                    "FROM usuarios WHERE rol = %s AND activo = TRUE ORDER BY nombre",
                    (rol,),
                )
            else:
                cur.execute(
                    "SELECT id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp "
                    "FROM usuarios WHERE activo = TRUE ORDER BY nombre"
                )
            return cur.fetchall()


@router.get("/{usuario_id}")
def get_usuario(usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                       u.notif_sistema, u.notif_email, u.notif_whatsapp,
                       u.eps, u.aseguradora_riesgo,
                       o.tipo as tipo_ocupacion, o.fecha_inicio,
                       un.numero as unidad_numero,
                       t.nombre as torre_nombre,
                       e.nombre as edificio_nombre, e.id as edificio_id
                FROM usuarios u
                LEFT JOIN ocupaciones o ON o.usuario_id = u.id AND o.activo = TRUE
                LEFT JOIN unidades un ON un.id = o.unidad_id
                LEFT JOIN torres t ON t.id = un.torre_id
                LEFT JOIN edificios e ON e.id = t.edificio_id
                WHERE u.id = %s
            """, (usuario_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            result = dict(row)

            # Vehículos
            cur.execute(
                "SELECT id, placa, marca, modelo, color, tipo FROM vehiculos WHERE usuario_id = %s AND activo = TRUE ORDER BY placa",
                (usuario_id,),
            )
            result["vehiculos"] = [dict(r) for r in cur.fetchall()]

            # Mascotas
            cur.execute(
                "SELECT id, nombre, especie, raza, color FROM mascotas WHERE usuario_id = %s AND activo = TRUE ORDER BY nombre",
                (usuario_id,),
            )
            result["mascotas"] = [dict(r) for r in cur.fetchall()]

            return result


@router.post("", status_code=201)
def create_usuario(data: UsuarioCreate):
    password_hash = None
    if data.password:
        try:
            from passlib.context import CryptContext
            password_hash = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(data.password)
        except ImportError:
            pass
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO usuarios (nombre, cedula, email, telefono, rol, password_hash) "
                "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp",
                (data.nombre, data.cedula, data.email, data.telefono, data.rol, password_hash),
            )
            new_user = cur.fetchone()
            # Auto-asociar al edificio del admin que lo crea
            if data.edificio_id:
                cur.execute(
                    "INSERT INTO usuario_edificios (usuario_id, edificio_id, activo) "
                    "VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                    (new_user["id"], data.edificio_id),
                )
            return new_user


@router.put("/{usuario_id}")
def update_usuario(usuario_id: int, data: UsuarioUpdate):
    fields, values = [], []
    if data.nombre is not None:
        fields.append("nombre = %s"); values.append(data.nombre)
    if data.cedula is not None:
        fields.append("cedula = %s"); values.append(data.cedula)
    if data.email is not None:
        fields.append("email = %s"); values.append(data.email)
    if data.telefono is not None:
        fields.append("telefono = %s"); values.append(data.telefono)
    if data.rol is not None:
        fields.append("rol = %s"); values.append(data.rol)
    if data.notif_sistema is not None:
        fields.append("notif_sistema = %s"); values.append(data.notif_sistema)
    if data.notif_email is not None:
        fields.append("notif_email = %s"); values.append(data.notif_email)
    if data.notif_whatsapp is not None:
        fields.append("notif_whatsapp = %s"); values.append(data.notif_whatsapp)

    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")

    values.append(usuario_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE usuarios SET {', '.join(fields)} WHERE id = %s "
                "RETURNING id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp",
                values,
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
            cur.execute(
                "UPDATE ocupaciones SET activo = FALSE WHERE unidad_id = %s AND tipo = %s",
                (data.unidad_id, data.tipo),
            )
            cur.execute(
                "INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio) VALUES (%s,%s,%s,%s) RETURNING *",
                (data.unidad_id, data.usuario_id, data.tipo, data.fecha_inicio),
            )
            return cur.fetchone()
