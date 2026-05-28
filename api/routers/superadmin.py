"""Super Admin Router — gestión de conjuntos, módulos, administradores y staff."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from db import get_db
from routers.auth import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso restringido a Super Admin")
    if not current_user.get("organizacion_id"):
        raise HTTPException(status_code=403, detail="SuperAdmin sin organización activa. Selecciona una organización.")
    return current_user


# ── Modelos ───────────────────────────────────────────────────────────────────

class ConjuntoCreate(BaseModel):
    nombre: str
    direccion: str
    pisos: int = 1
    nit: Optional[str] = None
    telefono: Optional[str] = None


class ConjuntoUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    pisos: Optional[int] = None
    nit: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None


class ModuloToggle(BaseModel):
    clave: str
    activo: bool


class ModulosUpdate(BaseModel):
    modulos: list[ModuloToggle]


class AdminCreate(BaseModel):
    nombre: str
    email: str
    password: str
    tipo_documento: Optional[str] = "CC"
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    rol: str = "administrador"          # administrador | portero | servicios
    conjunto_ids: list[int] = []
    eps: Optional[str] = None
    aseguradora_riesgo: Optional[str] = None
    proveedor_id: Optional[int] = None  # solo para roles no-administrador


class AdminConjuntosUpdate(BaseModel):
    conjunto_ids: list[int] = []


class AdminUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    eps: Optional[str] = None
    aseguradora_riesgo: Optional[str] = None


# ── Stats con KPIs operacionales ──────────────────────────────────────────────

@router.get("/stats")
def get_stats(sa=Depends(_require_superadmin)):
    """Totales del sistema + KPIs operacionales, filtrados por la organización del SA."""
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM conjuntos WHERE organizacion_id = %s", (org_id,))
            conjunto_ids = [r["id"] for r in cur.fetchall()]
            eid_list = tuple(conjunto_ids) if conjunto_ids else (0,)

            cur.execute("SELECT COUNT(*) AS total FROM conjuntos WHERE organizacion_id = %s", (org_id,))
            total_conjuntos = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM torres t JOIN conjuntos e ON e.id = t.conjunto_id WHERE e.organizacion_id = %s",
                (org_id,),
            )
            total_torres = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = TRUE AND organizacion_id = %s",
                (org_id,),
            )
            total_admins = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('servicios','portero') AND activo = TRUE AND organizacion_id = %s",
                (org_id,),
            )
            total_staff = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE activo = TRUE AND organizacion_id = %s",
                (org_id,),
            )
            total_usuarios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM modulos")
            total_modulos = cur.fetchone()["total"]

            # ── KPIs operacionales ──────────────────────────────────────────
            # Cuotas pendientes (a través de unidades → torres → conjuntos)
            cur.execute("""
                SELECT COUNT(*) AS total, COALESCE(SUM(c.monto), 0) AS monto
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE c.estado = 'pendiente' AND t.conjunto_id = ANY(%s)
            """, (list(eid_list),))
            row = cur.fetchone()
            cuotas_pendientes = row["total"]
            cuotas_pendientes_monto = float(row["monto"])

            # Cuotas vencidas
            cur.execute("""
                SELECT COUNT(*) AS total, COALESCE(SUM(c.monto), 0) AS monto
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE c.estado = 'vencido' AND t.conjunto_id = ANY(%s)
            """, (list(eid_list),))
            row = cur.fetchone()
            cuotas_vencidas = row["total"]
            cuotas_vencidas_monto = float(row["monto"])

            # Mantenimientos activos (pendiente o en_proceso)
            cur.execute("""
                SELECT COUNT(*) AS total FROM mantenimientos
                WHERE estado IN ('pendiente','en_proceso') AND conjunto_id = ANY(%s)
            """, (list(eid_list),))
            mantenimientos_activos = cur.fetchone()["total"]

            # Reservas de hoy
            cur.execute("""
                SELECT COUNT(*) AS total
                FROM reservas r
                JOIN zonas_comunes z ON z.id = r.zona_id
                WHERE r.fecha = CURRENT_DATE AND r.estado != 'cancelada'
                AND z.conjunto_id = ANY(%s)
            """, (list(eid_list),))
            reservas_hoy = cur.fetchone()["total"]

            # Ocupación: % de unidades con ocupación activa
            cur.execute("""
                SELECT COUNT(*) AS total
                FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                WHERE t.conjunto_id = ANY(%s) AND u.activo = TRUE
            """, (list(eid_list),))
            total_unidades = cur.fetchone()["total"] or 1

            cur.execute("""
                SELECT COUNT(DISTINCT o.unidad_id) AS total
                FROM ocupaciones o
                JOIN unidades u ON u.id = o.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE o.activo = TRUE AND t.conjunto_id = ANY(%s)
            """, (list(eid_list),))
            unidades_ocupadas = cur.fetchone()["total"]
            ocupacion_pct = round((unidades_ocupadas / total_unidades) * 100, 1)

            # Recaudo del mes (cuotas pagadas en el mes actual)
            cur.execute("""
                SELECT COALESCE(SUM(c.monto), 0) AS monto
                FROM cuotas c
                JOIN unidades uni ON uni.id = c.unidad_id
                JOIN torres t ON t.id = uni.torre_id
                WHERE c.estado = 'pagado'
                AND DATE_TRUNC('month', COALESCE(c.fecha_pago, c.created_at)) = DATE_TRUNC('month', CURRENT_DATE)
                AND t.conjunto_id = ANY(%s)
            """, (list(eid_list),))
            recaudo_mes = float(cur.fetchone()["monto"])

    return {
        "total_conjuntos": total_conjuntos,
        "total_torres": total_torres,
        "total_admins": total_admins,
        "total_staff": total_staff,
        "total_usuarios": total_usuarios,
        "total_modulos": total_modulos,
        "cuotas_pendientes": cuotas_pendientes,
        "cuotas_pendientes_monto": cuotas_pendientes_monto,
        "cuotas_vencidas": cuotas_vencidas,
        "cuotas_vencidas_monto": cuotas_vencidas_monto,
        "mantenimientos_activos": mantenimientos_activos,
        "reservas_hoy": reservas_hoy,
        "ocupacion_pct": ocupacion_pct,
        "recaudo_mes": recaudo_mes,
    }


# ── conjuntos ─────────────────────────────────────────────────────────────────

@router.get("/conjuntos")
def list_conjuntos(sa=Depends(_require_superadmin)):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, e.nombre, e.direccion, e.pisos,
                       e.nit, e.telefono, e.created_at,
                       COUNT(DISTINCT t.id) AS total_torres,
                       COUNT(DISTINCT u.id) AS total_unidades,
                       COUNT(CASE WHEN em.activo = TRUE THEN 1 END) AS modulos_activos,
                       (
                           SELECT usr.nombre FROM usuarios usr
                           JOIN usuario_conjuntos ue2 ON ue2.usuario_id = usr.id
                           WHERE ue2.conjunto_id = e.id AND ue2.activo = TRUE AND usr.rol = 'administrador'
                           LIMIT 1
                       ) AS admin_nombre
                FROM conjuntos e
                LEFT JOIN torres t ON t.conjunto_id = e.id AND t.activo = TRUE
                LEFT JOIN unidades u ON u.torre_id = t.id AND u.activo = TRUE
                LEFT JOIN conjunto_modulos em ON em.conjunto_id = e.id
                WHERE e.organizacion_id = %s AND COALESCE(e.activo, TRUE) = TRUE
                GROUP BY e.id ORDER BY e.nombre
            """, (org_id,))
            return {"conjuntos": [dict(r) for r in cur.fetchall()]}


