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
    descripcion: Optional[str] = None


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    nit: Optional[str] = None
    descripcion: Optional[str] = None


class ProveedorconjuntoAdd(BaseModel):
    conjunto_id: int


class ContratoCreate(BaseModel):
    conjunto_id: Optional[int] = None
    tipo_servicio: str          # seguridad | aseo | jardineria | mantenimiento | otro
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    fecha_auditoria: Optional[str] = None
    condiciones: Optional[str] = None
    archivo_url: Optional[str] = None
    aprobacion_asamblea_url: Optional[str] = None
    valor: Optional[float] = None
    moneda: Optional[str] = "COP"
    num_cotizaciones_requeridas: Optional[int] = None
    orden_compra_id: Optional[int] = None


class ContratoUpdate(BaseModel):
    conjunto_id: Optional[int] = None
    tipo_servicio: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    fecha_auditoria: Optional[str] = None
    condiciones: Optional[str] = None
    archivo_url: Optional[str] = None
    aprobacion_asamblea_url: Optional[str] = None
    valor: Optional[float] = None
    moneda: Optional[str] = None
    num_cotizaciones_requeridas: Optional[int] = None
    orden_compra_id: Optional[int] = None
    activo: Optional[bool] = None


class EmpleadoCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None


class EmpleadoUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    activo: Optional[bool] = None


class DocumentoCreate(BaseModel):
    tipo: str  # salud | pension | arl | otro
    url_documento: str
    fecha_vencimiento: Optional[str] = None
    descripcion: Optional[str] = None


def _get_visible_proveedor_ids(cur, user: dict) -> Optional[list]:
    """
    Retorna lista de proveedor IDs visibles para el usuario.
    - superadmin: todos (None = sin filtro)
    - administrador: creados por SA + creados por ellos mismos
    - otros roles: los de sus conjuntos asignados (via contratos)
    """
    rol = user.get("rol")
    uid = int(user.get("sub", 0))

    if rol == "superadmin":
        org_id = user.get("organizacion_id")
        if org_id:
            cur.execute("SELECT id FROM proveedores WHERE activo = TRUE AND organizacion_id = %s", (org_id,))
            return [r["id"] for r in cur.fetchall()]
        return []

    if rol == "administrador":
        cur.execute("""
            SELECT id FROM proveedores WHERE activo = TRUE
            AND (
                creado_por = %s
                OR creado_por IN (SELECT id FROM usuarios WHERE rol = 'superadmin')
                OR id IN (
                    SELECT pe.proveedor_id FROM proveedor_conjuntos pe
                    JOIN usuario_conjuntos ue ON ue.conjunto_id = pe.conjunto_id
                    WHERE ue.usuario_id = %s AND ue.activo = TRUE
                )
            )
        """, (uid, uid))
        return [r["id"] for r in cur.fetchall()]

    # portero / servicios / propietario / inquilino
    conjunto_id = user.get("conjunto_id")
    if not conjunto_id:
        return []
    cur.execute("""
        SELECT DISTINCT p.id FROM proveedores p
        JOIN contratos_servicio cs ON cs.proveedor_id = p.id
        WHERE p.activo = TRUE AND cs.conjunto_id = %s
    """, (conjunto_id,))
    return [r["id"] for r in cur.fetchall()]


# ── Proveedores CRUD ──────────────────────────────────────────────────────────

