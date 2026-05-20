"""Backoffice — gestión de plataforma: usuarios SA/BO y reportería global."""
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Tuple, List
from passlib.context import CryptContext
from db import get_db
from routers.auth import get_current_user

def _safe(v):
    """Convert Decimal → float for JSON serialization."""
    return float(v) if isinstance(v, Decimal) else v

def _safe_row(row: dict) -> dict:
    return {k: _safe(v) for k, v in row.items()}

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_backoffice(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("backoffice", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo para usuarios Backoffice o SuperAdmin")
    return current_user


def _resolve_scope(
    current_user: dict,
    organizacion_id: Optional[int] = None,
    edificio_id: Optional[int] = None,
) -> Tuple[Optional[int], Optional[int]]:
    eid = edificio_id if edificio_id is not None else current_user.get("edificio_id")
    oid = organizacion_id if organizacion_id is not None else current_user.get("organizacion_id")
    return eid, oid


def _edificio_ids_subquery(
    edificio_id: Optional[int],
    org_id: Optional[int],
) -> Tuple[Optional[str], List]:
    """Returns (SQL subquery for edificio ids, params) or (None, []) for no filter."""
    if edificio_id:
        return "%s", [edificio_id]
    if org_id:
        return "SELECT id FROM edificios WHERE organizacion_id = %s", [org_id]
    return None, []


def _edificio_col_scope(col: str, edificio_id, org_id) -> Tuple[str, List]:
    sub, params = _edificio_ids_subquery(edificio_id, org_id)
    if edificio_id and not sub:
        return f" AND {col} = %s", [edificio_id]
    if sub is None:
        return "", []
    if sub == "%s":
        return f" AND {col} = %s", params
    return f" AND {col} IN ({sub})", params


def _unidad_scope(edificio_id, org_id) -> Tuple[str, List]:
    sub, params = _edificio_ids_subquery(edificio_id, org_id)
    if not sub:
        return "", []
    if sub == "%s":
        return (
            " AND unidad_id IN (SELECT u.id FROM unidades u JOIN torres t ON t.id = u.torre_id WHERE t.edificio_id = %s)",
            params,
        )
    return (
        f" AND unidad_id IN (SELECT u.id FROM unidades u JOIN torres t ON t.id = u.torre_id WHERE t.edificio_id IN ({sub}))",
        params,
    )


class BoUsuarioCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    tipo_documento: Optional[str] = "CC"
    email: str
    telefono: Optional[str] = None
    password: str
    rol: str  # superadmin | backoffice


class BoUsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    tipo_documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None


@router.get("/stats")
def get_stats(
    organizacion_id: Optional[int] = None,
    edificio_id: Optional[int] = None,
    current_user: dict = Depends(_require_backoffice),
):
    eid, oid = _resolve_scope(current_user, organizacion_id, edificio_id)
    ed_scope, ed_params = _edificio_col_scope("edificio_id", eid, oid)
    un_scope, un_params = _unidad_scope(eid, oid)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                if eid:
                    cur.execute("SELECT COUNT(*) FROM edificios WHERE id = %s", (eid,))
                elif oid:
                    cur.execute(
                        "SELECT COUNT(*) FROM edificios WHERE organizacion_id = %s",
                        (oid,),
                    )
                else:
                    cur.execute("SELECT COUNT(*) FROM edificios")
                total_edificios = cur.fetchone()["count"]

                em_scope = ed_scope.replace("edificio_id", "em.edificio_id") if ed_scope else ""
                cur.execute(
                    f"""
                    SELECT m.clave, m.nombre, m.icono,
                           COALESCE(COUNT(em.edificio_id) FILTER (WHERE em.activo = TRUE), 0) AS activaciones
                    FROM modulos m
                    LEFT JOIN edificio_modulos em ON em.modulo_id = m.id{em_scope}
                    GROUP BY m.id, m.clave, m.nombre, m.icono
                    ORDER BY activaciones DESC, m.nombre
                    """,
                    ed_params,
                )
                modulos_rows = cur.fetchall()
                modulos_detalle = [
                    {
                        "clave": r["clave"],
                        "nombre": r["nombre"],
                        "icono": r["icono"] or "",
                        "activaciones": int(r["activaciones"]),
                    }
                    for r in modulos_rows
                ]
                total_modulos = len(modulos_detalle)
                total_activaciones = sum(m["activaciones"] for m in modulos_detalle)

                cur.execute("SELECT rol, COUNT(*) AS total FROM usuarios WHERE activo = TRUE GROUP BY rol")
                usuarios_por_rol = {r["rol"]: int(r["total"]) for r in cur.fetchall()}

                cur.execute(
                    f"""
                    SELECT
                        COUNT(*) FILTER (WHERE estado = 'pagado')    AS pagadas,
                        COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'vencido')   AS vencidas,
                        COALESCE(CAST(SUM(monto) FILTER (WHERE estado = 'pagado')    AS FLOAT), 0) AS monto_pagado,
                        COALESCE(CAST(SUM(monto) FILTER (WHERE estado = 'pendiente') AS FLOAT), 0) AS monto_pendiente,
                        COALESCE(CAST(SUM(monto) FILTER (WHERE estado = 'vencido')   AS FLOAT), 0) AS monto_vencido
                    FROM cuotas WHERE 1=1{un_scope}
                    """,
                    un_params,
                )
                cuotas = dict(cur.fetchone())

                zona_scope = ""
                zona_params: List = []
                if ed_scope:
                    zona_scope = ed_scope.replace("edificio_id", "z.edificio_id")
                    zona_params = list(ed_params)
                cur.execute(
                    f"""
                    SELECT COUNT(*) FROM reservas r
                    JOIN zonas_comunes z ON z.id = r.zona_id
                    WHERE r.estado <> 'cancelada'{zona_scope}
                    """,
                    zona_params,
                )
                total_reservas = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT COUNT(*) FROM comunicados WHERE 1=1{ed_scope}",
                    ed_params,
                )
                total_comunicados = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT COUNT(*) FROM mantenimientos WHERE estado <> 'cancelado'{ed_scope}",
                    ed_params,
                )
                total_mantenimientos = cur.fetchone()["count"]

                cur.execute(
                    f"""
                    SELECT
                        COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
                        COUNT(*) FILTER (WHERE estado = 'resuelto')   AS resueltos
                    FROM mantenimientos WHERE estado <> 'cancelado'{ed_scope}
                    """,
                    ed_params,
                )
                mantenimientos_estado = dict(cur.fetchone())

                prov_scope = ""
                prov_params: List = []
                if oid:
                    prov_scope = " AND organizacion_id = %s"
                    prov_params = [oid]
                cur.execute(
                    f"SELECT COUNT(*) FROM proveedores WHERE activo = TRUE{prov_scope}",
                    prov_params,
                )
                total_proveedores = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT COUNT(*) FROM contratos_servicio WHERE activo = TRUE{ed_scope}",
                    ed_params,
                )
                total_contratos = cur.fetchone()["count"]

                cur.execute(
                    f"SELECT COUNT(*) FROM paquetes WHERE 1=1{ed_scope}",
                    ed_params,
                )
                total_paquetes = cur.fetchone()["count"]
                cur.execute(
                    f"SELECT COUNT(*) FROM accesos WHERE 1=1{ed_scope}",
                    ed_params,
                )
                total_accesos = cur.fetchone()["count"]

                return {
                    "scope": {
                        "organizacion_id": oid,
                        "edificio_id": eid,
                    },
                    "edificios": int(total_edificios),
                    "modulos_total": total_modulos,
                    "modulos_activaciones": total_activaciones,
                    "modulos_detalle": modulos_detalle,
                    "usuarios_por_rol": usuarios_por_rol,
                    "cuotas": cuotas,
                    "reservas": int(total_reservas),
                    "comunicados": int(total_comunicados),
                    "mantenimientos": int(total_mantenimientos),
                    "mantenimientos_estado": {k: int(v) for k, v in mantenimientos_estado.items()},
                    "proveedores": int(total_proveedores),
                    "contratos": int(total_contratos),
                    "paquetes": int(total_paquetes),
                    "accesos": int(total_accesos),
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"stats error: {e}")


