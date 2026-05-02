"""Proveedores router — gestión de proveedores de mantenimiento."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class ProveedorCreate(BaseModel):
    edificio_id: int
    nombre: str
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    nit: Optional[str] = None


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    nit: Optional[str] = None


@router.get("")
def list_proveedores(edificio_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            if edificio_id:
                cur.execute("""
                    SELECT p.*, e.nombre as edificio_nombre
                    FROM proveedores p
                    JOIN edificios e ON e.id = p.edificio_id
                    WHERE p.edificio_id = %s AND p.activo = TRUE
                    ORDER BY p.nombre
                """, (edificio_id,))
            else:
                cur.execute("""
                    SELECT p.*, e.nombre as edificio_nombre
                    FROM proveedores p
                    JOIN edificios e ON e.id = p.edificio_id
                    WHERE p.activo = TRUE
                    ORDER BY e.nombre, p.nombre
                """)
            return {"proveedores": [dict(r) for r in cur.fetchall()]}


@router.post("", status_code=201)
def create_proveedor(data: ProveedorCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM edificios WHERE id = %s", (data.edificio_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            cur.execute("""
                INSERT INTO proveedores (edificio_id, nombre, contacto, telefono, email, especialidad, nit)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.edificio_id, data.nombre, data.contacto, data.telefono,
                  data.email, data.especialidad, data.nit))
            return dict(cur.fetchone())


@router.put("/{proveedor_id}")
def update_proveedor(proveedor_id: int, data: ProveedorUpdate, current_user: dict = Depends(get_current_user)):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(proveedor_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE proveedores SET {', '.join(fields)} WHERE id = %s AND activo = TRUE RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")
            return dict(row)


@router.delete("/{proveedor_id}", status_code=204)
def delete_proveedor(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE proveedores SET activo = FALSE WHERE id = %s", (proveedor_id,))
