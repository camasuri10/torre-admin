"""Backoffice — gestión de plataforma: usuarios SA/BO y reportería global."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from db import get_db
from routers.auth import get_current_user

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_backoffice(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("backoffice", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo para usuarios Backoffice o SuperAdmin")
    return current_user


class BoUsuarioCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    email: str
    telefono: Optional[str] = None
    password: str
    rol: str  # superadmin | backoffice


class BoUsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None


@router.get("/stats")
def get_stats(_: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Conjuntos y Edificios
            cur.execute("SELECT COUNT(*) FROM conjuntos")
            total_conjuntos = cur.fetchone()["count"]
            cur.execute("SELECT COUNT(*) FROM edificios")
            total_edificios = cur.fetchone()["count"]

            # Módulos activados (total activaciones)
            cur.execute("SELECT COUNT(*) FROM edificio_modulos WHERE activo = TRUE")
            total_modulos_activos = cur.fetchone()["count"]

            # Usuarios por rol
            cur.execute("""
                SELECT rol, COUNT(*) as total
                FROM usuarios WHERE activo = TRUE
                GROUP BY rol ORDER BY rol
            """)
            usuarios_por_rol = {r["rol"]: r["total"] for r in cur.fetchall()}

            # Cuotas
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE estado = 'pagado')    AS pagadas,
                    COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                    COUNT(*) FILTER (WHERE estado = 'vencido')   AS vencidas,
                    COALESCE(SUM(monto) FILTER (WHERE estado = 'pagado'), 0)    AS monto_pagado,
                    COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0) AS monto_pendiente,
                    COALESCE(SUM(monto) FILTER (WHERE estado = 'vencido'), 0)   AS monto_vencido
                FROM cuotas
            """)
            cuotas = dict(cur.fetchone())

            # Actividad
            cur.execute("SELECT COUNT(*) FROM reservas WHERE estado NOT IN ('cancelada')")
            total_reservas = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) FROM comunicados")
            total_comunicados = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) FROM mantenimientos WHERE activo = TRUE")
            total_mantenimientos = cur.fetchone()["count"]

            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
                    COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
                    COUNT(*) FILTER (WHERE estado = 'resuelto')   AS resueltos
                FROM mantenimientos WHERE activo = TRUE
            """)
            mantenimientos_estado = dict(cur.fetchone())

            cur.execute("SELECT COUNT(*) FROM proveedores WHERE activo = TRUE")
            total_proveedores = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) FROM contratos_servicio WHERE activo = TRUE")
            total_contratos = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) FROM paquetes")
            total_paquetes = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) FROM accesos")
            total_accesos = cur.fetchone()["count"]

            return {
                "conjuntos": total_conjuntos,
                "edificios": total_edificios,
                "modulos_activos": total_modulos_activos,
                "usuarios_por_rol": usuarios_por_rol,
                "cuotas": cuotas,
                "reservas": total_reservas,
                "comunicados": total_comunicados,
                "mantenimientos": total_mantenimientos,
                "mantenimientos_estado": mantenimientos_estado,
                "proveedores": total_proveedores,
                "contratos": total_contratos,
                "paquetes": total_paquetes,
                "accesos": total_accesos,
            }


@router.get("/analytics")
def get_analytics(_: dict = Depends(_require_backoffice)):
    with get_db() as conn:
        with conn.cursor() as cur:
            # Reservas por mes (últimos 6 meses)
            cur.execute("""
                SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes, COUNT(*) AS total
                FROM reservas
                WHERE fecha >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY mes ORDER BY mes
            """)
            reservas_por_mes = [dict(r) for r in cur.fetchall()]

            # Comunicados por mes (últimos 6 meses)
            cur.execute("""
                SELECT TO_CHAR(created_at, 'YYYY-MM') AS mes, COUNT(*) AS total
                FROM comunicados
                WHERE created_at >= NOW() - INTERVAL '6 months'
                GROUP BY mes ORDER BY mes
            """)
            comunicados_por_mes = [dict(r) for r in cur.fetchall()]

            # Mantenimientos por estado
            cur.execute("""
                SELECT estado, COUNT(*) AS total
                FROM mantenimientos WHERE activo = TRUE
                GROUP BY estado
            """)
            mantenimientos_por_estado = [dict(r) for r in cur.fetchall()]

            # Comunicados por tipo
            cur.execute("""
                SELECT tipo, COUNT(*) AS total FROM comunicados GROUP BY tipo
            """)
            comunicados_por_tipo = [dict(r) for r in cur.fetchall()]

            # Cuotas por mes (últimos 6 meses)
            cur.execute("""
                SELECT mes,
                    COUNT(*) FILTER (WHERE estado = 'pagado')    AS pagadas,
                    COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                    COUNT(*) FILTER (WHERE estado = 'vencido')   AS vencidas
                FROM cuotas
                WHERE mes >= TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM')
                GROUP BY mes ORDER BY mes
            """)
            cuotas_por_mes = [dict(r) for r in cur.fetchall()]

            # Usuarios registrados por mes (últimos 6 meses)
            cur.execute("""
                SELECT TO_CHAR(created_at, 'YYYY-MM') AS mes, COUNT(*) AS total
                FROM usuarios
                WHERE created_at >= NOW() - INTERVAL '6 months'
                  AND activo = TRUE
                GROUP BY mes ORDER BY mes
            """)
            usuarios_por_mes = [dict(r) for r in cur.fetchall()]

            return {
                "reservas_por_mes": reservas_por_mes,
                "comunicados_por_mes": comunicados_por_mes,
                "mantenimientos_por_estado": mantenimientos_por_estado,
                "comunicados_por_tipo": comunicados_por_tipo,
                "cuotas_por_mes": cuotas_por_mes,
                "usuarios_por_mes": usuarios_por_mes,
            }


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
                    """INSERT INTO usuarios (nombre, cedula, email, telefono, rol, password_hash)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       RETURNING id, nombre, cedula, email, telefono, rol, activo, created_at""",
                    (data.nombre, data.cedula, data.email, data.telefono, data.rol, password_hash),
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
