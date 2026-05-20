from fastapi import APIRouter
from typing import Optional
from db import get_db

router = APIRouter()


@router.get("/dashboard/{conjunto_id}")
def reporte_dashboard(conjunto_id: int):
    """Full dashboard stats for a building."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM unidades u JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND u.activo=TRUE) AS total_unidades,
                    (SELECT COUNT(*) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.estado='vencido') AS morosos,
                    (SELECT COUNT(*) FROM mantenimientos
                        WHERE conjunto_id=%s AND estado IN ('pendiente','en_proceso')) AS solicitudes_pendientes,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.estado='pagado'
                        AND c.mes=TO_CHAR(NOW(),'YYYY-MM')) AS recaudo_mes,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.mes=TO_CHAR(NOW(),'YYYY-MM')) AS meta_recaudo,
                    (SELECT COUNT(*) FROM accesos
                        WHERE conjunto_id=%s AND DATE(fecha_entrada)=CURRENT_DATE) AS ingresos_hoy,
                    (SELECT COUNT(*) FROM paquetes
                        WHERE conjunto_id=%s AND estado IN ('recibido','notificado')) AS paquetes_pendientes,
                    (SELECT COUNT(*) FROM mantenimiento_alertas
                        WHERE conjunto_id=%s AND estado='pendiente'
                        AND fecha_programada <= CURRENT_DATE + 7) AS alertas_proximas,
                    -- Indicadores operacionales extendidos
                    (SELECT COUNT(*) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.estado='pendiente') AS cuotas_pendientes,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.estado='pendiente') AS cuotas_pendientes_monto,
                    (SELECT COALESCE(SUM(c.monto),0) FROM cuotas c JOIN unidades u ON u.id=c.unidad_id
                        JOIN torres t ON t.id=u.torre_id
                        WHERE t.conjunto_id=%s AND c.estado='vencido') AS cuotas_vencidas_monto,
                    (SELECT COUNT(*) FROM reservas r JOIN zonas_comunes z ON z.id=r.zona_id
                        WHERE z.conjunto_id=%s AND r.fecha=CURRENT_DATE AND r.estado != 'cancelada') AS reservas_hoy,
                    (SELECT ROUND(
                        100.0 * COUNT(DISTINCT o.unidad_id) /
                        NULLIF((SELECT COUNT(*) FROM unidades u2 JOIN torres t2 ON t2.id=u2.torre_id
                                WHERE t2.conjunto_id=%s AND u2.activo=TRUE), 0), 1)
                     FROM ocupaciones o JOIN unidades u ON u.id=o.unidad_id
                     JOIN torres t ON t.id=u.torre_id
                     WHERE t.conjunto_id=%s AND o.activo=TRUE) AS ocupacion_pct
            """, (conjunto_id,) * 14)
            return cur.fetchone()


@router.get("/finanzas/{conjunto_id}")
def reporte_finanzas(conjunto_id: int, meses: int = 6):
    """Monthly financial summary for the last N months."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.mes,
                       COUNT(*) as total_cuotas,
                       COUNT(*) FILTER (WHERE c.estado='pagado') as pagadas,
                       COUNT(*) FILTER (WHERE c.estado='vencido') as vencidas,
                       COALESCE(SUM(c.monto) FILTER (WHERE c.estado='pagado'), 0) as recaudado,
                       COALESCE(SUM(c.monto), 0) as total
                FROM cuotas c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN torres t ON t.id = u.torre_id
                WHERE t.conjunto_id = %s
                GROUP BY c.mes
                ORDER BY c.mes DESC
                LIMIT %s
            """, (conjunto_id, meses))
            return cur.fetchall()


