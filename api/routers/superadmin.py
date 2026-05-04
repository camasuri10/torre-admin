"""Super Admin Router — gestión de edificios, conjuntos, módulos, administradores y staff."""
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
    return current_user


# ── Modelos ───────────────────────────────────────────────────────────────────

class EdificioCreate(BaseModel):
    nombre: str
    direccion: str
    pisos: int = 1
    conjunto_id: Optional[int] = None


class EdificioUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    pisos: Optional[int] = None
    conjunto_id: Optional[int] = None


class ModuloToggle(BaseModel):
    clave: str
    activo: bool


class ModulosUpdate(BaseModel):
    modulos: list[ModuloToggle]


class AdminCreate(BaseModel):
    nombre: str
    email: str
    password: str
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    rol: str = "administrador"          # administrador | portero | servicios
    edificio_ids: list[int] = []
    conjunto_ids: list[int] = []
    eps: Optional[str] = None
    aseguradora_riesgo: Optional[str] = None
    proveedor_id: Optional[int] = None  # solo para roles no-administrador


class AdminEdificiosUpdate(BaseModel):
    edificio_ids: list[int] = []
    conjunto_ids: list[int] = []


# ── Stats con KPIs operacionales ──────────────────────────────────────────────

@router.get("/stats")
def get_stats(conjunto_id: Optional[int] = None, sa=Depends(_require_superadmin)):
    """
    Totales del sistema + KPIs operacionales.
    Si conjunto_id es provisto, filtra solo edificios de ese conjunto.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            # Filtrar edificios por conjunto si se especifica
            if conjunto_id:
                cur.execute("SELECT id FROM edificios WHERE conjunto_id = %s", (conjunto_id,))
            else:
                cur.execute("SELECT id FROM edificios")
            edificio_ids = [r["id"] for r in cur.fetchall()]
            eid_list = tuple(edificio_ids) if edificio_ids else (0,)

            cur.execute("SELECT COUNT(*) AS total FROM edificios")
            total_edificios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM conjuntos")
            total_conjuntos = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM torres")
            total_torres = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = TRUE")
            total_admins = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('servicios','portero') AND activo = TRUE")
            total_staff = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE activo = TRUE")
            total_usuarios = cur.fetchone()["total"]

            cur.execute("SELECT COUNT(*) AS total FROM modulos")
            total_modulos = cur.fetchone()["total"]

            # ── KPIs operacionales ──────────────────────────────────────────
            # Cuotas pendientes (a través de unidades → torres → edificios)
            cur.execute("""
                SELECT COUNT(*) AS total, COALESCE(SUM(c.monto), 0) AS monto
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE c.estado = 'pendiente' AND t.edificio_id = ANY(%s)
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
                WHERE c.estado = 'vencido' AND t.edificio_id = ANY(%s)
            """, (list(eid_list),))
            row = cur.fetchone()
            cuotas_vencidas = row["total"]
            cuotas_vencidas_monto = float(row["monto"])

            # Mantenimientos activos (pendiente o en_proceso)
            cur.execute("""
                SELECT COUNT(*) AS total FROM mantenimientos
                WHERE estado IN ('pendiente','en_proceso') AND edificio_id = ANY(%s)
            """, (list(eid_list),))
            mantenimientos_activos = cur.fetchone()["total"]

            # Reservas de hoy
            cur.execute("""
                SELECT COUNT(*) AS total
                FROM reservas r
                JOIN zonas_comunes z ON z.id = r.zona_id
                WHERE r.fecha = CURRENT_DATE AND r.estado != 'cancelada'
                AND z.edificio_id = ANY(%s)
            """, (list(eid_list),))
            reservas_hoy = cur.fetchone()["total"]

            # Ocupación: % de unidades con ocupación activa
            cur.execute("""
                SELECT COUNT(*) AS total
                FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                WHERE t.edificio_id = ANY(%s) AND u.activo = TRUE
            """, (list(eid_list),))
            total_unidades = cur.fetchone()["total"] or 1

            cur.execute("""
                SELECT COUNT(DISTINCT o.unidad_id) AS total
                FROM ocupaciones o
                JOIN unidades u ON u.id = o.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE o.activo = TRUE AND t.edificio_id = ANY(%s)
            """, (list(eid_list),))
            unidades_ocupadas = cur.fetchone()["total"]
            ocupacion_pct = round((unidades_ocupadas / total_unidades) * 100, 1)

    return {
        "total_edificios": total_edificios,
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
    }


# ── Edificios ─────────────────────────────────────────────────────────────────

@router.get("/edificios")
def list_edificios(conjunto_id: Optional[int] = None, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT e.id, e.nombre, e.direccion, e.pisos,
                       e.conjunto_id, e.created_at,
                       c.nombre AS conjunto_nombre,
                       COUNT(DISTINCT t.id) AS total_torres,
                       COUNT(DISTINCT u.id) AS total_unidades,
                       COUNT(CASE WHEN em.activo = TRUE THEN 1 END) AS modulos_activos
                FROM edificios e
                LEFT JOIN conjuntos c ON c.id = e.conjunto_id
                LEFT JOIN torres t ON t.edificio_id = e.id AND t.activo = TRUE
                LEFT JOIN unidades u ON u.torre_id = t.id AND u.activo = TRUE
                LEFT JOIN edificio_modulos em ON em.edificio_id = e.id
                WHERE 1=1
            """
            params = []
            if conjunto_id is not None:
                query += " AND e.conjunto_id = %s"
                params.append(conjunto_id)
            query += " GROUP BY e.id, c.nombre ORDER BY e.nombre"
            cur.execute(query, params)
            return {"edificios": [dict(r) for r in cur.fetchall()]}


