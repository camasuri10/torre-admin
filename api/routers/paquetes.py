from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from db import get_db
import base64

router = APIRouter()


class PaqueteCreate(BaseModel):
    edificio_id: int
    destinatario_id: Optional[int] = None
    unidad_id: Optional[int] = None
    remitente: Optional[str] = None
    descripcion: Optional[str] = None
    empresa_mensajeria: Optional[str] = None
    numero_guia: Optional[str] = None
    recibido_por: Optional[int] = None
    notas: Optional[str] = None


class EntregaRegistro(BaseModel):
    entregado_a: str
    notas: Optional[str] = None


@router.get("")
def list_paquetes(
    edificio_id: Optional[int] = None,
    unidad_id: Optional[int] = None,
    estado: Optional[str] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT p.*, e.nombre as edificio_nombre,
                       u.numero as unidad_numero,
                       dest.nombre as destinatario_nombre,
                       rec.nombre as recibido_por_nombre
                FROM paquetes p
                JOIN edificios e ON e.id = p.edificio_id
                LEFT JOIN unidades u ON u.id = p.unidad_id
                LEFT JOIN usuarios dest ON dest.id = p.destinatario_id
                LEFT JOIN usuarios rec ON rec.id = p.recibido_por
                WHERE 1=1
            """
            params = []
            if edificio_id:
                query += " AND p.edificio_id = %s"
                params.append(edificio_id)
            if unidad_id:
                query += " AND p.unidad_id = %s"
                params.append(unidad_id)
            if estado:
                query += " AND p.estado = %s"
                params.append(estado)
            query += " ORDER BY p.fecha_recepcion DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.get("/{paquete_id}")
def get_paquete(paquete_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.*, e.nombre as edificio_nombre, u.numero as unidad_numero,
                       dest.nombre as destinatario_nombre, rec.nombre as recibido_por_nombre,
                       (SELECT json_agg(json_build_object('canal',n.canal,'enviado_at',n.enviado_at,'leido',n.leido))
                        FROM paquete_notificaciones n WHERE n.paquete_id = p.id) as notificaciones
                FROM paquetes p
                JOIN edificios e ON e.id = p.edificio_id
                LEFT JOIN unidades u ON u.id = p.unidad_id
                LEFT JOIN usuarios dest ON dest.id = p.destinatario_id
                LEFT JOIN usuarios rec ON rec.id = p.recibido_por
                WHERE p.id = %s
            """, (paquete_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Paquete no encontrado")
            return row


@router.post("", status_code=201)
async def registrar_paquete(
    edificio_id: int = Form(...),
    unidad_id: Optional[int] = Form(None),
    destinatario_id: Optional[int] = Form(None),
    remitente: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    empresa_mensajeria: Optional[str] = Form(None),
    numero_guia: Optional[str] = Form(None),
    recibido_por: Optional[int] = Form(None),
    notas: Optional[str] = Form(None),
    foto: Optional[UploadFile] = File(None),
):
    foto_url = None
    if foto:
        content = await foto.read()
        b64 = base64.b64encode(content).decode()
        mime = foto.content_type or "image/jpeg"
        foto_url = f"data:{mime};base64,{b64}"

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO paquetes
                    (edificio_id, destinatario_id, unidad_id, remitente, descripcion,
                     empresa_mensajeria, numero_guia, recibido_por, notas, foto_url, estado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'recibido') RETURNING *
            """, (edificio_id, destinatario_id, unidad_id, remitente, descripcion,
                  empresa_mensajeria, numero_guia, recibido_por, notas, foto_url))
            paquete = cur.fetchone()

            # Auto-create notification for destinatario
            if destinatario_id:
                cur.execute("""
                    INSERT INTO paquete_notificaciones (paquete_id, usuario_id, canal)
                    VALUES (%s, %s, 'app')
                """, (paquete["id"], destinatario_id))
                # Update status to notificado
                cur.execute(
                    "UPDATE paquetes SET estado = 'notificado' WHERE id = %s",
                    (paquete["id"],)
                )
                paquete["estado"] = "notificado"

            return paquete


@router.patch("/{paquete_id}/entregar")
def registrar_entrega(paquete_id: int, data: EntregaRegistro):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE paquetes
                SET estado = 'entregado', fecha_entrega = NOW(), entregado_a = %s, notas = COALESCE(%s, notas)
                WHERE id = %s RETURNING *
            """, (data.entregado_a, data.notas, paquete_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Paquete no encontrado")
            return row


@router.get("/stats/{edificio_id}")
def paquete_stats(edificio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE estado = 'recibido') AS recibidos,
                    COUNT(*) FILTER (WHERE estado = 'notificado') AS notificados,
                    COUNT(*) FILTER (WHERE estado = 'entregado') AS entregados,
                    COUNT(*) FILTER (WHERE DATE(fecha_recepcion) = CURRENT_DATE) AS hoy
                FROM paquetes WHERE edificio_id = %s
            """, (edificio_id,))
            return cur.fetchone()
