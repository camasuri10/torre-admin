from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user
from routers.conjuntos import _check_conjunto_access

router = APIRouter()


class ConsejoMiembroCreate(BaseModel):
    nombre: str
    cargo: str
    tipo: str = "activo"   # activo (titular) | suplente
    unidad_id: Optional[int] = None
    residente_id: Optional[int] = None


class ConsejoMiembroUpdate(BaseModel):
    nombre: Optional[str] = None
    cargo: Optional[str] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None
    unidad_id: Optional[int] = None
    residente_id: Optional[int] = None


def _miembro_conjunto_id(cur, miembro_id: int) -> int:
    cur.execute("SELECT conjunto_id FROM consejo_miembros WHERE id = %s", (miembro_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    return row["conjunto_id"]


@router.get("/unidades/{conjunto_id}")
def list_unidades_para_consejo(conjunto_id: int, current_user: dict = Depends(get_current_user)):
    """Retorna unidades con sus residentes activos para el selector del modal."""
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_conjunto_access(cur, current_user, conjunto_id)
            cur.execute("""
                SELECT u.id, u.numero, u.piso,
                       t.nombre AS torre, t.numero AS torre_numero,
                       us.id AS residente_id, us.nombre AS residente_nombre, us.rol
                FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE
                LEFT JOIN usuarios us ON us.id = o.usuario_id AND us.activo = TRUE
                WHERE t.conjunto_id = %s AND u.activo = TRUE
                ORDER BY t.numero, t.nombre, u.numero, us.nombre
            """, (conjunto_id,))
            rows = cur.fetchall()
            units: dict = {}
            for row in rows:
                uid = row["id"]
                if uid not in units:
                    torre_label = " ".join(
                        p for p in [row["torre"], row["torre_numero"]] if p
                    ).strip() or row["torre"]
                    units[uid] = {
                        "id": uid,
                        "numero": row["numero"],
                        "piso": row["piso"],
                        "torre": torre_label,
                        "residentes": [],
                    }
                if row["residente_id"]:
                    units[uid]["residentes"].append({
                        "id": row["residente_id"],
                        "nombre": row["residente_nombre"],
                        "rol": row["rol"],
                    })
            return list(units.values())


@router.get("/{conjunto_id}")
def list_miembros(
    conjunto_id: int,
    incluir_inactivos: bool = False,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_conjunto_access(cur, current_user, conjunto_id)
            query = """
                SELECT cm.*, u.numero AS unidad_numero, t.nombre AS unidad_torre, t.numero AS unidad_torre_numero
                FROM consejo_miembros cm
                LEFT JOIN unidades u ON u.id = cm.unidad_id
                LEFT JOIN torres t ON t.id = u.torre_id
                WHERE cm.conjunto_id = %s
            """
            params = [conjunto_id]
            if not incluir_inactivos:
                query += " AND cm.activo = TRUE"
            query += " ORDER BY cm.tipo, cm.cargo, cm.nombre"
            cur.execute(query, params)
            return cur.fetchall()


@router.post("/{conjunto_id}", status_code=201)
def create_miembro(
    conjunto_id: int,
    data: ConsejoMiembroCreate,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_conjunto_access(cur, current_user, conjunto_id)
            cur.execute("""
                INSERT INTO consejo_miembros (conjunto_id, nombre, cargo, tipo, unidad_id, residente_id)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (conjunto_id, data.nombre, data.cargo, data.tipo, data.unidad_id, data.residente_id))
            return cur.fetchone()


@router.patch("/miembros/{miembro_id}")
def update_miembro(
    miembro_id: int,
    data: ConsejoMiembroUpdate,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            conjunto_id = _miembro_conjunto_id(cur, miembro_id)
            _check_conjunto_access(cur, current_user, conjunto_id)
            fields, params = [], []
            if data.nombre is not None:
                fields.append("nombre = %s"); params.append(data.nombre)
            if data.cargo is not None:
                fields.append("cargo = %s"); params.append(data.cargo)
            if data.tipo is not None:
                fields.append("tipo = %s"); params.append(data.tipo)
            if data.activo is not None:
                fields.append("activo = %s"); params.append(data.activo)
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
def delete_miembro(miembro_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            conjunto_id = _miembro_conjunto_id(cur, miembro_id)
            _check_conjunto_access(cur, current_user, conjunto_id)
            cur.execute(
                "UPDATE consejo_miembros SET activo = FALSE WHERE id = %s RETURNING id",
                (miembro_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Miembro no encontrado")
    return {"message": "Miembro desactivado"}
