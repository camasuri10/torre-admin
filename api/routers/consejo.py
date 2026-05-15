from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db

router = APIRouter()


class ConsejoMiembroCreate(BaseModel):
    nombre: str
    cargo: str
    tipo: str = "activo"   # activo | suplente
    unidad_id: Optional[int] = None
    residente_id: Optional[int] = None


class ConsejoMiembroUpdate(BaseModel):
    nombre: Optional[str] = None
    cargo: Optional[str] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None
    unidad_id: Optional[int] = None
    residente_id: Optional[int] = None


@router.get("/unidades/{edificio_id}")
def list_unidades_para_consejo(edificio_id: int):
    """Retorna unidades con sus residentes activos para el selector del modal."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.numero, t.nombre AS torre,
                       us.id AS residente_id, us.nombre AS residente_nombre, us.rol
                FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE
                LEFT JOIN usuarios us ON us.id = o.usuario_id AND us.activo = TRUE
                WHERE t.edificio_id = %s AND u.activo = TRUE
                ORDER BY t.nombre, u.numero, us.nombre
            """, (edificio_id,))
            rows = cur.fetchall()
            units: dict = {}
            for row in rows:
                uid = row["id"]
                if uid not in units:
                    units[uid] = {
                        "id": uid,
                        "numero": row["numero"],
                        "torre": row["torre"],
                        "residentes": [],
                    }
                if row["residente_id"]:
                    units[uid]["residentes"].append({
                        "id": row["residente_id"],
                        "nombre": row["residente_nombre"],
                        "rol": row["rol"],
                    })
            return list(units.values())


@router.get("/{edificio_id}")
def list_miembros(edificio_id: int, incluir_inactivos: bool = False):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT cm.*, u.numero AS unidad_numero, t.nombre AS unidad_torre
                FROM consejo_miembros cm
                LEFT JOIN unidades u ON u.id = cm.unidad_id
                LEFT JOIN torres t ON t.id = u.torre_id
                WHERE cm.edificio_id = %s
            """
            params = [edificio_id]
            if not incluir_inactivos:
                query += " AND cm.activo = TRUE"
            query += " ORDER BY cm.tipo, cm.cargo, cm.nombre"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/{edificio_id}", status_code=201)
def create_miembro(edificio_id: int, data: ConsejoMiembroCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO consejo_miembros (edificio_id, nombre, cargo, tipo, unidad_id, residente_id)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (edificio_id, data.nombre, data.cargo, data.tipo, data.unidad_id, data.residente_id))
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
            # unidad_id y residente_id pueden ser explícitamente null (limpiar el link)
            if "unidad_id" in data.model_fields_set:
                fields.append("unidad_id = %s"); params.append(data.unidad_id)
            if "residente_id" in data.model_fields_set:
                fields.append("residente_id = %s"); params.append(data.residente_id)
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
