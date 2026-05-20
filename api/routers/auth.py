"""TorreAdmin Auth Router — JWT-based authentication with multi-org and multi-building support."""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from db import get_db

SECRET_KEY = os.environ.get("JWT_SECRET", "torre-admin-secret-2026-poc-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class BuildingSelectRequest(BaseModel):
    user_id: int
    edificio_id: int


class OrgSelectRequest(BaseModel):
    user_id: int
    organizacion_id: int


def create_token(
    user: dict,
    edificio_id: Optional[int],
    organizacion_id: Optional[int] = None,
    organizacion_nombre: Optional[str] = None,
) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "nombre": user["nombre"],
        "rol": user["rol"],
        "edificio_id": edificio_id,
        "organizacion_id": organizacion_id,
        "organizacion_nombre": organizacion_nombre,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


def _get_user_orgs(cur, user_id: int) -> list:
    """Returns [{id, nombre}] of organizations the SA belongs to."""
    cur.execute(
        """SELECT o.id, o.nombre FROM organizaciones o
           JOIN organizacion_superadmins os ON os.organizacion_id = o.id
           WHERE os.usuario_id = %s AND os.activo = TRUE AND o.activo = TRUE
           ORDER BY o.nombre""",
        (user_id,),
    )
    return [dict(r) for r in cur.fetchall()]


def _get_user_edificios(cur, user: dict, org_id: Optional[int] = None) -> list:
    """Returns [{id, nombre}] of buildings the user belongs to."""
    rol = user["rol"]
    uid = user["id"]

    if rol == "superadmin":
        # SA only sees buildings within their active organization
        if not org_id:
            return []
        cur.execute(
            "SELECT id, nombre FROM edificios WHERE organizacion_id = %s ORDER BY nombre",
            (org_id,),
        )
        return [dict(r) for r in cur.fetchall()]

    if rol == "backoffice":
        if org_id:
            cur.execute(
                "SELECT id, nombre FROM edificios WHERE organizacion_id = %s ORDER BY nombre",
                (org_id,),
            )
        else:
            cur.execute("SELECT id, nombre FROM edificios ORDER BY nombre")
        return [dict(r) for r in cur.fetchall()]

    if rol in ("administrador", "portero", "servicios"):
        cur.execute(
            """SELECT e.id, e.nombre FROM edificios e
               JOIN usuario_edificios ue ON ue.edificio_id = e.id
               WHERE ue.usuario_id = %s AND ue.activo = TRUE
               ORDER BY e.nombre""",
            (uid,),
        )
        return [dict(r) for r in cur.fetchall()]

    # propietario / inquilino — via torres
    cur.execute(
        """SELECT DISTINCT e.id, e.nombre FROM edificios e
           JOIN torres t ON t.edificio_id = e.id
           JOIN unidades u ON u.torre_id = t.id
           JOIN ocupaciones o ON o.unidad_id = u.id
           WHERE o.usuario_id = %s AND o.activo = TRUE
           ORDER BY e.nombre""",
        (uid,),
    )
    return [dict(r) for r in cur.fetchall()]


@router.post("/login")
def login(data: LoginRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM usuarios WHERE email = %s AND activo = TRUE",
                (data.email,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="Credenciales inválidas")

            if not user.get("password_hash"):
                raise HTTPException(status_code=401, detail="Credenciales inválidas")

            if not pwd_context.verify(data.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Credenciales inválidas")

            user = dict(user)

            # Backoffice: platform-level, no org, direct access
            if user["rol"] == "backoffice":
                token = create_token(user, None, None, None)
                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "user": {
                        "id": user["id"],
                        "nombre": user["nombre"],
                        "email": user["email"],
                        "rol": user["rol"],
                        "edificio_id": None,
                        "edificio_nombre": "Todos",
                        "organizacion_id": None,
                        "organizacion_nombre": None,
                    },
                    "edificio": None,
                }

            # SuperAdmin: check org assignments
            if user["rol"] == "superadmin":
                orgs = _get_user_orgs(cur, user["id"])
                if not orgs:
                    raise HTTPException(status_code=400, detail="SuperAdmin sin organización asignada. Contacta al Backoffice.")

                user_info = {
                    "id": user["id"],
                    "nombre": user["nombre"],
                    "email": user["email"],
                    "rol": user["rol"],
                }

                if len(orgs) == 1:
                    org = orgs[0]
                    token = create_token(user, None, org["id"], org["nombre"])
                    return {
                        "access_token": token,
                        "token_type": "bearer",
                        "user": {
                            **user_info,
                            "edificio_id": None,
                            "edificio_nombre": "Todos",
                            "organizacion_id": org["id"],
                            "organizacion_nombre": org["nombre"],
                        },
                        "edificio": None,
                    }

                # Multiple orgs — frontend must call /seleccionar-organizacion
                return {
                    "requires_org_selection": True,
                    "organizaciones": orgs,
                    "user_temp": user_info,
                }

            # Regular users (administrador, portero, servicios, propietario, inquilino)
            org_id = user.get("organizacion_id")
            org_nombre = None
            if org_id:
                cur.execute("SELECT nombre FROM organizaciones WHERE id = %s", (org_id,))
                org_row = cur.fetchone()
                org_nombre = org_row["nombre"] if org_row else None

            edificios = _get_user_edificios(cur, user)

    if not edificios:
        raise HTTPException(status_code=400, detail="Usuario sin edificio asignado")

    user_info = {
        "id": user["id"],
        "nombre": user["nombre"],
        "email": user["email"],
        "rol": user["rol"],
        "organizacion_id": org_id,
        "organizacion_nombre": org_nombre,
    }

    if len(edificios) == 1:
        token = create_token(user, edificios[0]["id"], org_id, org_nombre)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {**user_info, "edificio_id": edificios[0]["id"], "edificio_nombre": edificios[0]["nombre"]},
            "edificio": edificios[0],
        }

    return {
        "requires_building_selection": True,
        "edificios": edificios,
        "user_temp": user_info,
    }


@router.post("/seleccionar-organizacion")
def seleccionar_organizacion(data: OrgSelectRequest):
    """SA o Backoffice selecciona el contexto de organización."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM usuarios WHERE id = %s AND activo = TRUE",
                (data.user_id,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            user = dict(user)
            rol = user["rol"]

            if rol == "superadmin":
                cur.execute(
                    """SELECT o.id, o.nombre FROM organizaciones o
                       JOIN organizacion_superadmins os ON os.organizacion_id = o.id
                       WHERE os.usuario_id = %s AND o.id = %s AND os.activo = TRUE AND o.activo = TRUE""",
                    (data.user_id, data.organizacion_id),
                )
            elif rol == "backoffice":
                cur.execute(
                    "SELECT id, nombre FROM organizaciones WHERE id = %s AND activo = TRUE",
                    (data.organizacion_id,),
                )
            else:
                raise HTTPException(status_code=403, detail="Sin permiso para seleccionar organización")

            org = cur.fetchone()
            if not org:
                raise HTTPException(status_code=403, detail="Sin acceso a esa organización")

    token = create_token(user, None, org["id"], org["nombre"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "nombre": user["nombre"],
            "email": user["email"],
            "rol": user["rol"],
            "edificio_id": None,
            "edificio_nombre": "Todos",
            "organizacion_id": org["id"],
            "organizacion_nombre": org["nombre"],
        },
    }


@router.post("/seleccionar-edificio")
def seleccionar_edificio(data: BuildingSelectRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM usuarios WHERE id = %s AND activo = TRUE",
                (data.user_id,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            user = dict(user)

            org_id = user.get("organizacion_id")
            org_nombre = None

            if user["rol"] == "superadmin":
                cur.execute(
                    "SELECT organizacion_id FROM edificios WHERE id = %s",
                    (data.edificio_id,),
                )
                e_row = cur.fetchone()
                if e_row:
                    org_id = e_row["organizacion_id"]
                    cur.execute(
                        "SELECT 1 FROM organizacion_superadmins WHERE usuario_id = %s AND organizacion_id = %s AND activo = TRUE",
                        (data.user_id, org_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=403, detail="Sin acceso a ese edificio")
            elif user["rol"] == "backoffice":
                cur.execute(
                    "SELECT organizacion_id FROM edificios WHERE id = %s",
                    (data.edificio_id,),
                )
                e_row = cur.fetchone()
                if e_row:
                    org_id = e_row.get("organizacion_id") or org_id

            if org_id:
                cur.execute("SELECT nombre FROM organizaciones WHERE id = %s", (org_id,))
                org_row = cur.fetchone()
                org_nombre = org_row["nombre"] if org_row else None

            edificios = _get_user_edificios(cur, user, org_id)

    ids = [e["id"] for e in edificios]
    if data.edificio_id not in ids:
        raise HTTPException(status_code=403, detail="Sin acceso a ese edificio")

    edificio = next(e for e in edificios if e["id"] == data.edificio_id)
    token = create_token(user, data.edificio_id, org_id, org_nombre)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "nombre": user["nombre"],
            "email": user["email"],
            "rol": user["rol"],
            "edificio_id": data.edificio_id,
            "edificio_nombre": edificio["nombre"],
            "organizacion_id": org_id,
            "organizacion_nombre": org_nombre,
        },
        "edificio": edificio,
    }


@router.post("/seleccionar-todos")
def seleccionar_todos(current_user: dict = Depends(get_current_user)):
    """SA switches to 'all buildings' context within their org."""
    if current_user.get("rol") not in ("superadmin", "backoffice"):
        raise HTTPException(status_code=403, detail="Solo para superadmin o backoffice")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM usuarios WHERE id = %s AND activo = TRUE", (int(current_user["sub"]),))
            user = dict(cur.fetchone())

    # Backoffice: vista global sin filtros. SA: todos los edificios de la org activa.
    if user["rol"] == "backoffice":
        org_id, org_nombre = None, None
    else:
        org_id = current_user.get("organizacion_id")
        org_nombre = current_user.get("organizacion_nombre")

    token = create_token(user, None, org_id, org_nombre)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "nombre": user["nombre"],
            "email": user["email"],
            "rol": user["rol"],
            "edificio_id": None,
            "edificio_nombre": "Todos",
            "organizacion_id": org_id,
            "organizacion_nombre": org_nombre,
        },
    }


@router.get("/mis-edificios")
def mis_edificios(current_user: dict = Depends(get_current_user)):
    """Returns all buildings the authenticated user belongs to."""
    user_id = int(current_user["sub"])
    rol = current_user["rol"]
    org_id = current_user.get("organizacion_id")

    with get_db() as conn:
        with conn.cursor() as cur:
            user_stub = {"id": user_id, "rol": rol}
            edificios = _get_user_edificios(cur, user_stub, org_id)

    return {"edificios": edificios}


@router.get("/mis-organizaciones")
def mis_organizaciones(current_user: dict = Depends(get_current_user)):
    """Organizaciones disponibles para SA o Backoffice."""
    rol = current_user.get("rol")
    user_id = int(current_user["sub"])
    with get_db() as conn:
        with conn.cursor() as cur:
            if rol == "superadmin":
                orgs = _get_user_orgs(cur, user_id)
            elif rol == "backoffice":
                cur.execute(
                    "SELECT id, nombre FROM organizaciones WHERE activo = TRUE ORDER BY nombre"
                )
                orgs = [dict(r) for r in cur.fetchall()]
            else:
                raise HTTPException(status_code=403, detail="Sin permiso")
    return {"organizaciones": orgs}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