@router.post("/conjuntos", status_code=201)
def create_conjunto(body: ConjuntoCreate, sa=Depends(_require_superadmin)):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO conjuntos (nombre, direccion, pisos, nit, telefono, organizacion_id) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                (body.nombre, body.direccion, body.pisos, body.nit, body.telefono, org_id),
            )
            conjunto_id = cur.fetchone()["id"]

            cur.execute("SELECT id FROM modulos")
            for row in cur.fetchall():
                cur.execute(
                    "INSERT INTO conjunto_modulos (conjunto_id, modulo_id, activo) VALUES (%s,%s,TRUE)",
                    (conjunto_id, row["id"]),
                )

    return {"id": conjunto_id, "message": "conjunto creado con todos los módulos activos"}


@router.put("/conjuntos/{conjunto_id}")
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
            cur.execute(f"UPDATE conjuntos SET {', '.join(fields)} WHERE id = %s", values)

    return {"message": "conjunto actualizado"}


@router.delete("/conjuntos/{conjunto_id}", status_code=204)
def delete_conjunto(conjunto_id: int, sa=Depends(_require_superadmin)):
    """Soft-delete: marca el conjunto como inactivo."""
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE conjuntos SET activo = FALSE WHERE id = %s AND organizacion_id = %s",
                (conjunto_id, org_id),
            )


# ── Módulos por conjunto ───────────────────────────────────────────────────────

