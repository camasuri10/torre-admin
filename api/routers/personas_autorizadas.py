"""Módulo de Personas Autorizadas — personal de aseo, familiares y otros autorizados para acceder a la unidad."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class PersonaAutorizadaCreate(BaseModel):
    unidad_id: int
    nombre: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    tipo: str = "aseo"  # familiar | aseo | otro


class PersonaAutorizadaUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    tipo: Optional[str] = None


@router.get("")
def list_personas_autorizadas(unidad_id: int, u: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM personas_autorizadas WHERE unidad_id = %s AND activo = TRUE ORDER BY nombre",
                (unidad_id,),
            )
            return cur.fetchall()


@router.post("", status_code=201)
def create_persona_autorizada(body: PersonaAutorizadaCreate, u: dict = Depends(get_current_user)):
    if body.tipo not in ("familiar", "aseo", "otro"):
        raise HTTPException(400, "Tipo inválido: usar familiar, aseo u otro")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO personas_autorizadas (unidad_id, nombre, cedula, telefono, tipo)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING *
            """, (body.unidad_id, body.nombre, body.cedula, body.telefono, body.tipo))
            return dict(cur.fetchone())


@router.put("/{persona_id}")
def update_persona_autorizada(persona_id: int, body: PersonaAutorizadaUpdate, u: dict = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        return {"message": "Sin cambios"}
    fields = [f"{k} = %s" for k in data]
    values = list(data.values()) + [persona_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE personas_autorizadas SET {', '.join(fields)} WHERE id = %s AND activo = TRUE RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Persona no encontrada")
            return dict(row)


@router.delete("/{persona_id}", status_code=204)
def delete_persona_autorizada(persona_id: int, u: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE personas_autorizadas SET activo = FALSE WHERE id = %s", (persona_id,))
