"""Módulo de Proyectos — gestión de intervenciones del conjunto (proyectos y tareas)."""
import base64, mimetypes
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from db import get_db
from routers.auth import get_current_user

router = APIRouter()

# ── Acceso ────────────────────────────────────────────────────────────────────

def _require_admin(u: dict = Depends(get_current_user)):
    if u.get("rol") not in ("superadmin", "administrador"):
        raise HTTPException(403, "Solo administradores")
    return u


def _require_access(u: dict = Depends(get_current_user)):
    if u.get("rol") not in ("superadmin", "administrador", "consejo"):
        raise HTTPException(403, "Acceso no autorizado")
    return u


def _require_any_user(u: dict = Depends(get_current_user)):
    """Cualquier usuario autenticado puede acceder (residentes incluidos)."""
    return u


# ── Flujos de etapas ─────────────────────────────────────────────────────────

FLUJO_PROYECTO = ["PENDING", "STARTED", "QUOTING", "APPROVAL", "PLANNING", "IN_PROGRESS", "MONITORING", "COMPLETED"]
FLUJO_TAREA    = ["PENDING", "STARTED", "IN_PROGRESS", "COMPLETED"]

ETAPA_LABELS: dict[str, str] = {
    "PENDING":     "No iniciado",
    "STARTED":     "Inicio",
    "QUOTING":     "Cotización",
    "APPROVAL":    "Aprobación",
    "PLANNING":    "Planificación",
    "IN_PROGRESS": "Ejecución",
    "MONITORING":  "Control",
    "COMPLETED":   "Finalizado",
    "CANCELLED":   "Cancelado",
}

ROLES_RESIDENTES = ("propietario", "inquilino")

def _next_etapa(tipo: str, etapa_actual: str) -> str:
    flujo = FLUJO_TAREA if tipo == "tarea" else FLUJO_PROYECTO
    try:
        idx = flujo.index(etapa_actual)
    except ValueError:
        raise HTTPException(400, f"Etapa '{etapa_actual}' inválida para tipo '{tipo}'")
    if idx + 1 >= len(flujo):
        raise HTTPException(400, "El proyecto ya está en la etapa final")
    return flujo[idx + 1]


def _log_comentario(cur, proyecto_id: int, usuario_id: Optional[int], texto: str):
    cur.execute(
        "INSERT INTO proyecto_comentarios (proyecto_id, usuario_id, texto, es_sistema) VALUES (%s,%s,%s,TRUE)",
        (proyecto_id, usuario_id, texto),
    )


# ── Modelos ───────────────────────────────────────────────────────────────────

class ProyectoCreate(BaseModel):
    conjunto_id: int
    titulo: str
    tipo: str
    descripcion: Optional[str] = None
    prioridad: str = "media"
    zona_tipo: Optional[str] = None
    zona_id: Optional[int] = None
    zona_texto: Optional[str] = None
    responsable_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    fecha_compromiso: Optional[date] = None
    visible_residentes: bool = False


class ProyectoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    prioridad: Optional[str] = None
    zona_tipo: Optional[str] = None
    zona_id: Optional[int] = None
    zona_texto: Optional[str] = None
    responsable_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    fecha_compromiso: Optional[date] = None
    fecha_cierre_real: Optional[date] = None
    presupuesto_aprobado: Optional[float] = None
    costo_final: Optional[float] = None
    visible_residentes: Optional[bool] = None
    garantia_meses: Optional[int] = None
    descripcion_control: Optional[str] = None


class AvanzarBody(BaseModel):
    justificacion: Optional[str] = None
    # APPROVAL → PLANNING
    fecha_nueva_entrega: Optional[date] = None
    # IN_PROGRESS → MONITORING
    descripcion_control: Optional[str] = None
    garantia_meses: Optional[int] = None
    fecha_cierre_real: Optional[date] = None


class CancelarBody(BaseModel):
    justificacion: str


class CotizacionCreate(BaseModel):
    proveedor_id: Optional[int] = None
    nombre_proveedor: Optional[str] = None
    monto: float
    fecha_cotizacion: Optional[date] = None
    archivo_base64: Optional[str] = None
    nombre_archivo: Optional[str] = None


