"""TorreAdmin Auth Router — JWT-based authentication with multi-building support."""
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


def create_token(user: dict, edificio_id: int) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "nombre": user["nombre"],
        "rol": user["rol"],
        "edificio_id": edificio_id,
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


def _get_user_edificios(cur, user: dict) -> list:
    """Returns [{id, nombre}] of buildings the user belongs to."""
    rol = user["rol"]
    uid = user["id"]

    if rol == "superadmin":
        cur.execute("SELECT id, nombre FROM edificios ORDER BY nombre")
        return [dict(r) for r in cur.fetchall()]

    if rol == "administrador":
        cur.execute(
            """SELECT e.id, e.nombre FROM edificios e
               JOIN usuario_edificios ue ON ue.edificio_id = e.id
               WHERE ue.usuario_id = %s AND ue.activo = TRUE
               ORDER BY e.nombre""",
            (uid,),
        )
        return [dict(r) for r in cur.fetchall()]

    if rol == "portero":
        cur.execute(
            """SELECT DISTINCT e.id, e.nombre FROM edificios e
               JOIN guardias g ON g.edificio_id = e.id
               WHERE g.usuario_id = %s AND g.activo = TRUE
               ORDER BY e.nombre""",
            (uid,),
        )
        return [dict(r) for r in cur.fetchall()]

    # propietario / inquilino
    cur.execute(
        """SELECT DISTINCT e.id, e.nombre FROM edificios e
           JOIN unidades u ON u.edificio_id = e.id
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
            edificios = _get_user_edificios(cur, user)

    if not edificios:
        raise HTTPException(status_code=400, detail="Usuario sin edificio asignado")

    user_info = {
        "id": user["id"],
        "nombre": user["nombre"],
        "email": user["email"],
        "rol": user["rol"],
    }

    if len(edificios) == 1:
        token = create_token(user, edificios[0]["id"])
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {**user_info, "edificio_id": edificios[0]["id"], "edificio_nombre": edificios[0]["nombre"]},
            "edificio": edificios[0],
        }

    # Multiple buildings — frontend must call /seleccionar-edificio
    return {
        "requires_building_selection": True,
        "edificios": edificios,
        "user_temp": user_info,
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
            edificios = _get_user_edificios(cur, user)

    ids = [e["id"] for e in edificios]
    if data.edificio_id not in ids:
        raise HTTPException(status_code=403, detail="Sin acceso a ese edificio")

    edificio = next(e for e in edificios if e["id"] == data.edificio_id)
    token = create_token(user, data.edificio_id)

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
        },
        "edificio": edificio,
    }


@router.get("/mis-edificios")
def mis_edificios(current_user: dict = Depends(get_current_user)):
    """Returns all buildings the authenticated user belongs to."""
    user_id = int(current_user["sub"])
    rol = current_user["rol"]

    with get_db() as conn:
        with conn.cursor() as cur:
            user_stub = {"id": user_id, "rol": rol}
            edificios = _get_user_edificios(cur, user_stub)

    return {"edificios": edificios}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
