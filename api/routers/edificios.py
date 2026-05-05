from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


def _check_edificio_access(cur, user: dict, edificio_id: int):
    """SA passes always; admin passes if assigned to the building; others → 403."""
    rol = user.get("rol")
    if rol == "superadmin":
        return
    if rol == "administrador":
        uid = int(user.get("sub", 0))
        cur.execute(
            "SELECT 1 FROM usuario_edificios WHERE usuario_id=%s AND edificio_id=%s AND activo=TRUE",
            (uid, edificio_id),
        )
        if cur.fetchone():
            return
    raise HTTPException(status_code=403, detail="Sin acceso a este edificio")


class EdificioCreate(BaseModel):
    nombre: str
    direccion: str
    pisos: int = 1


class TorreCreate(BaseModel):
    nombre: str
    numero: Optional[str] = None
    pisos: Optional[int] = None


class TorreUpdate(BaseModel):
    nombre: Optional[str] = None
    numero: Optional[str] = None
    pisos: Optional[int] = None
    activo: Optional[bool] = None


class UnidadCreate(BaseModel):
    torre_id: int
    numero: str
    piso: Optional[int] = None
    tipo: str = "apartamento"
    area_m2: Optional[float] = None
    coeficiente: Optional[float] = None


class UnidadUpdate(BaseModel):
    numero: Optional[str] = None
    piso: Optional[int] = None
    tipo: Optional[str] = None
    area_m2: Optional[float] = None
    coeficiente: Optional[float] = None
    activo: Optional[bool] = None


@router.get("")
def list_edificios():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.*,
                       COUNT(DISTINCT t.id) AS total_torres,
                       COUNT(DISTINCT u.id) AS total_unidades
                FROM edificios e
                LEFT JOIN torres t ON t.edificio_id = e.id AND t.activo = TRUE
                LEFT JOIN unidades u ON u.torre_id = t.id AND u.activo = TRUE
                GROUP BY e.id
                ORDER BY e.nombre
            """)
            return cur.fetchall()


@router.get("/{edificio_id}")
def get_edificio(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.*,
                       c.nombre AS conjunto_nombre,
                       COUNT(DISTINCT t.id) AS total_torres,
                       COUNT(DISTINCT u.id) AS total_unidades
                FROM edificios e
                LEFT JOIN conjuntos c ON c.id = e.conjunto_id
                LEFT JOIN torres t ON t.edificio_id = e.id AND t.activo = TRUE
                LEFT JOIN unidades u ON u.torre_id = t.id AND u.activo = TRUE
                WHERE e.id = %s
                GROUP BY e.id, c.nombre
            """, (edificio_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            return row


@router.post("", status_code=201)
def create_edificio(data: EdificioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, pisos) VALUES (%s,%s,%s) RETURNING *",
                (data.nombre, data.direccion, data.pisos),
            )
            return cur.fetchone()


