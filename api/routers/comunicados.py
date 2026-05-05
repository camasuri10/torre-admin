import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from db import get_db

router = APIRouter()


class ComunicadoCreate(BaseModel):
    edificio_id: Optional[int] = None   # None = todos los edificios
    titulo: str
    contenido: str
    tipo: str   # informativo | urgente | convocatoria | recordatorio
    autor_id: Optional[int] = None
    fecha: Optional[str] = None
    canales: Optional[List[str]] = ["sistema"]
    fecha_programada: Optional[str] = None
    imagen_url: Optional[str] = None


class MarcarLeidoData(BaseModel):
    usuario_id: int


@router.get("")
def list_comunicados(
    edificio_id: Optional[int] = None,
    tipo: Optional[str] = None,
    usuario_id: Optional[int] = None,
):
    with get_db() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT c.*,
                       e.nombre as edificio_nombre,
                       u.nombre as autor_nombre,
                       CASE WHEN ce.leido IS NULL THEN FALSE ELSE ce.leido END as leido
                FROM comunicados c
                LEFT JOIN edificios e ON e.id = c.edificio_id
                LEFT JOIN usuarios u ON u.id = c.autor_id
                LEFT JOIN comunicado_envios ce
                       ON ce.comunicado_id = c.id
                      AND (%s::integer IS NULL OR ce.usuario_id = %s)
                      AND ce.canal = 'sistema'
                WHERE 1=1
            """
            params: list = [usuario_id, usuario_id]
            if edificio_id:
                query += " AND (c.edificio_id = %s OR c.edificio_id IS NULL)"
                params.append(edificio_id)
            if tipo:
                query += " AND c.tipo = %s"
                params.append(tipo)
            query += " ORDER BY c.created_at DESC"
            cur.execute(query, params)
            return cur.fetchall()


@router.get("/{comunicado_id}")
def get_comunicado(comunicado_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*, e.nombre as edificio_nombre, u.nombre as autor_nombre
                FROM comunicados c
                LEFT JOIN edificios e ON e.id = c.edificio_id
                LEFT JOIN usuarios u ON u.id = c.autor_id
                WHERE c.id = %s
            """, (comunicado_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comunicado no encontrado")
            return row


@router.get("/{comunicado_id}/envios")
def get_envios(comunicado_id: int):
    """Auditoría: quién recibió el comunicado y por qué canal."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ce.id, ce.canal, ce.enviado_at, ce.leido,
                       u.nombre as usuario_nombre, u.rol as usuario_rol,
                       u.email as usuario_email
                FROM comunicado_envios ce
                JOIN usuarios u ON u.id = ce.usuario_id
                WHERE ce.comunicado_id = %s
                ORDER BY ce.enviado_at DESC
            """, (comunicado_id,))
            return cur.fetchall()


@router.post("", status_code=201)
def create_comunicado(data: ComunicadoCreate):
    canales_json = json.dumps(data.canales or ["sistema"])
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO comunicados
                    (edificio_id, titulo, contenido, tipo, autor_id, fecha,
                     canales, fecha_programada, imagen_url)
                VALUES (%s,%s,%s,%s,%s,COALESCE(%s,CURRENT_DATE),%s,%s,%s)
                RETURNING *
            """, (
                data.edificio_id, data.titulo, data.contenido, data.tipo,
                data.autor_id, data.fecha,
                canales_json, data.fecha_programada, data.imagen_url,
            ))
            comunicado = cur.fetchone()

            # Registrar envíos por cada residente del edificio para auditoría
            if data.edificio_id:
                cur.execute("""
                    SELECT DISTINCT u.id FROM usuarios u
                    JOIN ocupaciones o ON o.usuario_id = u.id
                    JOIN unidades un ON un.id = o.unidad_id
                    JOIN torres t ON t.id = un.torre_id
                    WHERE t.edificio_id = %s AND o.activo = TRUE AND u.activo = TRUE
                """, (data.edificio_id,))
            else:
                cur.execute("SELECT id FROM usuarios WHERE activo = TRUE")
            usuarios = cur.fetchall()

            canales = data.canales or ["sistema"]
            for usr in usuarios:
                for canal in canales:
                    if canal not in ("sistema", "email", "whatsapp"):
                        continue
                    cur.execute("""
                        INSERT INTO comunicado_envios (comunicado_id, usuario_id, canal)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (comunicado_id, usuario_id, canal) DO NOTHING
                    """, (comunicado["id"], usr["id"], canal))

            return comunicado


@router.put("/{comunicado_id}")
def update_comunicado(comunicado_id: int, data: ComunicadoCreate):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE comunicados
                SET edificio_id=%s, titulo=%s, contenido=%s, tipo=%s, autor_id=%s,
                    canales=%s, fecha_programada=%s, imagen_url=%s
                WHERE id=%s RETURNING *
            """, (
                data.edificio_id, data.titulo, data.contenido, data.tipo, data.autor_id,
                json.dumps(data.canales or ["sistema"]), data.fecha_programada, data.imagen_url,
                comunicado_id,
            ))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comunicado no encontrado")
            return row


@router.patch("/envios/{envio_id}/leido")
def marcar_leido(envio_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE comunicado_envios SET leido=TRUE WHERE id=%s RETURNING *",
                (envio_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Envío no encontrado")
            return row


@router.patch("/{comunicado_id}/leido")
def marcar_leido_por_comunicado(comunicado_id: int, data: MarcarLeidoData):
    """Marca como leído el envío 'sistema' de un comunicado para un usuario."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE comunicado_envios SET leido=TRUE
                WHERE comunicado_id=%s AND usuario_id=%s AND canal='sistema'
                RETURNING id
            """, (comunicado_id, data.usuario_id))
            if not cur.fetchone():
                # Si no existe el envío aún, lo crea marcado como leído
                cur.execute("""
                    INSERT INTO comunicado_envios (comunicado_id, usuario_id, canal, leido)
                    VALUES (%s, %s, 'sistema', TRUE)
                    ON CONFLICT (comunicado_id, usuario_id, canal) DO UPDATE SET leido=TRUE
                """, (comunicado_id, data.usuario_id))
            return {"ok": True}


@router.delete("/{comunicado_id}", status_code=204)
def delete_comunicado(comunicado_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM comunicados WHERE id = %s", (comunicado_id,))