@router.get("/conjuntos/{conjunto_id}/modulos")
def get_modulos(conjunto_id: int, current_user: dict = Depends(get_current_user)):
    user_rol = current_user.get("rol")
    user_conjunto = current_user.get("conjunto_id")

    if user_rol != "superadmin" and user_conjunto != conjunto_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este conjunto")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT m.clave, m.nombre, m.icono,
                       COALESCE(em.activo, FALSE) AS activo
                FROM modulos m
                LEFT JOIN conjunto_modulos em ON em.modulo_id = m.id AND em.conjunto_id = %s
                ORDER BY m.id
            """, (conjunto_id,))
            return {"modulos": [dict(r) for r in cur.fetchall()]}


@router.put("/conjuntos/{conjunto_id}/modulos")
def update_modulos(conjunto_id: int, body: ModulosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            for m in body.modulos:
                cur.execute("SELECT id FROM modulos WHERE clave = %s", (m.clave,))
                row = cur.fetchone()
                if not row:
                    continue
                cur.execute("""
                    INSERT INTO conjunto_modulos (conjunto_id, modulo_id, activo)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (conjunto_id, modulo_id) DO UPDATE SET activo = EXCLUDED.activo
                """, (conjunto_id, row["id"], m.activo))

    return {"message": "Módulos actualizados"}


# ── Administradores y Staff ───────────────────────────────────────────────────

@router.get("/admins")
def list_admins(sa=Depends(_require_superadmin)):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.activo,
                       u.eps, u.aseguradora_riesgo, u.proveedor_id, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS conjuntos
                FROM usuarios u
                LEFT JOIN usuario_conjuntos ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN conjuntos e ON e.id = ue.conjunto_id
                WHERE u.rol = 'administrador' AND u.organizacion_id = %s
                GROUP BY u.id
                ORDER BY u.nombre
            """, (org_id,))
            return {"admins": [dict(r) for r in cur.fetchall()]}


@router.get("/staff")
def list_staff(sa=Depends(_require_superadmin)):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                       u.eps, u.aseguradora_riesgo, u.proveedor_id, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS conjuntos
                FROM usuarios u
                LEFT JOIN usuario_conjuntos ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN conjuntos e ON e.id = ue.conjunto_id
                WHERE u.rol IN ('servicios', 'portero') AND u.organizacion_id = %s
                GROUP BY u.id
                ORDER BY u.rol, u.nombre
            """, (org_id,))
            return {"staff": [dict(r) for r in cur.fetchall()]}


@router.post("/admins", status_code=201)
def create_admin(body: AdminCreate, sa=Depends(_require_superadmin)):
    org_id = sa.get("organizacion_id")
    allowed_roles = ("administrador", "portero", "servicios")
    if body.rol not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Rol debe ser uno de: {', '.join(allowed_roles)}")

    # proveedor_id solo válido para roles no-administrador
    proveedor_id = body.proveedor_id if body.rol != "administrador" else None

    password_hash = pwd_context.hash(body.password)
    with get_db() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """INSERT INTO usuarios
                       (nombre, email, cedula, telefono, rol, password_hash,
                        eps, aseguradora_riesgo, proveedor_id, organizacion_id, tipo_documento)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.nombre, body.email, body.cedula, body.telefono, body.rol,
                     password_hash, body.eps, body.aseguradora_riesgo, proveedor_id, org_id,
                     body.tipo_documento or "CC"),
                )
            except Exception:
                raise HTTPException(status_code=400, detail="El email o cédula ya existe")

            user_id = cur.fetchone()["id"]

            # Asignar a conjuntos
            for eid in body.conjunto_ids:
                cur.execute(
                    """INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo, fecha_inicio)
                       VALUES (%s,%s,TRUE,CURRENT_DATE) ON CONFLICT DO NOTHING""",
                    (user_id, eid),
                )

            # Porteros también se registran en guardias
            if body.rol == "portero":
                for eid in body.conjunto_ids:
                    cur.execute(
                        "INSERT INTO guardias (usuario_id, conjunto_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                        (user_id, eid),
                    )

    return {"id": user_id, "message": f"{body.rol.capitalize()} creado"}


@router.put("/admins/{admin_id}")
def update_admin(admin_id: int, body: AdminUpdate, sa=Depends(_require_superadmin)):
    fields, values = [], []
    for field, val in body.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")
    values.append(admin_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE usuarios SET {', '.join(fields)} WHERE id = %s AND rol IN ('administrador','portero','servicios')",
                values,
            )
    return {"message": "Datos del usuario actualizados"}


