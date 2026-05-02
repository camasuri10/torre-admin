"""Mascotas router — registro de mascotas por residente."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class MascotaCreate(BaseModel):
    usuario_id: int
    nombre: str
    especie: str = "perro"  # perro | gato | ave | otro
    raza: Optional[str] = None
    color: Optional[str] = None


class MascotaUpdate(BaseModel):
    nombre: Optional[str] = None
    especie: Optional[str] = None
    raza: Optional[str] = None
    color: Optional[str] = None


@router.get("")
def list_mascotas(usuario_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            if usuario_id:
                cur.execute(
                    "SELECT m.*, u.nombre as usuario_nombre FROM mascotas m "
                    "JOIN usuarios u ON u.id = m.usuario_id "
                    "WHERE m.usuario_id = %s AND m.activo = TRUE ORDER BY m.nombre",
                    (usuario_id,),
                )
            else:
                cur.execute(
                    "SELECT m.*, u.nombre as usuario_nombre FROM mascotas m "
                    "JOIN usuarios u ON u.id = m.usuario_id "
                    "WHERE m.activo = TRUE ORDER BY u.nombre, m.nombre"
                )
            return {"mascotas": [dict(r) for r in cur.fetchall()]}


@router.post("", status_code=201)
def create_mascota(data: MascotaCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE id = %s AND activo = TRUE", (data.usuario_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            cur.execute("""
                INSERT INTO mascotas (usuario_id, nombre, especie, raza, color)
                VALUES (%s,%s,%s,%s,%s) RETURNING *
            """, (data.usuario_id, data.nombre, data.especie, data.raza, data.color))
            return dict(cur.fetchone())


@router.put("/{mascota_id}")
def update_mascota(mascota_id: int, data: MascotaUpdate, current_user: dict = Depends(get_current_user)):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(mascota_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE mascotas SET {', '.join(fields)} WHERE id = %s AND activo = TRUE RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Mascota no encontrada")
            return dict(row)


@router.delete("/{mascota_id}", status_code=204)
def delete_mascota(mascota_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE mascotas SET activo = FALSE WHERE id = %s", (mascota_id,))