class CotizacionEstado(BaseModel):
    estado: str   # seleccionada | descartada | pendiente


class ComentarioCreate(BaseModel):
    texto: str
    archivo_base64: Optional[str] = None
    nombre_archivo: Optional[str] = None


class EnviarAprobacionBody(BaseModel):
    nota_admin: Optional[str] = None
    fecha_limite: Optional[date] = None


class VotarBody(BaseModel):
    decision: str   # aprobado | rechazado
    comentario: Optional[str] = None


class AprobarPorActaBody(BaseModel):
    acta_numero: str
    acta_fecha: date
    acta_descripcion: str
    archivo_base64: str
    nombre_archivo: str


# ── CRUD Proyectos ────────────────────────────────────────────────────────────

@router.get("")
def list_proyectos(
    conjunto_id: int,
    etapa: Optional[str] = None,
    tipo: Optional[str] = None,
    prioridad: Optional[str] = None,
    zona_tipo: Optional[str] = None,
    responsable_id: Optional[int] = None,
    u: dict = Depends(_require_any_user),
):
    conditions = ["p.conjunto_id = %s", "p.activo = TRUE"]
    params: list = [conjunto_id]
    if etapa:      conditions.append("p.etapa = %s");          params.append(etapa)
    if tipo:       conditions.append("p.tipo = %s");           params.append(tipo)
    if prioridad:  conditions.append("p.prioridad = %s");      params.append(prioridad)
    if zona_tipo:  conditions.append("p.zona_tipo = %s");      params.append(zona_tipo)
    if responsable_id:
        conditions.append("p.responsable_id = %s"); params.append(responsable_id)

    # Residentes solo ven proyectos marcados como visibles
    if u.get("rol") in ROLES_RESIDENTES:
        conditions.append("p.visible_residentes = TRUE")

    where = " AND ".join(conditions)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT p.*,
                       r.nombre AS responsable_nombre,
                       prov.nombre AS proveedor_nombre,
                       cb.nombre  AS creado_por_nombre,
                       t.nombre   AS zona_torre_nombre,
                       z.nombre   AS zona_comun_nombre,
                       (SELECT COUNT(*) FROM proyecto_cotizaciones WHERE proyecto_id = p.id) AS num_cotizaciones,
                       (SELECT COUNT(*) FROM proyecto_votos pv
                        JOIN proyecto_aprobaciones pa ON pa.id = pv.aprobacion_id
                        WHERE pv.proyecto_id = p.id AND pa.estado = 'pendiente'
                          AND pv.decision IS NULL AND pv.usuario_id = %s) AS mi_voto_pendiente
                FROM proyectos p
                LEFT JOIN usuarios r    ON r.id = p.responsable_id
                LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
                LEFT JOIN usuarios cb  ON cb.id = p.creado_por
                LEFT JOIN torres t     ON t.id = p.zona_id AND p.zona_tipo = 'torre'
                LEFT JOIN zonas_comunes z ON z.id = p.zona_id AND p.zona_tipo = 'zona_comun'
                WHERE {where}
                ORDER BY p.created_at DESC
            """, [u.get("sub")] + params)
            return cur.fetchall()


@router.post("", status_code=201)
def create_proyecto(body: ProyectoCreate, u: dict = Depends(_require_any_user)):
    # Residentes solo pueden crear tareas/solicitudes
    if u.get("rol") in ROLES_RESIDENTES and body.tipo != "tarea":
        raise HTTPException(403, "Los residentes solo pueden crear solicitudes (tipo tarea)")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO proyectos
                  (conjunto_id, titulo, tipo, descripcion, prioridad,
                   zona_tipo, zona_id, zona_texto, responsable_id, proveedor_id,
                   fecha_compromiso, visible_residentes, creado_por)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                body.conjunto_id, body.titulo, body.tipo, body.descripcion, body.prioridad,
                body.zona_tipo, body.zona_id, body.zona_texto,
                body.responsable_id, body.proveedor_id,
                body.fecha_compromiso, body.visible_residentes, u.get("sub"),
            ))
            proyecto = dict(cur.fetchone())
            tipo_label = "solicitud" if body.tipo == "tarea" else body.tipo
            _log_comentario(cur, proyecto["id"], u.get("sub"),
                            f"Creado por {u.get('nombre','—')} como {tipo_label}.")
            return proyecto


@router.get("/reporte/variacion")
def reporte_variacion(conjunto_id: int, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.titulo, p.tipo, p.etapa,
                       p.presupuesto_aprobado, p.costo_final,
                       CASE WHEN p.presupuesto_aprobado > 0
                            THEN ROUND(((p.costo_final - p.presupuesto_aprobado) / p.presupuesto_aprobado * 100)::numeric, 2)
                            ELSE NULL END AS variacion_pct,
                       (p.costo_final - p.presupuesto_aprobado) AS variacion_abs,
                       p.fecha_cierre_real
                FROM proyectos p
                WHERE p.conjunto_id = %s
                  AND p.etapa = 'COMPLETED'
                  AND p.activo = TRUE
                  AND p.presupuesto_aprobado IS NOT NULL
                ORDER BY p.fecha_cierre_real DESC NULLS LAST
            """, (conjunto_id,))
            return cur.fetchall()


