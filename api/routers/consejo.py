from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class ConsejoMiembroCreate(BaseModel):
    nombre: str
    cargo: str
    tipo: str = "activo"   # activo | suplente


class ConsejoMiembroUpdate(BaseModel):
    nombre: Optional[str] = None
    cargo: Optional[str] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None


@router.get("/{edificio_id}")
def list_miembros(edificio_id: int, incluir_inactivos: bool = False):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = "SELECT * FROM consejo_miembros WHERE edificio_id = %s"
            params = [edificio_id]
            if not incluir_inactivos:
                query += " AND activo = TRUE"
            query += " ORDER BY tipo, cargo, nombre"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/{edificio_id}", status_code=201)
def create_miembro(edificio_id: int, data: ConsejoMiembroCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO consejo_miembros (edificio_id, nombre, cargo, tipo)
                VALUES (%s,%s,%s,%s) RETURNING *
            """, (edificio_id, data.nombre, data.cargo, data.tipo))
            return cur.fetchone()


@router.patch("/miembros/{miembro_id}")
def update_miembro(miembro_id: int, data: ConsejoMiembroUpdate):
    with get_db() as conn:
        with conn.cursor() as cur:
            fields, params = [], []
            if data.nombre is not None:
                fields.append("nombre = %s"); params.append(data.nombre)
            if data.cargo is not None:
                fields.append("cargo = %s"); params.append(data.cargo)
            if data.tipo is not None:
                fields.append("tipo = %s"); params.append(data.tipo)
            if data.activo is not None:
                fields.append("activo = %s"); params.append(data.activo)
            if not fields:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")
            params.append(miembro_id)
            cur.execute(
                f"UPDATE consejo_miembros SET {', '.join(fields)} WHERE id = %s RETURNING *",
                params,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Miembro no encontrado")
            return row


@router.delete("/miembros/{miembro_id}")
def delete_miembro(miembro_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE consejo_miembros SET activo = FALSE WHERE id = %s RETURNING id",
                (miembro_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Miembro no encontrado")
    return {"message": "Miembro desactivado"}
