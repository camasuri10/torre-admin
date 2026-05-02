"""Conjuntos router — gestión de conjuntos residenciales (agrupan torres/edificios)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso restringido a Super Admin")
    return current_user


class ConjuntoCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    pais: str = "Colombia"


class ConjuntoUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    pais: Optional[str] = None


@router.get("")
def list_conjuntos(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*,
                       COUNT(e.id) AS total_torres
                FROM conjuntos c
                LEFT JOIN edificios e ON e.conjunto_id = c.id
                GROUP BY c.id
                ORDER BY c.nombre
            """)
            return {"conjuntos": [dict(r) for r in cur.fetchall()]}


@router.post("", status_code=201)
def create_conjunto(body: ConjuntoCreate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO conjuntos (nombre, direccion, ciudad, pais) VALUES (%s,%s,%s,%s) RETURNING *",
                (body.nombre, body.direccion, body.ciudad, body.pais),
            )
            return dict(cur.fetchone())


@router.get("/{conjunto_id}")
def get_conjunto(conjunto_id: int, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM conjuntos WHERE id = %s", (conjunto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Conjunto no encontrado")
            return dict(row)


@router.put("/{conjunto_id}")
def update_conjunto(conjunto_id: int, body: ConjuntoUpdate, sa=Depends(_require_superadmin)):
    fields, values = [], []
    for field, val in body.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(conjunto_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE conjuntos SET {', '.join(fields)} WHERE id = %s RETURNING *", values)
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Conjunto no encontrado")
            return dict(row)


@router.get("/{conjunto_id}/torres")
def get_torres_del_conjunto(conjunto_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, e.nombre, e.numero_torre, e.unidades, e.pisos, e.direccion
                FROM edificios e
                WHERE e.conjunto_id = %s
                ORDER BY e.numero_torre, e.nombre
            """, (conjunto_id,))
            return {"torres": [dict(r) for r in cur.fetchall()]}


@router.post("/{conjunto_id}/torres/{edificio_id}")
def assign_torre_a_conjunto(conjunto_id: int, edificio_id: int, numero_torre: Optional[str] = None, sa=Depends(_require_superadmin)):
    """Asigna un edificio existente a un conjunto."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM conjuntos WHERE id = %s", (conjunto_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Conjunto no encontrado")
            cur.execute(
                "UPDATE edificios SET conjunto_id = %s, numero_torre = %s WHERE id = %s",
                (conjunto_id, numero_torre, edificio_id),
            )
    return {"message": "Torre asignada al conjunto"}