@router.get("/mantenimiento/{conjunto_id}")
def reporte_mantenimiento(conjunto_id: int):
    """Maintenance summary by category and status."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT categoria,
                       COUNT(*) as total,
                       COUNT(*) FILTER (WHERE estado='pendiente') as pendientes,
                       COUNT(*) FILTER (WHERE estado='en_proceso') as en_proceso,
                       COUNT(*) FILTER (WHERE estado='resuelto') as resueltos,
                       COALESCE(AVG(EXTRACT(EPOCH FROM (fecha_resolucion - fecha_solicitud))/3600), 0)
                           AS promedio_horas_resolucion
                FROM mantenimientos
                WHERE conjunto_id = %s
                GROUP BY categoria ORDER BY total DESC
            """, (conjunto_id,))
            por_categoria = cur.fetchall()

            cur.execute("""
                SELECT prioridad, COUNT(*) as total,
                       COUNT(*) FILTER (WHERE estado IN ('pendiente','en_proceso')) as abiertos
                FROM mantenimientos WHERE conjunto_id = %s
                GROUP BY prioridad
            """, (conjunto_id,))
            por_prioridad = cur.fetchall()

            return {"por_categoria": por_categoria, "por_prioridad": por_prioridad}


@router.get("/accesos/{conjunto_id}")
def reporte_accesos(conjunto_id: int, dias: int = 7):
    """Access log summary for the last N days."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DATE(fecha_entrada) as fecha,
                       COUNT(*) as total,
                       COUNT(*) FILTER (WHERE autorizado=FALSE) as no_autorizados,
                       COUNT(*) FILTER (WHERE motivo='domicilio') as domicilios,
                       COUNT(*) FILTER (WHERE motivo='visita') as visitas,
                       COUNT(*) FILTER (WHERE motivo='servicio_tecnico') as servicios
                FROM accesos
                WHERE conjunto_id = %s
                AND fecha_entrada >= NOW() - INTERVAL '%s days'
                GROUP BY DATE(fecha_entrada)
                ORDER BY fecha DESC
            """, (conjunto_id, dias))
            return cur.fetchall()


@router.get("/paquetes/{conjunto_id}")
def reporte_paquetes(conjunto_id: int):
    """Package tracking summary."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE estado='recibido') as recibidos,
                    COUNT(*) FILTER (WHERE estado='notificado') as notificados,
                    COUNT(*) FILTER (WHERE estado='entregado') as entregados,
                    COUNT(*) FILTER (WHERE estado='devuelto') as devueltos,
                    COUNT(*) FILTER (WHERE DATE(fecha_recepcion)=CURRENT_DATE) as hoy,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (fecha_entrega - fecha_recepcion))/3600)
                        FILTER (WHERE estado='entregado'), 0) as promedio_horas_entrega
                FROM paquetes WHERE conjunto_id = %s
            """, (conjunto_id,))
            resumen = cur.fetchone()

            cur.execute("""
                SELECT empresa_mensajeria, COUNT(*) as total
                FROM paquetes WHERE conjunto_id = %s AND empresa_mensajeria IS NOT NULL
                GROUP BY empresa_mensajeria ORDER BY total DESC LIMIT 5
            """, (conjunto_id,))
            por_empresa = cur.fetchall()

            return {"resumen": resumen, "por_empresa": por_empresa}


@router.get("/guardias/{conjunto_id}")
def reporte_guardias(conjunto_id: int):
    """Guard schedule and event summary."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.nombre as guardia_nombre,
                       COUNT(t.id) as total_turnos,
                       COUNT(t.id) FILTER (WHERE t.estado='completado') as completados,
                       COUNT(t.id) FILTER (WHERE t.estado='ausente') as ausencias,
                       COUNT(ev.id) as total_eventos
                FROM guardias g
                JOIN usuarios u ON u.id = g.usuario_id
                LEFT JOIN turnos t ON t.guardia_id = g.id
                LEFT JOIN guardia_eventos ev ON ev.guardia_id = g.id
                WHERE g.conjunto_id = %s AND g.activo = TRUE
                GROUP BY u.nombre ORDER BY u.nombre
            """, (conjunto_id,))
            return cur.fetchall()