@router.get("/alertas/proximas")
def alertas_proximas(conjunto_id: int, dias: int = 7, u: dict = Depends(_require_access)):
    limite = date.today() + timedelta(days=dias)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.titulo, p.tipo, p.etapa, p.prioridad, p.fecha_compromiso
                FROM proyectos p
                WHERE p.conjunto_id = %s
                  AND p.activo = TRUE
                  AND p.etapa NOT IN ('COMPLETED','CANCELLED')
                  AND p.fecha_compromiso IS NOT NULL
                  AND p.fecha_compromiso <= %s
                ORDER BY p.fecha_compromiso ASC
            """, (conjunto_id, limite))
            return cur.fetchall()


@router.get("/{proyecto_id}")
def get_proyecto(proyecto_id: int, u: dict = Depends(_require_any_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.*,
                       r.nombre  AS responsable_nombre,
                       prov.nombre AS proveedor_nombre,
                       cb.nombre AS creado_por_nombre,
                       t.nombre  AS zona_torre_nombre,
                       z.nombre  AS zona_comun_nombre
                FROM proyectos p
                LEFT JOIN usuarios r    ON r.id = p.responsable_id
                LEFT JOIN proveedores prov ON prov.id = p.proveedor_id
                LEFT JOIN usuarios cb  ON cb.id = p.creado_por
                LEFT JOIN torres t     ON t.id = p.zona_id AND p.zona_tipo = 'torre'
                LEFT JOIN zonas_comunes z ON z.id = p.zona_id AND p.zona_tipo = 'zona_comun'
                WHERE p.id = %s AND p.activo = TRUE
            """, (proyecto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Proyecto no encontrado")
            p = dict(row)
            if u.get("rol") in ROLES_RESIDENTES and not p.get("visible_residentes"):
                raise HTTPException(403, "Este proyecto no es visible para residentes")
            return p


@router.put("/{proyecto_id}")
def update_proyecto(proyecto_id: int, body: ProyectoUpdate, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT etapa FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Proyecto no encontrado")
            etapa_actual = row["etapa"]

            fields, values = [], []
            etapas_post_ejecucion = ["IN_PROGRESS", "MONITORING", "COMPLETED"]

            data = body.model_dump(exclude_none=True)
            for field, val in data.items():
                # presupuesto_aprobado no editable post IN_PROGRESS
                if field == "presupuesto_aprobado" and etapa_actual in etapas_post_ejecucion:
                    continue
                fields.append(f"{field} = %s")
                values.append(val)

            if not fields:
                return {"message": "Sin cambios"}

            fields.append("updated_at = NOW()")
            values.append(proyecto_id)
            cur.execute(f"UPDATE proyectos SET {', '.join(fields)} WHERE id = %s RETURNING *", values)
            return dict(cur.fetchone())


@router.delete("/{proyecto_id}", status_code=204)
def delete_proyecto(proyecto_id: int, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE proyectos SET activo = FALSE WHERE id = %s", (proyecto_id,))


# ── Ciclo de vida ─────────────────────────────────────────────────────────────

@router.post("/{proyecto_id}/avanzar")
def avanzar_etapa(proyecto_id: int, body: AvanzarBody, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Proyecto no encontrado")
            if p["etapa"] == "CANCELLED":
                raise HTTPException(400, "Un proyecto cancelado no puede reactivarse")

            siguiente = _next_etapa(p["tipo"], p["etapa"])

            # Validaciones antes de transición
            if p["etapa"] == "QUOTING" and siguiente == "APPROVAL":
                cur.execute(
                    "SELECT COUNT(DISTINCT COALESCE(proveedor_id::text, nombre_proveedor)) AS n "
                    "FROM proyecto_cotizaciones WHERE proyecto_id = %s",
                    (proyecto_id,),
                )
                n = cur.fetchone()["n"]
                minimo = 3 if p["tipo"] == "proyecto_mayor" else 1
                if n < minimo:
                    raise HTTPException(400, f"Se requieren al menos {minimo} cotización(es) de proveedores distintos")

            if p["etapa"] == "APPROVAL" and siguiente == "PLANNING":
                cur.execute(
                    "SELECT estado FROM proyecto_aprobaciones "
                    "WHERE proyecto_id = %s ORDER BY created_at DESC LIMIT 1",
                    (proyecto_id,),
                )
                apr = cur.fetchone()
                if not apr or apr["estado"] not in ("aprobado", "aprobado_por_acta"):
                    raise HTTPException(400, "El proyecto aún no ha sido aprobado por el Consejo")

            # Campos adicionales según la transición
            extra_fields, extra_vals = [], []
            if p["etapa"] == "APPROVAL" and siguiente == "PLANNING" and body.fecha_nueva_entrega:
                extra_fields.append("fecha_compromiso = %s")
                extra_vals.append(body.fecha_nueva_entrega)
            if p["etapa"] == "IN_PROGRESS" and siguiente == "MONITORING":
                if body.descripcion_control:
                    extra_fields.append("descripcion_control = %s")
                    extra_vals.append(body.descripcion_control)
                if body.garantia_meses is not None:
                    extra_fields.append("garantia_meses = %s")
                    extra_vals.append(body.garantia_meses)
                if body.fecha_cierre_real:
                    extra_fields.append("fecha_cierre_real = %s")
                    extra_vals.append(body.fecha_cierre_real)

            extra_set = (", " + ", ".join(extra_fields)) if extra_fields else ""
            cur.execute(
                f"UPDATE proyectos SET etapa = %s, updated_at = NOW(){extra_set} WHERE id = %s",
                [siguiente] + extra_vals + [proyecto_id],
            )
            de = ETAPA_LABELS.get(p["etapa"], p["etapa"])
            a = ETAPA_LABELS.get(siguiente, siguiente)
            texto = f"Etapa avanzada de '{de}' a '{a}'."
            if body.justificacion:
                texto += f" Nota: {body.justificacion}"
            _log_comentario(cur, proyecto_id, u.get("sub"), texto)
            return {"etapa": siguiente}


@router.post("/{proyecto_id}/cancelar")
def cancelar_proyecto(proyecto_id: int, body: CancelarBody, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT etapa FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Proyecto no encontrado")
            if row["etapa"] == "CANCELLED":
                raise HTTPException(400, "Ya está cancelado")
            cur.execute(
                "UPDATE proyectos SET etapa = 'CANCELLED', updated_at = NOW() WHERE id = %s",
                (proyecto_id,),
            )
            _log_comentario(cur, proyecto_id, u.get("sub"),
                            f"Proyecto CANCELADO. Motivo: {body.justificacion}")
            return {"etapa": "CANCELLED"}


@router.post("/{proyecto_id}/convertir")
def convertir_a_proyecto(proyecto_id: int, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT tipo, etapa FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Proyecto no encontrado")
            if row["tipo"] != "tarea":
                raise HTTPException(400, "Solo las tareas pueden convertirse a proyecto")
            if row["etapa"] not in ("PENDING", "STARTED"):
                raise HTTPException(400, "Solo se puede convertir en etapas PENDING o STARTED")
            cur.execute(
                "UPDATE proyectos SET tipo = 'proyecto', updated_at = NOW() WHERE id = %s",
                (proyecto_id,),
            )
            _log_comentario(cur, proyecto_id, u.get("sub"),
                            "Convertida de Tarea a Proyecto. Ahora puede agregar cotizaciones.")
            return {"tipo": "proyecto"}


# ── Cotizaciones ──────────────────────────────────────────────────────────────

@router.get("/{proyecto_id}/cotizaciones")
def list_cotizaciones(proyecto_id: int, u: dict = Depends(_require_access)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*, prov.nombre AS proveedor_cat_nombre
                FROM proyecto_cotizaciones c
                LEFT JOIN proveedores prov ON prov.id = c.proveedor_id
                WHERE c.proyecto_id = %s
                ORDER BY c.created_at ASC
            """, (proyecto_id,))
            return cur.fetchall()


@router.post("/{proyecto_id}/cotizaciones", status_code=201)
def create_cotizacion(proyecto_id: int, body: CotizacionCreate, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT tipo FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Proyecto no encontrado")
            if p["tipo"] == "tarea":
                raise HTTPException(400, "Las tareas no pueden tener cotizaciones formales. Conviértela a proyecto primero.")

            # Validar proveedor duplicado
            if body.proveedor_id:
                cur.execute(
                    "SELECT id FROM proyecto_cotizaciones WHERE proyecto_id = %s AND proveedor_id = %s",
                    (proyecto_id, body.proveedor_id),
                )
                if cur.fetchone():
                    raise HTTPException(400, "Ya existe una cotización de este proveedor para este proyecto")

            cur.execute("""
                INSERT INTO proyecto_cotizaciones
                  (proyecto_id, proveedor_id, nombre_proveedor, monto, fecha_cotizacion,
                   archivo_url, nombre_archivo, creado_por)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                proyecto_id, body.proveedor_id, body.nombre_proveedor,
                body.monto, body.fecha_cotizacion,
                body.archivo_base64, body.nombre_archivo, u.get("sub"),
            ))
            return dict(cur.fetchone())


@router.patch("/{proyecto_id}/cotizaciones/{cot_id}")
def update_cotizacion_estado(proyecto_id: int, cot_id: int, body: CotizacionEstado, u: dict = Depends(_require_admin)):
    if body.estado not in ("seleccionada", "descartada", "pendiente"):
        raise HTTPException(400, "Estado inválido")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE proyecto_cotizaciones SET estado = %s WHERE id = %s AND proyecto_id = %s RETURNING *",
                (body.estado, cot_id, proyecto_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cotización no encontrada")
            return dict(row)


@router.delete("/{proyecto_id}/cotizaciones/{cot_id}", status_code=204)
def delete_cotizacion(proyecto_id: int, cot_id: int, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM proyecto_cotizaciones WHERE id = %s AND proyecto_id = %s",
                (cot_id, proyecto_id),
            )


# ── Evidencias ────────────────────────────────────────────────────────────────

@router.get("/{proyecto_id}/evidencias")
def list_evidencias(proyecto_id: int, u: dict = Depends(_require_any_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.*, usr.nombre AS subido_por_nombre
                FROM proyecto_evidencias e
                LEFT JOIN usuarios usr ON usr.id = e.subido_por
                WHERE e.proyecto_id = %s
                ORDER BY e.created_at DESC
            """, (proyecto_id,))
            return cur.fetchall()


@router.post("/{proyecto_id}/evidencias", status_code=201)
async def upload_evidencia(
    proyecto_id: int,
    tipo_evidencia: str = Form(...),
    descripcion: Optional[str] = Form(None),
    file: UploadFile = File(...),
    u: dict = Depends(_require_any_user),
):
    content = await file.read()
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    b64 = f"data:{mime};base64," + base64.b64encode(content).decode()

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT etapa FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Proyecto no encontrado")
            cur.execute("""
                INSERT INTO proyecto_evidencias
                  (proyecto_id, nombre_archivo, tipo_evidencia, url, descripcion, etapa_carga, subido_por)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING id, nombre_archivo, tipo_evidencia, descripcion, etapa_carga, created_at
            """, (proyecto_id, file.filename, tipo_evidencia, b64, descripcion, p["etapa"], u.get("sub")))
            return dict(cur.fetchone())


@router.delete("/{proyecto_id}/evidencias/{ev_id}", status_code=204)
def delete_evidencia(proyecto_id: int, ev_id: int, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM proyecto_evidencias WHERE id = %s AND proyecto_id = %s",
                (ev_id, proyecto_id),
            )


# ── Comentarios / Historial ───────────────────────────────────────────────────

@router.get("/{proyecto_id}/comentarios")
def list_comentarios(proyecto_id: int, u: dict = Depends(_require_any_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*, usr.nombre AS usuario_nombre, usr.rol AS usuario_rol
                FROM proyecto_comentarios c
                LEFT JOIN usuarios usr ON usr.id = c.usuario_id
                WHERE c.proyecto_id = %s
                ORDER BY c.created_at ASC
            """, (proyecto_id,))
            return cur.fetchall()


@router.post("/{proyecto_id}/comentarios", status_code=201)
def add_comentario(proyecto_id: int, body: ComentarioCreate, u: dict = Depends(_require_access)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Proyecto no encontrado")
            cur.execute("""
                INSERT INTO proyecto_comentarios
                  (proyecto_id, usuario_id, texto, archivo_url, nombre_archivo)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                proyecto_id, u.get("sub"), body.texto,
                body.archivo_base64, body.nombre_archivo,
            ))
            return dict(cur.fetchone())


# ── Flujo de aprobación ───────────────────────────────────────────────────────

@router.post("/{proyecto_id}/enviar-aprobacion")
def enviar_aprobacion(proyecto_id: int, body: EnviarAprobacionBody, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Proyecto no encontrado")
            if p["tipo"] == "tarea":
                raise HTTPException(400, "Las tareas no requieren aprobación del Consejo")
            if p["etapa"] != "QUOTING":
                raise HTTPException(400, "El proyecto debe estar en etapa QUOTING para enviar a aprobación")

            # Verificar que hay aprobación pendiente previa o crear nueva
            cur.execute(
                "SELECT id FROM proyecto_aprobaciones WHERE proyecto_id = %s AND estado = 'pendiente'",
                (proyecto_id,),
            )
            if cur.fetchone():
                raise HTTPException(400, "Ya existe una solicitud de aprobación pendiente")

            # Obtener miembros activos con cuenta vinculada
            cur.execute("""
                SELECT cm.id AS miembro_id, cm.nombre, cm.cargo, cm.residente_id
                FROM consejo_miembros cm
                WHERE cm.conjunto_id = %s AND cm.activo = TRUE AND cm.tipo = 'activo'
                  AND cm.residente_id IS NOT NULL
            """, (p["conjunto_id"],))
            miembros = cur.fetchall()
            if not miembros:
                raise HTTPException(400, "No hay miembros activos del Consejo con cuenta vinculada")

            # Crear aprobación
            cur.execute("""
                INSERT INTO proyecto_aprobaciones
                  (proyecto_id, nota_admin, fecha_limite, registrado_por)
                VALUES (%s,%s,%s,%s)
                RETURNING id
            """, (proyecto_id, body.nota_admin, body.fecha_limite, u.get("sub")))
            aprobacion_id = cur.fetchone()["id"]

            # Crear voto por cada miembro (decision NULL = pendiente)
            for m in miembros:
                cur.execute("""
                    INSERT INTO proyecto_votos
                      (aprobacion_id, proyecto_id, miembro_id, usuario_id)
                    VALUES (%s,%s,%s,%s)
                    ON CONFLICT (aprobacion_id, miembro_id) DO NOTHING
                """, (aprobacion_id, proyecto_id, m["miembro_id"], m["residente_id"]))

            # Avanzar etapa a APPROVAL
            cur.execute(
                "UPDATE proyectos SET etapa = 'APPROVAL', updated_at = NOW() WHERE id = %s",
                (proyecto_id,),
            )

            nombres = ", ".join(m["nombre"] for m in miembros)
            _log_comentario(cur, proyecto_id, u.get("sub"),
                            f"Solicitud de aprobación enviada a {len(miembros)} miembro(s) del Consejo: {nombres}."
                            + (f" Nota: {body.nota_admin}" if body.nota_admin else ""))

            return {"aprobacion_id": aprobacion_id, "miembros_notificados": len(miembros)}


@router.get("/{proyecto_id}/votos")
def get_votos(proyecto_id: int, u: dict = Depends(_require_any_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pa.id AS aprobacion_id, pa.estado AS aprobacion_estado,
                       pa.nota_admin, pa.fecha_limite, pa.created_at AS enviado_at,
                       pa.acta_numero, pa.acta_fecha, pa.acta_descripcion, pa.cerrado_at,
                       COALESCE(
                           json_agg(json_build_object(
                               'voto_id', pv.id,
                               'miembro_id', pv.miembro_id,
                               'miembro_nombre', cm.nombre,
                               'miembro_cargo', cm.cargo,
                               'usuario_id', pv.usuario_id,
                               'decision', pv.decision,
                               'comentario', pv.comentario,
                               'votado_at', pv.created_at
                           ) ORDER BY cm.nombre) FILTER (WHERE pv.id IS NOT NULL),
                           '[]'::json
                       ) AS votos
                FROM proyecto_aprobaciones pa
                LEFT JOIN proyecto_votos pv ON pv.aprobacion_id = pa.id
                LEFT JOIN consejo_miembros cm ON cm.id = pv.miembro_id
                WHERE pa.proyecto_id = %s
                GROUP BY pa.id
                ORDER BY pa.created_at DESC
            """, (proyecto_id,))
            return cur.fetchall()


@router.post("/{proyecto_id}/votar")
def votar(proyecto_id: int, body: VotarBody, u: dict = Depends(_require_access)):
    if u.get("rol") not in ("consejo", "administrador", "superadmin"):
        raise HTTPException(403, "Sin permiso para votar")
    if body.decision not in ("aprobado", "rechazado"):
        raise HTTPException(400, "Decisión inválida")
    if body.decision == "rechazado" and not body.comentario:
        raise HTTPException(400, "El comentario es obligatorio al rechazar")

    usuario_id = int(u.get("sub"))
    with get_db() as conn:
        with conn.cursor() as cur:
            # Buscar voto pendiente de este usuario
            cur.execute("""
                SELECT pv.id, pv.aprobacion_id, pa.estado AS apr_estado
                FROM proyecto_votos pv
                JOIN proyecto_aprobaciones pa ON pa.id = pv.aprobacion_id
                WHERE pv.proyecto_id = %s AND pv.usuario_id = %s AND pv.decision IS NULL
                  AND pa.estado = 'pendiente'
                LIMIT 1
            """, (proyecto_id, usuario_id))
            voto = cur.fetchone()
            if not voto:
                raise HTTPException(400, "No tienes un voto pendiente para este proyecto")

            # Registrar voto
            cur.execute(
                "UPDATE proyecto_votos SET decision = %s, comentario = %s, created_at = NOW() "
                "WHERE id = %s",
                (body.decision, body.comentario, voto["id"]),
            )

            # Obtener nombre del votante
            cur.execute("SELECT nombre FROM usuarios WHERE id = %s", (usuario_id,))
            nombre = cur.fetchone()["nombre"]

            if body.decision == "rechazado":
                # Rechazo inmediato → CANCELLED
                cur.execute(
                    "UPDATE proyecto_aprobaciones SET estado = 'rechazado', cerrado_at = NOW() WHERE id = %s",
                    (voto["aprobacion_id"],),
                )
                cur.execute(
                    "UPDATE proyectos SET etapa = 'CANCELLED', updated_at = NOW() WHERE id = %s",
                    (proyecto_id,),
                )
                _log_comentario(cur, proyecto_id, usuario_id,
                                f"RECHAZADO por {nombre}. Proyecto cancelado automáticamente."
                                + (f" Motivo: {body.comentario}" if body.comentario else ""))
                return {"resultado": "rechazado", "etapa": "CANCELLED"}

            # Voto aprobado — verificar si todos aprobaron
            _log_comentario(cur, proyecto_id, usuario_id,
                            f"APROBADO por {nombre}."
                            + (f" Comentario: {body.comentario}" if body.comentario else ""))

            cur.execute("""
                SELECT COUNT(*) FILTER (WHERE decision IS NULL) AS pendientes,
                       COUNT(*) FILTER (WHERE decision = 'aprobado') AS aprobados,
                       COUNT(*) AS total
                FROM proyecto_votos
                WHERE aprobacion_id = %s
            """, (voto["aprobacion_id"],))
            stats = cur.fetchone()

            if stats["pendientes"] == 0 and stats["aprobados"] == stats["total"]:
                # Unanimidad
                cur.execute(
                    "UPDATE proyecto_aprobaciones SET estado = 'aprobado', cerrado_at = NOW() WHERE id = %s",
                    (voto["aprobacion_id"],),
                )
                cur.execute(
                    "UPDATE proyectos SET etapa = 'PLANNING', updated_at = NOW() WHERE id = %s",
                    (proyecto_id,),
                )
                _log_comentario(cur, proyecto_id, None,
                                f"Aprobado por unanimidad ({stats['total']} votos). Proyecto avanza a Planificación.")
                return {"resultado": "aprobado_unanimidad", "etapa": "PLANNING"}

            return {"resultado": "voto_registrado", "pendientes": stats["pendientes"]}


@router.post("/{proyecto_id}/aprobar-por-acta")
def aprobar_por_acta(proyecto_id: int, body: AprobarPorActaBody, u: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT etapa FROM proyectos WHERE id = %s AND activo = TRUE", (proyecto_id,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Proyecto no encontrado")
            if p["etapa"] != "APPROVAL":
                raise HTTPException(400, "El proyecto debe estar en etapa APPROVAL")

            # Buscar o crear aprobación
            cur.execute(
                "SELECT id FROM proyecto_aprobaciones WHERE proyecto_id = %s AND estado = 'pendiente' "
                "ORDER BY created_at DESC LIMIT 1",
                (proyecto_id,),
            )
            apr = cur.fetchone()
            if apr:
                aprobacion_id = apr["id"]
                cur.execute(
                    "UPDATE proyecto_aprobaciones SET estado = 'aprobado_por_acta', cerrado_at = NOW(), "
                    "acta_numero = %s, acta_fecha = %s, acta_descripcion = %s, acta_url = %s "
                    "WHERE id = %s",
                    (body.acta_numero, body.acta_fecha, body.acta_descripcion,
                     body.archivo_base64, aprobacion_id),
                )
            else:
                cur.execute("""
                    INSERT INTO proyecto_aprobaciones
                      (proyecto_id, estado, acta_numero, acta_fecha, acta_descripcion,
                       acta_url, registrado_por, cerrado_at)
                    VALUES (%s,'aprobado_por_acta',%s,%s,%s,%s,%s,NOW())
                """, (proyecto_id, body.acta_numero, body.acta_fecha,
                      body.acta_descripcion, body.archivo_base64, u.get("sub")))

            cur.execute(
                "UPDATE proyectos SET etapa = 'PLANNING', updated_at = NOW() WHERE id = %s",
                (proyecto_id,),
            )
            _log_comentario(cur, proyecto_id, u.get("sub"),
                            f"Aprobado por Acta de Asamblea #{body.acta_numero} "
                            f"(fecha {body.acta_fecha}). Proyecto avanza a PLANNING.")
            return {"etapa": "PLANNING", "metodo": "acta"}


# ── Votos pendientes para el usuario actual ───────────────────────────────────

@router.get("/mis-votos/pendientes")
def mis_votos_pendientes(conjunto_id: int, u: dict = Depends(_require_access)):
    usuario_id = int(u.get("sub"))
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.titulo, p.tipo, p.descripcion, p.prioridad,
                       pa.id AS aprobacion_id, pa.nota_admin, pa.fecha_limite,
                       pv.id AS voto_id,
                       (SELECT COUNT(*) FROM proyecto_cotizaciones WHERE proyecto_id = p.id) AS num_cotizaciones
                FROM proyecto_votos pv
                JOIN proyecto_aprobaciones pa ON pa.id = pv.aprobacion_id
                JOIN proyectos p ON p.id = pv.proyecto_id
                WHERE pv.usuario_id = %s
                  AND pv.decision IS NULL
                  AND pa.estado = 'pendiente'
                  AND p.conjunto_id = %s
                  AND p.activo = TRUE
                ORDER BY pa.fecha_limite ASC NULLS LAST, p.created_at DESC
            """, (usuario_id, conjunto_id))
            return cur.fetchall()