@router.get("/analytics")
def get_analytics(
    organizacion_id: Optional[int] = None,
    edificio_id: Optional[int] = None,
    current_user: dict = Depends(_require_backoffice),
):
    eid, oid = _resolve_scope(current_user, organizacion_id, edificio_id)
    ed_scope, ed_params = _edificio_col_scope("edificio_id", eid, oid)
    un_scope, un_params = _unidad_scope(eid, oid)
    zona_scope = ed_scope.replace("edificio_id", "z.edificio_id") if ed_scope else ""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT TO_CHAR(r.fecha, 'YYYY-MM') AS mes, COUNT(*) AS total
                    FROM reservas r
                    JOIN zonas_comunes z ON z.id = r.zona_id
                    WHERE r.fecha >= CURRENT_DATE - INTERVAL '6 months'
                      AND r.estado <> 'cancelada'{zona_scope}
                    GROUP BY TO_CHAR(r.fecha, 'YYYY-MM') ORDER BY 1
                    """,
                    list(ed_params),
                )
                reservas_por_mes = [{"mes": r["mes"], "total": int(r["total"])} for r in cur.fetchall()]

                cur.execute(
                    f"""
                    SELECT TO_CHAR(created_at, 'YYYY-MM') AS mes, COUNT(*) AS total
                    FROM comunicados
                    WHERE created_at >= NOW() - INTERVAL '6 months'{ed_scope}
                    GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY 1
                    """,
                    ed_params,
                )
                comunicados_por_mes = [{"mes": r["mes"], "total": int(r["total"])} for r in cur.fetchall()]

                cur.execute(
                    f"""
                    SELECT estado, COUNT(*) AS total
                    FROM mantenimientos WHERE estado <> 'cancelado'{ed_scope}
                    GROUP BY estado
                    """,
                    ed_params,
                )
                mantenimientos_por_estado = [{"estado": r["estado"], "total": int(r["total"])} for r in cur.fetchall()]

                try:
                    cur.execute(
                        f"SELECT tipo, COUNT(*) AS total FROM comunicados WHERE 1=1{ed_scope} GROUP BY tipo",
                        ed_params,
                    )
                    comunicados_por_tipo = [{"tipo": r["tipo"], "total": int(r["total"])} for r in cur.fetchall()]
                except Exception:
                    conn.rollback()
                    comunicados_por_tipo = []

                cur.execute(
                    f"""
                    SELECT mes,
                        COUNT(*) FILTER (WHERE estado = 'pagado')    AS pagadas,
                        COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'vencido')   AS vencidas
                    FROM cuotas
                    WHERE mes >= TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM'){un_scope}
                    GROUP BY mes ORDER BY mes
                    """,
                    un_params,
                )
                cuotas_por_mes = [
                    {"mes": r["mes"], "pagadas": int(r["pagadas"]), "pendientes": int(r["pendientes"]), "vencidas": int(r["vencidas"])}
                    for r in cur.fetchall()
                ]

                cur.execute("""
                    SELECT TO_CHAR(created_at, 'YYYY-MM') AS mes, COUNT(*) AS total
                    FROM usuarios
                    WHERE created_at >= NOW() - INTERVAL '6 months' AND activo = TRUE
                    GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY 1
                """)
                usuarios_por_mes = [{"mes": r["mes"], "total": int(r["total"])} for r in cur.fetchall()]

                # Módulos más usados (desde modulos_uso) y cobertura por edificio
                try:
                    mu_scope = ed_scope.replace("edificio_id", "mu.edificio_id") if ed_scope else ""
                    cur.execute(
                        f"""
                        SELECT mu.modulo_clave AS clave,
                               COALESCE(m.nombre, mu.modulo_clave) AS nombre,
                               COALESCE(m.icono, '') AS icono,
                               COUNT(*) AS usos
                        FROM modulos_uso mu
                        LEFT JOIN modulos m ON m.clave = mu.modulo_clave
                        WHERE 1=1{mu_scope}
                        GROUP BY mu.modulo_clave, m.nombre, m.icono
                        ORDER BY usos DESC
                        """,
                        ed_params,
                    )
                    modulos_mas_usados = [
                        {"clave": r["clave"], "nombre": r["nombre"], "icono": r["icono"], "usos": int(r["usos"])}
                        for r in cur.fetchall()
                    ]
                except Exception:
                    conn.rollback()
                    modulos_mas_usados = []

                return {
                    "reservas_por_mes": reservas_por_mes,
                    "comunicados_por_mes": comunicados_por_mes,
                    "mantenimientos_por_estado": mantenimientos_por_estado,
                    "comunicados_por_tipo": comunicados_por_tipo,
                    "cuotas_por_mes": cuotas_por_mes,
                    "usuarios_por_mes": usuarios_por_mes,
                    "modulos_mas_usados": modulos_mas_usados,
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"analytics error: {e}")


@router.get("/usuarios")
def list_bo_usuarios(_: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, nombre, cedula, email, telefono, rol, activo, created_at
                FROM usuarios
                WHERE rol IN ('superadmin', 'backoffice')
                ORDER BY rol, nombre
            """)
            return cur.fetchall()