@router.put("/{edificio_id}")
def update_edificio(edificio_id: int, data: EdificioCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE edificios SET nombre=%s, direccion=%s, pisos=%s WHERE id=%s RETURNING *",
                (data.nombre, data.direccion, data.pisos, edificio_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            return row


# ── Torres CRUD ───────────────────────────────────────────────────────────────

@router.get("/{edificio_id}/torres")
def list_torres(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT t.*,
                       COUNT(u.id) AS total_unidades
                FROM torres t
                LEFT JOIN unidades u ON u.torre_id = t.id AND u.activo = TRUE
                WHERE t.edificio_id = %s
                GROUP BY t.id
                ORDER BY t.numero, t.nombre
            """, (edificio_id,))
            return {"torres": [dict(r) for r in cur.fetchall()]}


@router.post("/{edificio_id}/torres", status_code=201)
def create_torre(edificio_id: int, data: TorreCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute("SELECT id FROM edificios WHERE id = %s", (edificio_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Edificio no encontrado")
            cur.execute(
                "INSERT INTO torres (edificio_id, nombre, numero, pisos) VALUES (%s,%s,%s,%s) RETURNING *",
                (edificio_id, data.nombre, data.numero, data.pisos),
            )
            return dict(cur.fetchone())


@router.put("/{edificio_id}/torres/{torre_id}")
def update_torre(edificio_id: int, torre_id: int, data: TorreUpdate, current_user: dict = Depends(get_current_user)):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.extend([torre_id, edificio_id])
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute(
                f"UPDATE torres SET {', '.join(fields)} WHERE id=%s AND edificio_id=%s RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Torre no encontrada")
            return dict(row)


@router.delete("/{edificio_id}/torres/{torre_id}", status_code=204)
def delete_torre(edificio_id: int, torre_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM unidades WHERE torre_id=%s AND activo=TRUE",
                (torre_id,),
            )
            if cur.fetchone()["cnt"] > 0:
                raise HTTPException(status_code=409, detail="La torre tiene unidades activas. Elimínelas primero.")
            cur.execute("DELETE FROM torres WHERE id=%s AND edificio_id=%s", (torre_id, edificio_id))


# ── Unidades (vía torres) ─────────────────────────────────────────────────────

@router.get("/{edificio_id}/unidades")
def get_unidades(edificio_id: int, torre_id: Optional[int] = None):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT u.*,
                       t.nombre AS torre_nombre, t.numero AS torre_numero,
                       o.tipo AS tipo_ocupacion,
                       usr.nombre AS residente_nombre,
                       usr.id AS residente_id
                FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE
                LEFT JOIN usuarios usr ON usr.id = o.usuario_id
                WHERE t.edificio_id = %s AND u.activo = TRUE
            """
            params = [edificio_id]
            if torre_id:
                query += " AND u.torre_id = %s"
                params.append(torre_id)
            query += " ORDER BY t.numero, u.piso, u.numero"
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]


@router.get("/{edificio_id}/torres/{torre_id}/unidades")
def get_unidades_torre(edificio_id: int, torre_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.*,
                       o.tipo AS tipo_ocupacion,
                       usr.nombre AS residente_nombre,
                       usr.id AS residente_id
                FROM unidades u
                LEFT JOIN ocupaciones o ON o.unidad_id = u.id AND o.activo = TRUE
                LEFT JOIN usuarios usr ON usr.id = o.usuario_id
                WHERE u.torre_id = %s AND u.activo = TRUE
                ORDER BY u.piso, u.numero
            """, (torre_id,))
            return [dict(r) for r in cur.fetchall()]


@router.post("/{edificio_id}/unidades", status_code=201)
def create_unidad(edificio_id: int, data: UnidadCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute(
                "SELECT id FROM torres WHERE id = %s AND edificio_id = %s",
                (data.torre_id, edificio_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="La torre no pertenece a este edificio")

            cur.execute(
                """INSERT INTO unidades (torre_id, numero, piso, tipo, area_m2, coeficiente)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
                (data.torre_id, data.numero, data.piso, data.tipo, data.area_m2, data.coeficiente),
            )
            return dict(cur.fetchone())


@router.put("/{edificio_id}/unidades/{unidad_id}")
def update_unidad(edificio_id: int, unidad_id: int, data: UnidadUpdate, current_user: dict = Depends(get_current_user)):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(unidad_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute(
                """SELECT u.id FROM unidades u
                   JOIN torres t ON t.id = u.torre_id
                   WHERE u.id = %s AND t.edificio_id = %s""",
                (unidad_id, edificio_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Unidad no encontrada en este edificio")

            cur.execute(
                f"UPDATE unidades SET {', '.join(fields)} WHERE id=%s RETURNING *",
                values,
            )
            return dict(cur.fetchone())


@router.delete("/{edificio_id}/unidades/{unidad_id}", status_code=204)
def delete_unidad(edificio_id: int, unidad_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_edificio_access(cur, current_user, edificio_id)
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM ocupaciones WHERE unidad_id=%s AND activo=TRUE",
                (unidad_id,),
            )
            if cur.fetchone()["cnt"] > 0:
                raise HTTPException(status_code=409, detail="La unidad tiene residentes activos.")
            cur.execute(
                """DELETE FROM unidades WHERE id=%s AND torre_id IN (
                   SELECT id FROM torres WHERE edificio_id=%s)""",
                (unidad_id, edificio_id),
            )


@router.get("/{edificio_id}/stats")
def get_stats(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM unidades u
                     JOIN torres t ON t.id = u.torre_id
                     WHERE t.edificio_id = %s AND u.activo = TRUE) AS total_unidades,
                    (SELECT COUNT(*) FROM cuotas c
                     JOIN unidades u ON u.id = c.unidad_id
                     JOIN torres t ON t.id = u.torre_id
                     WHERE t.edificio_id = %s AND c.estado = 'vencido') AS morosos,
                    (SELECT COUNT(*) FROM mantenimientos
                     WHERE edificio_id = %s AND estado IN ('pendiente','en_proceso')) AS solicitudes_pendientes,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c
                     JOIN unidades u ON u.id = c.unidad_id
                     JOIN torres t ON t.id = u.torre_id
                     WHERE t.edificio_id = %s AND c.estado = 'pagado'
                     AND c.mes = TO_CHAR(NOW(),'YYYY-MM')) AS recaudo_mes,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c
                     JOIN unidades u ON u.id = c.unidad_id
                     JOIN torres t ON t.id = u.torre_id
                     WHERE t.edificio_id = %s
                     AND c.mes = TO_CHAR(NOW(),'YYYY-MM')) AS meta_recaudo
            """, (edificio_id,) * 5)
            return cur.fetchone()
