from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import psycopg2.errors
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class UsuarioCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    tipo_documento: Optional[str] = "CC"
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: str  # administrador | propietario | inquilino | portero | servicios
    password: Optional[str] = None
    conjunto_id: Optional[int] = None  # contexto del admin — auto-asocia al conjunto


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    tipo_documento: Optional[str] = None
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
def list_usuarios(
    rol: Optional[str] = None,
    conjunto_id: Optional[int] = None,
    tipo_ocupacion: Optional[str] = None,  # propietario | inquilino
    solo_inactivos: Optional[bool] = None,  # True = solo inactivos, None = solo activos
):
    activo_filter = "FALSE" if solo_inactivos else "TRUE"
    with get_db() as conn:
        with conn.cursor() as cur:
            if conjunto_id:
                tipo_cond = ""
                join_params: list = []
                if tipo_ocupacion:
                    tipo_cond = "AND o.tipo = %s"
                    join_params = [tipo_ocupacion]
                cur.execute(f"""
                    SELECT DISTINCT ON (u.id)
                           u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                           u.notif_sistema, u.notif_email, u.notif_whatsapp,
                           o.tipo as tipo_ocupacion,
                           o.unidad_id,
                           un.numero as unidad_numero,
                           tor.nombre as torre_nombre,
                           tor.numero as torre_numero,
                           COALESCE(eu.nombre, ed.nombre) as conjunto_nombre
                    FROM usuarios u
                    LEFT JOIN ocupaciones o ON o.usuario_id = u.id AND o.activo = TRUE {tipo_cond}
                    LEFT JOIN unidades un ON un.id = o.unidad_id
                    LEFT JOIN torres tor ON tor.id = un.torre_id
                    LEFT JOIN conjuntos eu ON eu.id = tor.conjunto_id
                    LEFT JOIN usuario_conjuntos ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                    LEFT JOIN conjuntos ed ON ed.id = ue.conjunto_id
                    WHERE u.activo = {activo_filter}
                      AND (
                        eu.id = %s
                        OR ue.conjunto_id = %s
                      )
                    ORDER BY u.id, u.nombre
                """, join_params + [conjunto_id, conjunto_id])
            elif rol:
                cur.execute(
                    f"SELECT id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp "
                    f"FROM usuarios WHERE rol = %s AND activo = {activo_filter} ORDER BY nombre",
                    (rol,),
                )
            else:
                cur.execute(
                    f"SELECT id, nombre, email, cedula, telefono, rol, activo, notif_sistema, notif_email, notif_whatsapp "
                    f"FROM usuarios WHERE activo = {activo_filter} ORDER BY nombre"
                )
            return cur.fetchall()


# ── Mi Apartamento — debe estar ANTES de /{usuario_id} para que FastAPI no lo consuma ──

@router.get("/mi-apto")
def get_mi_apto(usuario_id: int, unidad_id: Optional[int] = None, u: dict = Depends(get_current_user)):
    """Datos completos del apartamento del residente. unidad_id selecciona cuál unidad usar."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.id AS ocupacion_id, o.tipo, o.fecha_inicio,
                       un.id AS unidad_id, un.numero AS unidad_numero,
                       t.nombre AS torre_nombre, t.numero AS torre_numero,
                       c.id AS conjunto_id, c.nombre AS conjunto_nombre
                FROM ocupaciones o
                JOIN unidades un ON un.id = o.unidad_id
                LEFT JOIN torres t ON t.id = un.torre_id
                LEFT JOIN conjuntos c ON c.id = t.conjunto_id
                WHERE o.usuario_id = %s AND o.activo = TRUE
                ORDER BY o.fecha_inicio DESC
            """, (usuario_id,))
            ocupaciones = [dict(r) for r in cur.fetchall()]

            cohabitantes: list = []
            personas_autorizadas: list = []

            if ocupaciones:
                # Si se pasa unidad_id explícita, usarla; si no, la primera
                unidad_activa = unidad_id if unidad_id else ocupaciones[0]["unidad_id"]
                cur.execute("""
                    SELECT u.id, u.nombre, u.email, u.telefono, o.tipo, o.id AS ocupacion_id
                    FROM ocupaciones o
                    JOIN usuarios u ON u.id = o.usuario_id
                    WHERE o.unidad_id = %s AND o.activo = TRUE AND o.usuario_id != %s AND u.activo = TRUE
                    ORDER BY u.nombre
                """, (unidad_activa, usuario_id))
                cohabitantes = [dict(r) for r in cur.fetchall()]

                cur.execute("""
                    SELECT * FROM personas_autorizadas
                    WHERE unidad_id = %s AND activo = TRUE
                    ORDER BY nombre
                """, (unidad_activa,))
                personas_autorizadas = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT id, placa, marca, modelo, color, tipo, combustible, tiene_cargador, potencia_cargador_kw
                FROM vehiculos WHERE usuario_id = %s AND activo = TRUE ORDER BY placa
            """, (usuario_id,))
            vehiculos = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT id, nombre, especie, raza, color
                FROM mascotas WHERE usuario_id = %s AND activo = TRUE ORDER BY nombre
            """, (usuario_id,))
            mascotas = [dict(r) for r in cur.fetchall()]

            return {
                "ocupaciones": ocupaciones,
                "cohabitantes": cohabitantes,
                "personas_autorizadas": personas_autorizadas,
                "vehiculos": vehiculos,
                "mascotas": mascotas,
            }


