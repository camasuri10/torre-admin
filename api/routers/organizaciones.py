"""Organizaciones — gestión de tenants por parte del Backoffice."""
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext

from db import get_db
from routers.auth import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _safe(v):
    return float(v) if isinstance(v, Decimal) else v


def _require_backoffice(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("backoffice", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo para usuarios Backoffice")
    return current_user


class OrgCreate(BaseModel):
    nombre: str
    nit: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    pais: str = "Colombia"


class OrgUpdate(BaseModel):
    nombre: Optional[str] = None
    nit: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    pais: Optional[str] = None
    activo: Optional[bool] = None


class AsignarSARequest(BaseModel):
    usuario_id: int


class CrearSARequest(BaseModel):
    nombre: str
    email: str
    password: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None


def _org_stats(cur, org_id: int) -> dict:
    def _count(sql, params=()):
        try:
            cur.execute(sql, params)
            return cur.fetchone()["count"]
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT _org_stats")
            return 0

    cur.execute("SAVEPOINT _org_stats")

    num_conjuntos = _count("SELECT COUNT(*) FROM conjuntos WHERE organizacion_id = %s", (org_id,))
    cur.execute("SAVEPOINT _org_stats")

    num_superadmins = _count(
        "SELECT COUNT(*) FROM organizacion_superadmins WHERE organizacion_id = %s AND activo = TRUE",
        (org_id,),
    )
    cur.execute("SAVEPOINT _org_stats")

    num_usuarios = _count(
        "SELECT COUNT(*) FROM usuarios WHERE organizacion_id = %s AND activo = TRUE",
        (org_id,),
    )
    cur.execute("SAVEPOINT _org_stats")

    num_conjuntos_con_modulos = _count(
        """SELECT COUNT(DISTINCT em.conjunto_id) FROM conjunto_modulos em
           JOIN conjuntos e ON e.id = em.conjunto_id
           WHERE e.organizacion_id = %s AND em.activo = TRUE""",
        (org_id,),
    )

    return {
        "num_conjuntos": num_conjuntos,
        "num_superadmins": num_superadmins,
        "num_usuarios": num_usuarios,
        "num_conjuntos_con_modulos": num_conjuntos_con_modulos,
    }


@router.get("")
def list_orgs(_: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM organizaciones ORDER BY nombre")
            orgs = [dict(r) for r in cur.fetchall()]
            for org in orgs:
                org.update(_org_stats(cur, org["id"]))
    return {"organizaciones": orgs}


@router.post("")
def create_org(data: OrgCreate, _: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            if data.nit:
                cur.execute("SELECT id FROM organizaciones WHERE nit = %s", (data.nit,))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Ya existe una organización con ese NIT")

            cur.execute(
                """INSERT INTO organizaciones (nombre, nit, email, telefono, direccion, ciudad, pais)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (data.nombre, data.nit, data.email, data.telefono,
                 data.direccion, data.ciudad, data.pais),
            )
            org = dict(cur.fetchone())
    return {"organizacion": org}


@router.get("/{org_id}")
def get_org(org_id: int, _: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM organizaciones WHERE id = %s", (org_id,))
            org = cur.fetchone()
            if not org:
                raise HTTPException(status_code=404, detail="Organización no encontrada")
            org = dict(org)
            org.update(_org_stats(cur, org_id))

            # Assigned superadmins
            cur.execute(
                """SELECT u.id, u.nombre, u.email, u.telefono, u.cedula, u.activo,
                          os.activo AS asignacion_activa, os.created_at AS asignado_en
                   FROM usuarios u
                   JOIN organizacion_superadmins os ON os.usuario_id = u.id
                   WHERE os.organizacion_id = %s
                   ORDER BY u.nombre""",
                (org_id,),
            )
            org["superadmins"] = [dict(r) for r in cur.fetchall()]

            # Buildings
            cur.execute(
                "SELECT e.id, e.nombre, e.direccion, e.pisos FROM conjuntos e WHERE e.organizacion_id = %s ORDER BY e.nombre",
                (org_id,),
            )
            org["conjuntos"] = [dict(r) for r in cur.fetchall()]

    return {"organizacion": org}


@router.put("/{org_id}")
def update_org(org_id: int, data: OrgUpdate, _: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM organizaciones WHERE id = %s", (org_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Organización no encontrada")

            if data.nit:
                cur.execute("SELECT id FROM organizaciones WHERE nit = %s AND id != %s", (data.nit, org_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Ya existe una organización con ese NIT")

            fields = {k: v for k, v in data.dict().items() if v is not None}
            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")

            set_clause = ", ".join(f"{k} = %s" for k in fields)
            values = list(fields.values()) + [org_id]
            cur.execute(f"UPDATE organizaciones SET {set_clause} WHERE id = %s RETURNING *", values)
            org = dict(cur.fetchone())
    return {"organizacion": org}


@router.post("/{org_id}/superadmins")
def asignar_superadmin(org_id: int, data: AsignarSARequest, _: dict = Depends(_require_backoffice)):
    """Assign an existing superadmin user to an organization."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM organizaciones WHERE id = %s AND activo = TRUE", (org_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Organización no encontrada")

            cur.execute(
                "SELECT id, nombre, email FROM usuarios WHERE id = %s AND rol = 'superadmin' AND activo = TRUE",
                (data.usuario_id,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="SuperAdmin no encontrado")

            cur.execute(
                """INSERT INTO organizacion_superadmins (organizacion_id, usuario_id, activo)
                   VALUES (%s, %s, TRUE)
                   ON CONFLICT (organizacion_id, usuario_id) DO UPDATE SET activo = TRUE
                   RETURNING *""",
                (org_id, data.usuario_id),
            )
    return {"mensaje": f"SuperAdmin asignado a la organización"}


@router.post("/{org_id}/superadmins/crear")
def crear_y_asignar_superadmin(org_id: int, data: CrearSARequest, _: dict = Depends(_require_backoffice)):
    """Create a new superadmin user and assign them to an organization."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM organizaciones WHERE id = %s AND activo = TRUE", (org_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Organización no encontrada")

            cur.execute("SELECT id FROM usuarios WHERE email = %s", (data.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

            password_hash = pwd_context.hash(data.password)
            cur.execute(
                """INSERT INTO usuarios (nombre, cedula, email, telefono, rol, password_hash, organizacion_id)
                   VALUES (%s, %s, %s, %s, 'superadmin', %s, NULL) RETURNING id, nombre, email""",
                (data.nombre, data.cedula, data.email, data.telefono, password_hash),
            )
            new_user = dict(cur.fetchone())

            cur.execute(
                "INSERT INTO organizacion_superadmins (organizacion_id, usuario_id) VALUES (%s, %s)",
                (org_id, new_user["id"]),
            )
    return {"usuario": new_user, "mensaje": "SuperAdmin creado y asignado"}


@router.delete("/{org_id}/superadmins/{usuario_id}")
def quitar_superadmin(org_id: int, usuario_id: int, _: dict = Depends(_require_backoffice)):
    """Remove a superadmin from an organization."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE organizacion_superadmins SET activo = FALSE WHERE organizacion_id = %s AND usuario_id = %s",
                (org_id, usuario_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return {"mensaje": "SuperAdmin removido de la organización"}


@router.get("/superadmins/disponibles")
def listar_superadmins_disponibles(_: dict = Depends(_require_backoffice)):
    """List all superadmin users that can be assigned to organizations."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT u.id, u.nombre, u.email, u.telefono,
                          COALESCE(json_agg(json_build_object('id', o.id, 'nombre', o.nombre))
                              FILTER (WHERE o.id IS NOT NULL), '[]') AS organizaciones
                   FROM usuarios u
                   LEFT JOIN organizacion_superadmins os ON os.usuario_id = u.id AND os.activo = TRUE
                   LEFT JOIN organizaciones o ON o.id = os.organizacion_id
                   WHERE u.rol = 'superadmin' AND u.activo = TRUE
                   GROUP BY u.id, u.nombre, u.email, u.telefono
                   ORDER BY u.nombre""",
            )
            users = [dict(r) for r in cur.fetchall()]
    return {"superadmins": users}
