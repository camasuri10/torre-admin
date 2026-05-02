"""Super Admin Router — gestión de edificios, conjuntos, módulos, administradores y staff."""
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
    conjunto_id: Optional[int] = None
    numero_torre: Optional[str] = None


class EdificioUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    unidades: Optional[int] = None
    pisos: Optional[int] = None
    conjunto_id: Optional[int] = None
    numero_torre: Optional[str] = None


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
    rol: str = "administrador"  # administrador | portero | servicios
    edificio_ids: list[int]


class AdminEdificiosUpdate(BaseModel):
    edificio_ids: list[int]


# ── Edificios ─────────────────────────────────────────────────────────────────

@router.get("/edificios")
def list_edificios(conjunto_id: Optional[int] = None, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT e.id, e.nombre, e.direccion, e.unidades, e.pisos,
                       e.conjunto_id, e.numero_torre, e.created_at,
                       c.nombre as conjunto_nombre,
                       COUNT(CASE WHEN em.activo = TRUE THEN 1 END) AS modulos_activos
                FROM edificios e
                LEFT JOIN conjuntos c ON c.id = e.conjunto_id
                LEFT JOIN edificio_modulos em ON em.edificio_id = e.id
                WHERE 1=1
            """
            params = []
            if conjunto_id is not None:
                query += " AND e.conjunto_id = %s"
                params.append(conjunto_id)
            query += " GROUP BY e.id, c.nombre ORDER BY e.nombre"
            cur.execute(query, params)
            return {"edificios": [dict(r) for r in cur.fetchall()]}


@router.post("/edificios", status_code=201)
def create_edificio(body: EdificioCreate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, unidades, pisos, conjunto_id, numero_torre) "
                "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                (body.nombre, body.direccion, body.unidades, body.pisos, body.conjunto_id, body.numero_torre),
            )
            edificio_id = cur.fetchone()["id"]

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
    for field, val in body.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)

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


# ── Administradores y Staff ───────────────────────────────────────────────────

@router.get("/admins")
def list_admins(sa=Depends(_require_superadmin)):
    """Lista administradores de edificios."""
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


@router.get("/staff")
def list_staff(sa=Depends(_require_superadmin)):
    """Lista staff de servicios y porteros con sus edificios asignados."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS edificios
                FROM usuarios u
                LEFT JOIN usuario_edificios ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN edificios e ON e.id = ue.edificio_id
                WHERE u.rol IN ('servicios', 'portero')
                GROUP BY u.id
                ORDER BY u.rol, u.nombre
            """)
            return {"staff": [dict(r) for r in cur.fetchall()]}


@router.post("/admins", status_code=201)
def create_admin(body: AdminCreate, sa=Depends(_require_superadmin)):
    allowed_roles = ("administrador", "portero", "servicios")
    if body.rol not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Rol debe ser uno de: {', '.join(allowed_roles)}")

    password_hash = pwd_context.hash(body.password)
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "INSERT INTO usuarios (nombre, email, cedula, telefono, rol, password_hash) "
                    "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (body.nombre, body.email, body.cedula, body.telefono, body.rol, password_hash),
                )
            except Exception:
                raise HTTPException(status_code=400, detail="El email o cédula ya existe")

            user_id = cur.fetchone()["id"]
            for eid in body.edificio_ids:
                cur.execute(
                    "INSERT INTO usuario_edificios (usuario_id, edificio_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                    (user_id, eid),
                )

            # Porteros también se registran en la tabla guardias
            if body.rol == "portero" and body.edificio_ids:
                for eid in body.edificio_ids:
                    cur.execute(
                        "INSERT INTO guardias (usuario_id, edificio_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                        (user_id, eid),
                    )

    return {"id": user_id, "message": f"{body.rol.capitalize()} creado"}


@router.put("/admins/{admin_id}/edificios")
def update_admin_edificios(admin_id: int, body: AdminEdificiosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, rol FROM usuarios WHERE id = %s AND rol IN ('administrador','portero','servicios')",
                (admin_id,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Usuario de staff no encontrado")

            cur.execute("UPDATE usuario_edificios SET activo = FALSE WHERE usuario_id = %s", (admin_id,))
            for eid in body.edificio_ids:
                cur.execute("""
                    INSERT INTO usuario_edificios (usuario_id, edificio_id, activo)
                    VALUES (%s, %s, TRUE)
                    ON CONFLICT (usuario_id, edificio_id) DO UPDATE SET activo = TRUE
                """, (admin_id, eid))

    return {"message": "Edificios del usuario actualizados"}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(edificio_id: Optional[int] = None, sa=Depends(_require_superadmin)):
    """Módulos más usados y transacciones por módulo."""
    with get_db() as conn:
        with conn.cursor() as cur:
            params = []
            where = "WHERE 1=1"
            if edificio_id:
                where += " AND mu.edificio_id = %s"
                params.append(edificio_id)

            cur.execute(f"""
                SELECT mu.modulo_clave,
                       m.nombre as modulo_nombre,
                       COUNT(*) as total_usos,
                       COUNT(DISTINCT mu.usuario_id) as usuarios_unicos,
                       MAX(mu.fecha) as ultimo_uso
                FROM modulos_uso mu
                LEFT JOIN modulos m ON m.clave = mu.modulo_clave
                {where}
                GROUP BY mu.modulo_clave, m.nombre
                ORDER BY total_usos DESC
                LIMIT 10
            """, params)
            top_modulos = [dict(r) for r in cur.fetchall()]

            # Usos en los últimos 7 días por día
            cur.execute(f"""
                SELECT DATE(mu.fecha) as dia,
                       mu.modulo_clave,
                       COUNT(*) as usos
                FROM modulos_uso mu
                {where.replace('WHERE', 'WHERE mu.fecha >= NOW() - INTERVAL \'7 days\' AND')}
                GROUP BY dia, mu.modulo_clave
                ORDER BY dia DESC, usos DESC
            """, params)
            usos_recientes = [dict(r) for r in cur.fetchall()]

    return {
        "top_modulos": top_modulos,
        "usos_recientes": usos_recientes,
    }


# ── Overview stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM edificios")
            total_edificios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM conjuntos")
            total_conjuntos = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = TRUE")
            total_admins = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('servicios','portero') AND activo = TRUE")
            total_staff = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE activo = TRUE")
            total_usuarios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM modulos")
            total_modulos = cur.fetchone()["total"]

    return {
        "total_edificios": total_edificios,
        "total_conjuntos": total_conjuntos,
        "total_admins": total_admins,
        "total_staff": total_staff,
        "total_usuarios": total_usuarios,
        "total_modulos": total_modulos,
    }