@router.get("/{usuario_id}")
def get_usuario(usuario_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                       u.notif_sistema, u.notif_email, u.notif_whatsapp,
                       u.eps, u.aseguradora_riesgo
                FROM usuarios u
                WHERE u.id = %s
            """, (usuario_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            result = dict(row)

            # All ocupaciones — multiple allowed per unit
            cur.execute("""
                SELECT o.id, o.unidad_id, o.tipo, o.fecha_inicio,
                       un.numero as unidad_numero,
                       t.nombre as torre_nombre,
                       e.nombre as conjunto_nombre, e.id as conjunto_id
                FROM ocupaciones o
                JOIN unidades un ON un.id = o.unidad_id
                LEFT JOIN torres t ON t.id = un.torre_id
                LEFT JOIN conjuntos e ON e.id = t.conjunto_id
                WHERE o.usuario_id = %s AND o.activo = TRUE
                ORDER BY o.fecha_inicio DESC
            """, (usuario_id,))
            ocupaciones = [dict(r) for r in cur.fetchall()]
            result["ocupaciones"] = ocupaciones

            # Backward-compat flat fields from first ocupacion
            if ocupaciones:
                first = ocupaciones[0]
                result["tipo_ocupacion"] = first["tipo"]
                result["unidad_numero"] = first["unidad_numero"]
                result["conjunto_nombre"] = first["conjunto_nombre"]
                result["conjunto_id"] = first["conjunto_id"]
                result["fecha_inicio"] = first["fecha_inicio"]
            else:
                result["tipo_ocupacion"] = None
                result["unidad_numero"] = None
                result["conjunto_nombre"] = None
                result["conjunto_id"] = None
                result["fecha_inicio"] = None

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
def create_usuario(data: UsuarioCreate, current_user: dict = Depends(get_current_user)):
    org_id = current_user.get("organizacion_id")
    password_hash = None
    if data.password:
        try:
            from passlib.context import CryptContext
            password_hash = CryptContext(schemes=["bcrypt"], deprecated="auto").hash(data.password)
        except ImportError:
            pass

    _RETURN_COLS = (
        "id, nombre, email, cedula, tipo_documento, telefono, rol, activo, "
        "notif_sistema, notif_email, notif_whatsapp"
    )

    with get_db() as conn:
        with conn.cursor() as cur:
            # Si el email ya existe, reutilizar el usuario (una persona puede pertenecer
            # a múltiples conjuntos; la cédula dejó de ser clave única).
            if data.email:
                cur.execute(
                    f"SELECT {_RETURN_COLS} FROM usuarios WHERE email = %s",
                    (data.email,),
                )
                existing = cur.fetchone()
                if existing:
                    if data.conjunto_id:
                        cur.execute(
                            "INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo) "
                            "VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                            (existing["id"], data.conjunto_id),
                        )
                    return existing

            # Usuario nuevo
            cur.execute(
                f"INSERT INTO usuarios (nombre, cedula, tipo_documento, email, telefono, rol, password_hash, organizacion_id) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING {_RETURN_COLS}",
                (data.nombre, data.cedula, data.tipo_documento, data.email,
                 data.telefono, data.rol, password_hash, org_id),
            )
            new_user = cur.fetchone()
            if data.conjunto_id:
                cur.execute(
                    "INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo) "
                    "VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                    (new_user["id"], data.conjunto_id),
                )
            return new_user


@router.put("/{usuario_id}")
def update_usuario(usuario_id: int, data: UsuarioUpdate):
    fields, values = [], []
    if data.nombre is not None:
        fields.append("nombre = %s"); values.append(data.nombre)
    if data.cedula is not None:
        fields.append("cedula = %s"); values.append(data.cedula)
    if data.tipo_documento is not None:
        fields.append("tipo_documento = %s"); values.append(data.tipo_documento)
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
            # Only deactivate if this same user already has this tipo on this unit
            # (allows multiple propietarios per unit)
            cur.execute(
                "UPDATE ocupaciones SET activo = FALSE WHERE unidad_id = %s AND tipo = %s AND usuario_id = %s",
                (data.unidad_id, data.tipo, data.usuario_id),
            )
            cur.execute(
                "INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio) VALUES (%s,%s,%s,%s) RETURNING *",
                (data.unidad_id, data.usuario_id, data.tipo, data.fecha_inicio),
            )
            return cur.fetchone()


@router.delete("/ocupaciones/{ocup_id}", status_code=204)
def delete_ocupacion(ocup_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE ocupaciones SET activo = FALSE WHERE id = %s", (ocup_id,))