@router.get("")
def list_proveedores(
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

            if conjunto_id:
                query += """
                    AND p.id IN (
                        SELECT proveedor_id FROM proveedor_conjuntos WHERE conjunto_id = %s AND activo = TRUE
                        UNION
                        SELECT proveedor_id FROM contratos_servicio WHERE conjunto_id = %s AND activo = TRUE
                    )
                """
                params.extend([conjunto_id, conjunto_id])

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
    conjunto_id = current_user.get("conjunto_id")
    org_id = current_user.get("organizacion_id")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO proveedores (nombre, contacto, telefono, email, especialidad, nit, descripcion, creado_por, organizacion_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (data.nombre, data.contacto, data.telefono, data.email,
                 data.especialidad, data.nit, data.descripcion, creado_por, org_id),
            )
            proveedor = dict(cur.fetchone())

            # Auto-asociar al conjunto del administrador que lo crea
            if current_user.get("rol") == "administrador" and conjunto_id:
                cur.execute(
                    """INSERT INTO proveedor_conjuntos (proveedor_id, conjunto_id)
                       VALUES (%s, %s) ON CONFLICT DO NOTHING""",
                    (proveedor["id"], conjunto_id),
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
    conjunto_id = current_user.get("conjunto_id")

    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT cs.*,
                       e.nombre AS conjunto_nombre
                FROM contratos_servicio cs
                LEFT JOIN conjuntos e ON e.id = cs.conjunto_id
                WHERE cs.proveedor_id = %s AND cs.activo = TRUE
            """
            params = [proveedor_id]

            # Admin solo ve contratos de su conjunto
            if rol == "administrador" and conjunto_id:
                query += " AND cs.conjunto_id = %s"
                params.append(conjunto_id)

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

    if not data.conjunto_id:
        raise HTTPException(status_code=400, detail="Debe especificar conjunto_id")

    rol = current_user.get("rol")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedores WHERE id = %s AND activo = TRUE", (proveedor_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")

            # Admin: validate the conjunto is pre-associated with this proveedor
            if rol == "administrador" and data.conjunto_id:
                cur.execute(
                    "SELECT id FROM proveedor_conjuntos WHERE proveedor_id=%s AND conjunto_id=%s",
                    (proveedor_id, data.conjunto_id),
                )
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Este proveedor no está asociado a ese conjunto")

            cur.execute(
                """INSERT INTO contratos_servicio
                   (proveedor_id, conjunto_id, tipo_servicio, descripcion,
                    fecha_inicio, fecha_fin, fecha_auditoria, condiciones, archivo_url,
                    aprobacion_asamblea_url, valor, moneda, orden_compra_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (proveedor_id, data.conjunto_id, data.tipo_servicio,
                 data.descripcion, data.fecha_inicio, data.fecha_fin, data.fecha_auditoria,
                 data.condiciones, data.archivo_url, data.aprobacion_asamblea_url,
                 data.valor, data.moneda, data.orden_compra_id),
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


# ── Proveedor ↔ conjunto/Conjunto associations ────────────────────────────────

@router.get("/{proveedor_id}/conjuntos")
def list_proveedor_conjuntos(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pe.*, e.nombre AS conjunto_nombre
                FROM proveedor_conjuntos pe
                LEFT JOIN conjuntos e ON e.id = pe.conjunto_id
                WHERE pe.proveedor_id = %s AND pe.activo = TRUE
                ORDER BY e.nombre
            """, (proveedor_id,))
            return {"asociaciones": [dict(r) for r in cur.fetchall()]}


@router.post("/{proveedor_id}/conjuntos", status_code=201)
def add_proveedor_conjunto(
    proveedor_id: int,
    data: ProveedorconjuntoAdd,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso")

    rol = current_user.get("rol")
    uid = int(current_user.get("sub", 0))

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedores WHERE id = %s AND activo = TRUE", (proveedor_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")

            # Admin: validate they belong to the target conjunto
            if rol == "administrador":
                cur.execute(
                    "SELECT 1 FROM usuario_conjuntos WHERE usuario_id=%s AND conjunto_id=%s AND activo=TRUE",
                    (uid, data.conjunto_id),
                )
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="No tienes acceso a ese conjunto")

            try:
                cur.execute(
                    """INSERT INTO proveedor_conjuntos (proveedor_id, conjunto_id)
                       VALUES (%s, %s)
                       ON CONFLICT DO NOTHING
                       RETURNING *""",
                    (proveedor_id, data.conjunto_id),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=409, detail="La asociación ya existe")
                return dict(row)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{proveedor_id}/conjuntos/{pe_id}", status_code=204)
def remove_proveedor_conjunto(
    proveedor_id: int,
    pe_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE proveedor_conjuntos SET activo = FALSE WHERE id = %s AND proveedor_id = %s",
                (pe_id, proveedor_id),
            )


# ── Empleados del Proveedor ───────────────────────────────────────────────────

def _require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    return current_user


@router.get("/{proveedor_id}/empleados")
def list_empleados(proveedor_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM proveedor_empleados WHERE proveedor_id=%s AND activo=TRUE ORDER BY nombre",
                (proveedor_id,)
            )
            return {"empleados": [dict(r) for r in cur.fetchall()]}


@router.post("/{proveedor_id}/empleados", status_code=201)
def create_empleado(
    proveedor_id: int, data: EmpleadoCreate, current_user: dict = Depends(_require_admin)
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedores WHERE id=%s AND activo=TRUE", (proveedor_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Proveedor no encontrado")
            cur.execute(
                """INSERT INTO proveedor_empleados (proveedor_id, nombre, cedula, cargo, fecha_ingreso)
                   VALUES (%s,%s,%s,%s,%s) RETURNING *""",
                (proveedor_id, data.nombre, data.cedula, data.cargo, data.fecha_ingreso)
            )
            return dict(cur.fetchone())


@router.put("/empleados/{empleado_id}")
def update_empleado(
    empleado_id: int, data: EmpleadoUpdate, current_user: dict = Depends(_require_admin)
):
    fields, values = [], []
    for field, val in data.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(empleado_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE proveedor_empleados SET {', '.join(fields)} WHERE id=%s RETURNING *",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Empleado no encontrado")
            return dict(row)


@router.delete("/empleados/{empleado_id}", status_code=204)
def delete_empleado(empleado_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE proveedor_empleados SET activo=FALSE WHERE id=%s", (empleado_id,))


# ── Documentos por Empleado ───────────────────────────────────────────────────

@router.get("/empleados/{empleado_id}/documentos")
def list_documentos_empleado(empleado_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM empleado_documentos WHERE empleado_id=%s ORDER BY tipo, created_at DESC",
                (empleado_id,)
            )
            return {"documentos": [dict(r) for r in cur.fetchall()]}


@router.post("/empleados/{empleado_id}/documentos", status_code=201)
def create_documento_empleado(
    empleado_id: int, data: DocumentoCreate, current_user: dict = Depends(_require_admin)
):
    if data.tipo not in ("salud", "pension", "arl", "otro"):
        raise HTTPException(status_code=400, detail="tipo inválido: usa salud, pension, arl u otro")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proveedor_empleados WHERE id=%s AND activo=TRUE", (empleado_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Empleado no encontrado")
            cur.execute(
                """INSERT INTO empleado_documentos
                   (empleado_id, tipo, url_documento, fecha_vencimiento, descripcion)
                   VALUES (%s,%s,%s,%s,%s) RETURNING *""",
                (empleado_id, data.tipo, data.url_documento, data.fecha_vencimiento, data.descripcion)
            )
            return dict(cur.fetchone())


@router.delete("/empleados/documentos/{doc_id}", status_code=204)
def delete_documento_empleado(doc_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM empleado_documentos WHERE id=%s", (doc_id,))