@router.put("/admins/{admin_id}/conjuntos")
def update_admin_conjuntos(admin_id: int, body: AdminConjuntosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, rol FROM usuarios WHERE id = %s AND rol IN ('administrador','portero','servicios')",
                (admin_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuario de staff no encontrado")

            # Actualizar conjuntos
            cur.execute("UPDATE usuario_conjuntos SET activo = FALSE WHERE usuario_id = %s", (admin_id,))
            for eid in body.conjunto_ids:
                cur.execute("""
                    INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo, fecha_inicio)
                    VALUES (%s, %s, TRUE, CURRENT_DATE)
                    ON CONFLICT (usuario_id, conjunto_id) DO UPDATE SET activo = TRUE
                """, (admin_id, eid))

    return {"message": "Asignaciones del usuario actualizadas"}


# ── Cuotas detalle (for SA panel drill-down) ─────────────────────────────────

@router.get("/stats/cuotas-detalle")
def get_cuotas_detalle(
    estado: str = "pendiente",
    sa=Depends(_require_superadmin),
):
    """Lista cuotas por estado con residente, unidad y conjunto para drill-down en el SA panel."""
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM conjuntos WHERE organizacion_id = %s", (org_id,))
            eid_list = [r["id"] for r in cur.fetchall()] or [0]

            cur.execute("""
                SELECT c.id, c.mes, c.monto, c.estado, c.fecha_vencimiento,
                       uni.numero AS unidad_numero, t.nombre AS torre_nombre,
                       e.nombre AS conjunto_nombre,
                       COALESCE(usr.nombre, 'Sin residente') AS residente_nombre
                FROM cuotas c
                JOIN unidades uni ON uni.id = c.unidad_id
                JOIN torres t ON t.id = uni.torre_id
                JOIN conjuntos e ON e.id = t.conjunto_id
                LEFT JOIN ocupaciones ocp ON ocp.unidad_id = uni.id AND ocp.activo = TRUE
                LEFT JOIN usuarios usr ON usr.id = ocp.usuario_id
                WHERE c.estado = %s AND t.conjunto_id = ANY(%s)
                ORDER BY e.nombre, t.nombre, uni.numero
                LIMIT 300
            """, [estado, eid_list])
            return {"cuotas": [dict(r) for r in cur.fetchall()]}


# ── Mantenimientos detalle (drill-down SA panel) ──────────────────────────────

@router.get("/stats/mantenimientos-detalle")
def get_mantenimientos_detalle(
    estado: str = "todos",   # pendiente | en_proceso | todos
    sa=Depends(_require_superadmin),
):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM conjuntos WHERE organizacion_id = %s", (org_id,))
            eid_list = [r["id"] for r in cur.fetchall()] or [0]

            params: list = [eid_list]
            where_estado = "AND m.estado IN ('pendiente','en_proceso')"
            if estado in ("pendiente", "en_proceso"):
                where_estado = "AND m.estado = %s"
                params.append(estado)

            cur.execute(f"""
                SELECT m.id, m.titulo, m.estado, m.prioridad, m.categoria,
                       m.fecha_solicitud, m.es_programado,
                       e.nombre AS conjunto_nombre,
                       u.numero AS unidad_numero,
                       sol.nombre AS solicitante_nombre
                FROM mantenimientos m
                JOIN conjuntos e ON e.id = m.conjunto_id
                LEFT JOIN unidades u ON u.id = m.unidad_id
                LEFT JOIN usuarios sol ON sol.id = m.solicitado_por_id
                WHERE m.conjunto_id = ANY(%s) {where_estado}
                ORDER BY CASE m.prioridad
                    WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4
                END, m.fecha_solicitud DESC
                LIMIT 200
            """, params)
            return {"mantenimientos": [dict(r) for r in cur.fetchall()]}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(
    conjunto_id: Optional[int] = None,
    sa=Depends(_require_superadmin),
):
    org_id = sa.get("organizacion_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM conjuntos WHERE organizacion_id = %s", (org_id,))
            org_eids = [r["id"] for r in cur.fetchall()] or [0]

            params: list = [org_eids]
            where = "WHERE mu.conjunto_id = ANY(%s)"
            if conjunto_id:
                where += " AND mu.conjunto_id = %s"
                params.append(conjunto_id)

            cur.execute(f"""
                SELECT mu.modulo_clave,
                       m.nombre AS modulo_nombre,
                       COUNT(*) AS total_usos,
                       COUNT(DISTINCT mu.usuario_id) AS usuarios_unicos,
                       MAX(mu.fecha) AS ultimo_uso
                FROM modulos_uso mu
                LEFT JOIN modulos m ON m.clave = mu.modulo_clave
                {where}
                GROUP BY mu.modulo_clave, m.nombre
                ORDER BY total_usos DESC
                LIMIT 10
            """, params)
            top_modulos = [dict(r) for r in cur.fetchall()]

            cur.execute(f"""
                SELECT DATE(mu.fecha) AS dia,
                       mu.modulo_clave,
                       COUNT(*) AS usos
                FROM modulos_uso mu
                {where.replace('WHERE', "WHERE mu.fecha >= NOW() - INTERVAL '7 days' AND")}
                GROUP BY dia, mu.modulo_clave
                ORDER BY dia DESC, usos DESC
            """, params)
            usos_recientes = [dict(r) for r in cur.fetchall()]

    return {
        "top_modulos": top_modulos,
        "usos_recientes": usos_recientes,
    }