@router.post("/usuarios", status_code=201)
def create_bo_usuario(data: BoUsuarioCreate, _: dict = Depends(_require_backoffice)):
    if data.rol not in ("superadmin", "backoffice"):
        raise HTTPException(status_code=400, detail="Solo se pueden crear usuarios superadmin o backoffice")
    password_hash = pwd_context.hash(data.password)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO usuarios (nombre, cedula, tipo_documento, email, telefono, rol, password_hash)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)
                       RETURNING id, nombre, cedula, tipo_documento, email, telefono, rol, activo, created_at""",
                    (data.nombre, data.cedula, data.tipo_documento, data.email, data.telefono, data.rol, password_hash),
                )
                return dict(cur.fetchone())
    except Exception as e:
        err_str = str(e)
        if "cedula" in err_str and "unique" in err_str.lower():
            raise HTTPException(status_code=409, detail=f"La cédula {data.cedula!r} ya está registrada.")
        if "email" in err_str and "unique" in err_str.lower():
            raise HTTPException(status_code=409, detail=f"El email {data.email!r} ya está registrado.")
        raise


@router.put("/usuarios/{usuario_id}")
def update_bo_usuario(usuario_id: int, data: BoUsuarioUpdate, _: dict = Depends(_require_backoffice)):
    fields, values = [], []
    if data.nombre is not None:
        fields.append("nombre = %s"); values.append(data.nombre)
    if data.cedula is not None:
        fields.append("cedula = %s"); values.append(data.cedula)
    if data.tipo_documento is not None:
        fields.append("tipo_documento = %s"); values.append(data.tipo_documento)
    if data.email is not None:
        fields.append("email = %s"); values.append(data.email)
    if data.telefono is not None:
        fields.append("telefono = %s"); values.append(data.telefono)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(usuario_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE usuarios SET {', '.join(fields)} WHERE id = %s AND rol IN ('superadmin','backoffice') "
                "RETURNING id, nombre, cedula, email, telefono, rol, activo",
                values,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return dict(row)


@router.patch("/usuarios/{usuario_id}/desactivar")
def desactivar_bo_usuario(usuario_id: int, _: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET activo = FALSE WHERE id = %s AND rol IN ('superadmin','backoffice') RETURNING id",
                (usuario_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return {"ok": True}