@router.post("/edificios", status_code=201)
def create_edificio(body: EdificioCreate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, pisos, conjunto_id) VALUES (%s,%s,%s,%s) RETURNING id",
                (body.nombre, body.direccion, body.pisos, body.conjunto_id),
            )
            edificio_id = cur.fetchone()["id"]

            cur.execute("SELECT id FROM modulos")
            for row in cur.fetchall():
                cur.execute(
                    "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s,%s,TRUE)",
                    (edificio_id, row["id"]),
                )

    return {"id": edificio_id, "message": "Edificio creado con todos los módulos activos"}


@router.put("/edificios/{edificio_id}")
def update_edificio(edificio_id: int, body: EdificioUpdate, sa=Depends(_require_superadmin)):
    fields, values = [], []
    for field, val in body.model_dump(exclude_none=True).items():
        fields.append(f"{field} = %s")
        values.append(val)

    if not fields:
        raise HTTPException(status_code=400, detail="Sin campos a actualizar")

    values.append(edificio_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE edificios SET {', '.join(fields)} WHERE id = %s", values)

    return {"message": "Edificio actualizado"}


# ── Módulos por edificio ───────────────────────────────────────────────────────

@router.get("/edificios/{edificio_id}/modulos")
def get_modulos(edificio_id: int, current_user: dict = Depends(get_current_user)):
    user_rol = current_user.get("rol")
    user_edificio = current_user.get("edificio_id")

    if user_rol != "superadmin" and user_edificio != edificio_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este edificio")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT m.clave, m.nombre, m.icono,
                       COALESCE(em.activo, FALSE) AS activo
                FROM modulos m
                LEFT JOIN edificio_modulos em ON em.modulo_id = m.id AND em.edificio_id = %s
                ORDER BY m.id
            """, (edificio_id,))
            return {"modulos": [dict(r) for r in cur.fetchall()]}


@router.put("/edificios/{edificio_id}/modulos")
def update_modulos(edificio_id: int, body: ModulosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            for m in body.modulos:
                cur.execute("SELECT id FROM modulos WHERE clave = %s", (m.clave,))
                row = cur.fetchone()
                if not row:
                    continue
                cur.execute("""
                    INSERT INTO edificio_modulos (edificio_id, modulo_id, activo)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (edificio_id, modulo_id) DO UPDATE SET activo = EXCLUDED.activo
                """, (edificio_id, row["id"], m.activo))

    return {"message": "Módulos actualizados"}


# ── Administradores y Staff ───────────────────────────────────────────────────

@router.get("/admins")
def list_admins(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.activo,
                       u.eps, u.aseguradora_riesgo, u.proveedor_id, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS edificios
                FROM usuarios u
                LEFT JOIN usuario_edificios ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN edificios e ON e.id = ue.edificio_id
                WHERE u.rol = 'administrador'
                GROUP BY u.id
                ORDER BY u.nombre
            """)
            return {"admins": [dict(r) for r in cur.fetchall()]}


