"""Super Admin Router — gestión de edificios, módulos y administradores."""
from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from db import get_db
from routers.auth import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso restringido a Super Admin")
    return current_user


# ── Modelos ───────────────────────────────────────────────────────────────────

class EdificioCreate(BaseModel):
    nombre: str
    direccion: str
    unidades: int = 0
    pisos: int = 1


class EdificioUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    unidades: Optional[int] = None
    pisos: Optional[int] = None


class ModuloToggle(BaseModel):
    clave: str
    activo: bool


class ModulosUpdate(BaseModel):
    modulos: list[ModuloToggle]


class AdminCreate(BaseModel):
    nombre: str
    email: str
    password: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    edificio_ids: list[int]


class AdminEdificiosUpdate(BaseModel):
    edificio_ids: list[int]


# ── Edificios ─────────────────────────────────────────────────────────────────

@router.get("/edificios")
def list_edificios(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, e.nombre, e.direccion, e.unidades, e.pisos, e.created_at,
                       COUNT(CASE WHEN em.activo = TRUE THEN 1 END) AS modulos_activos
                FROM edificios e
                LEFT JOIN edificio_modulos em ON em.edificio_id = e.id
                GROUP BY e.id
                ORDER BY e.nombre
            """)
            return {"edificios": [dict(r) for r in cur.fetchall()]}


@router.post("/edificios", status_code=201)
def create_edificio(body: EdificioCreate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, unidades, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (body.nombre, body.direccion, body.unidades, body.pisos),
            )
            edificio_id = cur.fetchone()["id"]

            # Activar todos los módulos para el nuevo edificio
            cur.execute("SELECT id FROM modulos")
            for row in cur.fetchall():
                cur.execute(
                    "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s,%s,TRUE)",
                    (edificio_id, row["id"]),
                )

    return {"id": edificio_id, "message": "Edificio creado con todos los módulos activos"}


@router.put("/edificios/{edificio_id}")
def update_edificio(edificio_id: int, body: EdificioUpdate, sa=Depends(_require_superadmin)):
    fields, values = [], []
    if body.nombre is not None:
        fields.append("nombre = %s"); values.append(body.nombre)
    if body.direccion is not None:
        fields.append("direccion = %s"); values.append(body.direccion)
    if body.unidades is not None:
        fields.append("unidades = %s"); values.append(body.unidades)
    if body.pisos is not None:
        fields.append("pisos = %s"); values.append(body.pisos)

    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")

    values.append(edificio_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE edificios SET {', '.join(fields)} WHERE id = %s", values)

    return {"message": "Edificio actualizado"}


# ── Módulos por edificio ───────────────────────────────────────────────────────

@router.get("/edificios/{edificio_id}/modulos")
def get_modulos(edificio_id: int, current_user: dict = Depends(get_current_user)):
    """Accessible by any authenticated user of the same building, or superadmin."""
    user_rol = current_user.get("rol")
    user_edificio = current_user.get("edificio_id")

    if user_rol != "superadmin" and user_edificio != edificio_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este edificio")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT m.clave, m.nombre, m.icono,
                       COALESCE(em.activo, FALSE) AS activo
                FROM modulos m
                LEFT JOIN edificio_modulos em
                       ON em.modulo_id = m.id AND em.edificio_id = %s
                ORDER BY m.id
            """, (edificio_id,))
            return {"modulos": [dict(r) for r in cur.fetchall()]}


@router.put("/edificios/{edificio_id}/modulos")
def update_modulos(edificio_id: int, body: ModulosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            for m in body.modulos:
                cur.execute("SELECT id FROM modulos WHERE clave = %s", (m.clave,))
                row = cur.fetchone()
                if not row:
                    continue
                modulo_id = row["id"]
                cur.execute("""
                    INSERT INTO edificio_modulos (edificio_id, modulo_id, activo)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (edificio_id, modulo_id) DO UPDATE SET activo = EXCLUDED.activo
                """, (edificio_id, modulo_id, m.activo))

    return {"message": "Módulos actualizados"}


# ── Administradores ───────────────────────────────────────────────────────────

@router.get("/admins")
def list_admins(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.activo, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS edificios
                FROM usuarios u
                LEFT JOIN usuario_edificios ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN edificios e ON e.id = ue.edificio_id
                WHERE u.rol = 'administrador'
                GROUP BY u.id
                ORDER BY u.nombre
            """)
            return {"admins": [dict(r) for r in cur.fetchall()]}


@router.post("/admins", status_code=201)
def create_admin(body: AdminCreate, sa=Depends(_require_superadmin)):
    password_hash = pwd_context.hash(body.password)
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "INSERT INTO usuarios (nombre, email, cedula, telefono, rol, password_hash) VALUES (%s,%s,%s,%s,'administrador',%s) RETURNING id",
                    (body.nombre, body.email, body.cedula, body.telefono, password_hash),
                )
            except Exception:
                raise HTTPException(status_code=400, detail="El email o cédula ya existe")

            admin_id = cur.fetchone()["id"]
            for eid in body.edificio_ids:
                cur.execute(
                    "INSERT INTO usuario_edificios (usuario_id, edificio_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                    (admin_id, eid),
                )

    return {"id": admin_id, "message": "Administrador creado"}


@router.put("/admins/{admin_id}/edificios")
def update_admin_edificios(admin_id: int, body: AdminEdificiosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE id = %s AND rol = 'administrador'", (admin_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Administrador no encontrado")

            # Soft-delete all current assignments, then re-assign
            cur.execute("UPDATE usuario_edificios SET activo = FALSE WHERE usuario_id = %s", (admin_id,))
            for eid in body.edificio_ids:
                cur.execute("""
                    INSERT INTO usuario_edificios (usuario_id, edificio_id, activo)
                    VALUES (%s, %s, TRUE)
                    ON CONFLICT (usuario_id, edificio_id) DO UPDATE SET activo = TRUE
                """, (admin_id, eid))

    return {"message": "Edificios del administrador actualizados"}


# ── Overview stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM edificios")
            total_edificios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = TRUE")
            total_admins = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE activo = TRUE")
            total_usuarios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM modulos")
            total_modulos = cur.fetchone()["total"]

    return {
        "total_edificios": total_edificios,
        "total_admins": total_admins,
        "total_usuarios": total_usuarios,
        "total_modulos": total_modulos,
    }
