"""Proveedores router — gestión de proveedores de mantenimiento."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class ProveedorCreate(BaseModel):
    edificio_id: Optional[int] = None
    conjunto_id: Optional[int] = None
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
def list_proveedores(edificio_id: Optional[int] = None, conjunto_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Cuando se filtra por edificio, expandir al conjunto completo
            if edificio_id and not conjunto_id:
                cur.execute("SELECT conjunto_id FROM edificios WHERE id = %s", (edificio_id,))
                row = cur.fetchone()
                if row and row["conjunto_id"]:
                    conjunto_id = row["conjunto_id"]

            if conjunto_id:
                cur.execute("""
                    SELECT p.*,
                           COALESCE(c.nombre, e.nombre, '') as edificio_nombre,
                           c.nombre as conjunto_nombre
                    FROM proveedores p
                    LEFT JOIN edificios e ON e.id = p.edificio_id
                    LEFT JOIN conjuntos c ON c.id = p.conjunto_id
                    WHERE p.activo = TRUE
                      AND (
                        p.conjunto_id = %s
                        OR (p.conjunto_id IS NULL AND p.edificio_id IN (
                            SELECT id FROM edificios WHERE conjunto_id = %s
                        ))
                      )
                    ORDER BY p.nombre
                """, (conjunto_id, conjunto_id))
            elif edificio_id:
                cur.execute("""
                    SELECT p.*, e.nombre as edificio_nombre, NULL::text as conjunto_nombre
                    FROM proveedores p
                    JOIN edificios e ON e.id = p.edificio_id
                    WHERE p.edificio_id = %s AND p.activo = TRUE
                    ORDER BY p.nombre
                """, (edificio_id,))
            else:
                cur.execute("""
                    SELECT p.*,
                           COALESCE(c.nombre, e.nombre, '') as edificio_nombre,
                           c.nombre as conjunto_nombre
                    FROM proveedores p
                    LEFT JOIN edificios e ON e.id = p.edificio_id
                    LEFT JOIN conjuntos c ON c.id = p.conjunto_id
                    WHERE p.activo = TRUE
                    ORDER BY COALESCE(c.nombre, e.nombre), p.nombre
                """)
            return {"proveedores": [dict(r) for r in cur.fetchall()]}


@router.post("", status_code=201)
def create_proveedor(data: ProveedorCreate, current_user: dict = Depends(get_current_user)):
    if not data.edificio_id and not data.conjunto_id:
        raise HTTPException(status_code=400, detail="Se requiere edificio_id o conjunto_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            edificio_id = data.edificio_id
            conjunto_id = data.conjunto_id

            if edificio_id:
                cur.execute("SELECT id, conjunto_id FROM edificios WHERE id = %s", (edificio_id,))
                edificio = cur.fetchone()
                if not edificio:
                    raise HTTPException(status_code=404, detail="Edificio no encontrado")
                # Promover al conjunto si lo tiene
                if not conjunto_id and edificio["conjunto_id"]:
                    conjunto_id = edificio["conjunto_id"]
                    edificio_id = None

            cur.execute("""
                INSERT INTO proveedores (edificio_id, conjunto_id, nombre, contacto, telefono, email, especialidad, nit)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (edificio_id, conjunto_id, data.nombre, data.contacto, data.telefono,
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
