"""Proveedores — gestión de proveedores de servicios y sus contratos."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


class ProveedorCreate(BaseModel):
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


class ProveedorEdificioAdd(BaseModel):
    edificio_id: Optional[int] = None
    conjunto_id: Optional[int] = None


class ContratoCreate(BaseModel):
    conjunto_id: Optional[int] = None
    edificio_id: Optional[int] = None
    tipo_servicio: str          # seguridad | aseo | jardineria | mantenimiento | otro
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    condiciones: Optional[str] = None
    archivo_url: Optional[str] = None


class ContratoUpdate(BaseModel):
    conjunto_id: Optional[int] = None
    edificio_id: Optional[int] = None
    tipo_servicio: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    condiciones: Optional[str] = None
    archivo_url: Optional[str] = None
    activo: Optional[bool] = None


def _get_visible_proveedor_ids(cur, user: dict) -> Optional[list]:
    """
    Retorna lista de proveedor IDs visibles para el usuario.
    - superadmin: todos (None = sin filtro)
    - administrador: creados por SA + creados por ellos mismos
    - otros roles: los de sus edificios asignados (via contratos)
    """
    rol = user.get("rol")
    uid = int(user.get("sub", 0))

    if rol == "superadmin":
        return None  # sin filtro

    if rol == "administrador":
        cur.execute("""
            SELECT id FROM proveedores WHERE activo = TRUE
            AND (
                creado_por = %s
                OR creado_por IN (SELECT id FROM usuarios WHERE rol = 'superadmin')
                OR id IN (
                    SELECT pe.proveedor_id FROM proveedor_edificios pe
                    JOIN usuario_edificios ue ON ue.edificio_id = pe.edificio_id
                    WHERE ue.usuario_id = %s AND ue.activo = TRUE
                )
                OR id IN (
                    SELECT pe.proveedor_id FROM proveedor_edificios pe
                    JOIN usuario_conjuntos uc ON uc.conjunto_id = pe.conjunto_id
                    WHERE uc.usuario_id = %s AND uc.activo = TRUE
                )
            )
        """, (uid, uid, uid))
        return [r["id"] for r in cur.fetchall()]

    # portero / servicios / propietario / inquilino
    edificio_id = user.get("edificio_id")
    if not edificio_id:
        return []
    cur.execute("""
        SELECT DISTINCT p.id FROM proveedores p
        JOIN contratos_servicio cs ON cs.proveedor_id = p.id
        WHERE p.activo = TRUE AND cs.edificio_id = %s
    """, (edificio_id,))
    return [r["id"] for r in cur.fetchall()]


# ── Proveedores CRUD ──────────────────────────────────────────────────────────

@router.get("")
def list_proveedores(
    edificio_id: Optional[int] = None,
    conjunto_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            visible_ids = _get_visible_proveedor_ids(cur, current_user)

            query = """
                SELECT p.*, u.nombre AS creado_por_nombre
                FROM proveedores p
                LEFT JOIN usuarios u ON u.id = p.creado_por
                WHERE p.activo = TRUE
            """
            params = []

            if visible_ids is not None:
                if not visible_ids:
                    return {"proveedores": []}
                query += " AND p.id = ANY(%s)"
                params.append(visible_ids)

            if edificio_id:
                query += """
                    AND p.id IN (
                        SELECT proveedor_id FROM proveedor_edificios WHERE edificio_id = %s AND activo = TRUE
                        UNION
                        SELECT proveedor_id FROM contratos_servicio WHERE edificio_id = %s AND activo = TRUE
                        UNION
                        SELECT proveedor_id FROM contratos_servicio cs
                        WHERE cs.conjunto_id IN (SELECT conjunto_id FROM edificios WHERE id = %s AND conjunto_id IS NOT NULL)
                    )
                """
                params.extend([edificio_id, edificio_id, edificio_id])
            elif conjunto_id:
                query += " AND p.id IN (SELECT proveedor_id FROM contratos_servicio WHERE conjunto_id = %s AND activo = TRUE)"
                params.append(conjunto_id)

            query += " ORDER BY p.nombre"
            cur.execute(query, params)
            return {"proveedores": [dict(r) for r in cur.fetchall()]}


@router.get("/{proveedor_id}")
def get_proveedor(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.*, u.nombre AS creado_por_nombre
                FROM proveedores p
                LEFT JOIN usuarios u ON u.id = p.creado_por
                WHERE p.id = %s AND p.activo = TRUE
            """, (proveedor_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")
            return dict(row)


@router.post("", status_code=201)
def create_proveedor(data: ProveedorCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para crear proveedores")

    creado_por = int(current_user.get("sub", 0))
    edificio_id = current_user.get("edificio_id")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO proveedores (nombre, contacto, telefono, email, especialidad, nit, creado_por)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (data.nombre, data.contacto, data.telefono, data.email,
                 data.especialidad, data.nit, creado_por),
            )
            proveedor = dict(cur.fetchone())

            # Auto-asociar al edificio del administrador que lo crea
            if current_user.get("rol") == "administrador" and edificio_id:
                cur.execute(
                    """INSERT INTO proveedor_edificios (proveedor_id, edificio_id)
                       VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                    (proveedor["id"], edificio_id),
                )

            return proveedor


@router.put("/{proveedor_id}")
def update_proveedor(proveedor_id: int, data: ProveedorUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para editar proveedores")

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
                f"UPDATE proveedores SET {', '.join(fields)} WHERE id = %s RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")
            return dict(row)


@router.delete("/{proveedor_id}", status_code=204)
def delete_proveedor(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para eliminar proveedores")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE proveedores SET activo = FALSE WHERE id = %s", (proveedor_id,))


# ── Contratos de Servicio ─────────────────────────────────────────────────────

@router.get("/{proveedor_id}/contratos")
def list_contratos(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    rol = current_user.get("rol")
    edificio_id = current_user.get("edificio_id")

    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT cs.*,
                       c.nombre AS conjunto_nombre,
                       e.nombre AS edificio_nombre
                FROM contratos_servicio cs
                LEFT JOIN conjuntos c ON c.id = cs.conjunto_id
                LEFT JOIN edificios e ON e.id = cs.edificio_id
                WHERE cs.proveedor_id = %s AND cs.activo = TRUE
            """
            params = [proveedor_id]

            # Admin solo ve contratos de su edificio/conjunto
            if rol == "administrador" and edificio_id:
                query += """ AND (
                    cs.edificio_id = %s
                    OR cs.conjunto_id IN (SELECT conjunto_id FROM edificios WHERE id = %s AND conjunto_id IS NOT NULL)
                )"""
                params.extend([edificio_id, edificio_id])

            query += " ORDER BY cs.fecha_inicio DESC NULLS LAST"
            cur.execute(query, params)
            return {"contratos": [dict(r) for r in cur.fetchall()]}


@router.post("/{proveedor_id}/contratos", status_code=201)
def create_contrato(
    proveedor_id: int,
    data: ContratoCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para crear contratos")

    if not data.conjunto_id and not data.edificio_id:
        raise HTTPException(status_code=400, detail="Debe especificar conjunto_id o edificio_id")

    rol = current_user.get("rol")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedores WHERE id = %s AND activo = TRUE", (proveedor_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")

            # Admin: validate the edificio/conjunto is pre-associated with this proveedor
            if rol == "administrador":
                if data.edificio_id:
                    cur.execute(
                        "SELECT id FROM proveedor_edificios WHERE proveedor_id=%s AND edificio_id=%s",
                        (proveedor_id, data.edificio_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=403, detail="Este proveedor no está asociado a ese edificio")
                elif data.conjunto_id:
                    cur.execute(
                        "SELECT id FROM proveedor_edificios WHERE proveedor_id=%s AND conjunto_id=%s",
                        (proveedor_id, data.conjunto_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=403, detail="Este proveedor no está asociado a ese conjunto")

            cur.execute(
                """INSERT INTO contratos_servicio
                   (proveedor_id, conjunto_id, edificio_id, tipo_servicio, descripcion,
                    fecha_inicio, fecha_fin, condiciones, archivo_url)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (proveedor_id, data.conjunto_id, data.edificio_id, data.tipo_servicio,
                 data.descripcion, data.fecha_inicio, data.fecha_fin,
                 data.condiciones, data.archivo_url),
            )
            return dict(cur.fetchone())


@router.put("/contratos/{contrato_id}")
def update_contrato(
    contrato_id: int,
    data: ContratoUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para editar contratos")

    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")

    values.append(contrato_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE contratos_servicio SET {', '.join(fields)} WHERE id = %s RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Contrato no encontrado")
            return dict(row)


@router.delete("/contratos/{contrato_id}", status_code=204)
def delete_contrato(contrato_id: int, current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso para eliminar contratos")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE contratos_servicio SET activo = FALSE WHERE id = %s",
                (contrato_id,),
            )


# ── Proveedor ↔ Edificio/Conjunto associations ────────────────────────────────

@router.get("/{proveedor_id}/edificios")
def list_proveedor_edificios(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pe.*,
                       e.nombre AS edificio_nombre,
                       c.nombre AS conjunto_nombre
                FROM proveedor_edificios pe
                LEFT JOIN edificios e ON e.id = pe.edificio_id
                LEFT JOIN conjuntos c ON c.id = pe.conjunto_id
                WHERE pe.proveedor_id = %s AND pe.activo = TRUE
                ORDER BY COALESCE(e.nombre, c.nombre)
            """, (proveedor_id,))
            return {"asociaciones": [dict(r) for r in cur.fetchall()]}


@router.post("/{proveedor_id}/edificios", status_code=201)
def add_proveedor_edificio(
    proveedor_id: int,
    data: ProveedorEdificioAdd,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso")

    if not data.edificio_id and not data.conjunto_id:
        raise HTTPException(status_code=400, detail="Debe especificar edificio_id o conjunto_id")
    if data.edificio_id and data.conjunto_id:
        raise HTTPException(status_code=400, detail="Especifique solo edificio_id o conjunto_id, no ambos")

    rol = current_user.get("rol")
    uid = int(current_user.get("sub", 0))

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedores WHERE id = %s AND activo = TRUE", (proveedor_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")

            # Admin: validate they belong to the target edificio/conjunto
            if rol == "administrador":
                if data.edificio_id:
                    cur.execute(
                        "SELECT 1 FROM usuario_edificios WHERE usuario_id=%s AND edificio_id=%s AND activo=TRUE",
                        (uid, data.edificio_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=403, detail="No tienes acceso a ese edificio")
                elif data.conjunto_id:
                    cur.execute(
                        "SELECT 1 FROM usuario_conjuntos WHERE usuario_id=%s AND conjunto_id=%s AND activo=TRUE",
                        (uid, data.conjunto_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=403, detail="No tienes acceso a ese conjunto")

            try:
                cur.execute(
                    """INSERT INTO proveedor_edificios (proveedor_id, edificio_id, conjunto_id)
                       VALUES (%s, %s, %s)
                       ON CONFLICT DO NOTHING
                       RETURNING *""",
                    (proveedor_id, data.edificio_id, data.conjunto_id),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=409, detail="La asociación ya existe")
                return dict(row)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{proveedor_id}/edificios/{pe_id}", status_code=204)
def remove_proveedor_edificio(
    proveedor_id: int,
    pe_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE proveedor_edificios SET activo = FALSE WHERE id = %s AND proveedor_id = %s",
                (pe_id, proveedor_id),
            )
