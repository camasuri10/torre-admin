"""Vehículos router — registro de vehículos por residente."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class VehiculoCreate(BaseModel):
    usuario_id: int
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    tipo: str = "carro"  # carro | moto | bicicleta | otro


class VehiculoUpdate(BaseModel):
    placa: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    tipo: Optional[str] = None


@router.get("")
def list_vehiculos(usuario_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            if usuario_id:
                cur.execute(
                    "SELECT v.*, u.nombre as usuario_nombre FROM vehiculos v "
                    "JOIN usuarios u ON u.id = v.usuario_id "
                    "WHERE v.usuario_id = %s AND v.activo = TRUE ORDER BY v.created_at DESC",
                    (usuario_id,),
                )
            else:
                cur.execute(
                    "SELECT v.*, u.nombre as usuario_nombre FROM vehiculos v "
                    "JOIN usuarios u ON u.id = v.usuario_id "
                    "WHERE v.activo = TRUE ORDER BY u.nombre, v.placa"
                )
            return {"vehiculos": [dict(r) for r in cur.fetchall()]}


@router.post("", status_code=201)
def create_vehiculo(data: VehiculoCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE id = %s AND activo = TRUE", (data.usuario_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            cur.execute("""
                INSERT INTO vehiculos (usuario_id, placa, marca, modelo, color, tipo)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (data.usuario_id, data.placa.upper(), data.marca, data.modelo, data.color, data.tipo))
            return dict(cur.fetchone())


def _assert_vehiculo_access(cur, vehiculo_id: int, current_user: dict):
    cur.execute("SELECT usuario_id FROM vehiculos WHERE id = %s AND activo = TRUE", (vehiculo_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    if int(current_user["sub"]) != row["usuario_id"] and current_user["rol"] not in ("administrador", "superadmin"):
        raise HTTPException(status_code=403, detail="Sin permiso")


@router.put("/{vehiculo_id}")
def update_vehiculo(vehiculo_id: int, data: VehiculoUpdate, current_user: dict = Depends(get_current_user)):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        if field == "placa" and val:
            val = val.upper()
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(vehiculo_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            _assert_vehiculo_access(cur, vehiculo_id, current_user)
            cur.execute(
                f"UPDATE vehiculos SET {', '.join(fields)} WHERE id = %s AND activo = TRUE RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Vehículo no encontrado")
            return dict(row)


@router.delete("/{vehiculo_id}", status_code=204)
def delete_vehiculo(vehiculo_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            _assert_vehiculo_access(cur, vehiculo_id, current_user)
            cur.execute("UPDATE vehiculos SET activo = FALSE WHERE id = %s", (vehiculo_id,))