@router.get("/staff")
def list_staff(sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.nombre, u.email, u.cedula, u.telefono, u.rol, u.activo,
                       u.eps, u.aseguradora_riesgo, u.proveedor_id, u.created_at,
                       COALESCE(
                           json_agg(json_build_object('id', e.id, 'nombre', e.nombre))
                           FILTER (WHERE e.id IS NOT NULL), '[]'
                       ) AS edificios
                FROM usuarios u
                LEFT JOIN usuario_edificios ue ON ue.usuario_id = u.id AND ue.activo = TRUE
                LEFT JOIN edificios e ON e.id = ue.edificio_id
                WHERE u.rol IN ('servicios', 'portero')
                GROUP BY u.id
                ORDER BY u.rol, u.nombre
            """)
            return {"staff": [dict(r) for r in cur.fetchall()]}


@router.post("/admins", status_code=201)
def create_admin(body: AdminCreate, sa=Depends(_require_superadmin)):
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
                        eps, aseguradora_riesgo, proveedor_id)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (body.nombre, body.email, body.cedula, body.telefono, body.rol,
                     password_hash, body.eps, body.aseguradora_riesgo, proveedor_id),
                )
            except Exception:
                raise HTTPException(status_code=400, detail="El email o cédula ya existe")

            user_id = cur.fetchone()["id"]

            # Asignar a edificios
            for eid in body.edificio_ids:
                cur.execute(
                    """INSERT INTO usuario_edificios (usuario_id, edificio_id, activo, fecha_inicio)
                       VALUES (%s,%s,TRUE,CURRENT_DATE) ON CONFLICT DO NOTHING""",
                    (user_id, eid),
                )

            # Asignar a conjuntos
            for cid in body.conjunto_ids:
                cur.execute(
                    """INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo, fecha_inicio)
                       VALUES (%s,%s,TRUE,CURRENT_DATE) ON CONFLICT DO NOTHING""",
                    (user_id, cid),
                )

            # Porteros también se registran en guardias
            if body.rol == "portero":
                for eid in body.edificio_ids:
                    cur.execute(
                        "INSERT INTO guardias (usuario_id, edificio_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                        (user_id, eid),
                    )

    return {"id": user_id, "message": f"{body.rol.capitalize()} creado"}


@router.put("/admins/{admin_id}/edificios")
def update_admin_edificios(admin_id: int, body: AdminEdificiosUpdate, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, rol FROM usuarios WHERE id = %s AND rol IN ('administrador','portero','servicios')",
                (admin_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuario de staff no encontrado")

            # Actualizar edificios
            cur.execute("UPDATE usuario_edificios SET activo = FALSE WHERE usuario_id = %s", (admin_id,))
            for eid in body.edificio_ids:
                cur.execute("""
                    INSERT INTO usuario_edificios (usuario_id, edificio_id, activo, fecha_inicio)
                    VALUES (%s, %s, TRUE, CURRENT_DATE)
                    ON CONFLICT (usuario_id, edificio_id) DO UPDATE SET activo = TRUE
                """, (admin_id, eid))

            # Actualizar conjuntos
            cur.execute("UPDATE usuario_conjuntos SET activo = FALSE WHERE usuario_id = %s", (admin_id,))
            for cid in body.conjunto_ids:
                cur.execute("""
                    INSERT INTO usuario_conjuntos (usuario_id, conjunto_id, activo, fecha_inicio)
                    VALUES (%s, %s, TRUE, CURRENT_DATE)
                    ON CONFLICT (usuario_id, conjunto_id) DO UPDATE SET activo = TRUE
                """, (admin_id, cid))

    return {"message": "Asignaciones del usuario actualizadas"}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(edificio_id: Optional[int] = None, sa=Depends(_require_superadmin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            params = []
            where = "WHERE 1=1"
            if edificio_id:
                where += " AND mu.edificio_id = %s"
                params.append(edificio_id)

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
