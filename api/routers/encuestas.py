"""Encuestas — creación, respuesta y resultados por edificio."""
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


def _require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("administrador", "superadmin", "backoffice"):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return current_user


# ─── Pydantic models ──────────────────────────────────────────────────────────

class OpcionIn(BaseModel):
    texto: str
    orden: int = 1


class PreguntaIn(BaseModel):
    texto: str
    tipo: str  # unica | multiple | escala | texto
    orden: int = 1
    requerida: bool = True
    escala_max: int = 5
    opciones: list[OpcionIn] = []


class EncuestaCreate(BaseModel):
    edificio_id: int
    titulo: str
    descripcion: Optional[str] = None
    anonima: bool = False
    unidades_destino: Optional[str] = None  # None=todos, JSON array de unidad_ids
    fecha_inicio: Optional[str] = None
    fecha_cierre: Optional[str] = None
    preguntas: list[PreguntaIn] = []


class EncuestaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    anonima: Optional[bool] = None
    unidades_destino: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_cierre: Optional[str] = None
    preguntas: Optional[list[PreguntaIn]] = None


class EstadoUpdate(BaseModel):
    estado: str  # borrador | activa | cerrada


class RespuestaIn(BaseModel):
    pregunta_id: int
    opcion_ids: list[int] = []
    texto_libre: Optional[str] = None
    valor_escala: Optional[int] = None


class SubmitEncuesta(BaseModel):
    usuario_id: int
    unidad_id: Optional[int] = None
    respuestas: list[RespuestaIn]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fetch_preguntas(cur, encuesta_id: int) -> list:
    cur.execute(
        "SELECT * FROM encuesta_preguntas WHERE encuesta_id = %s ORDER BY orden",
        (encuesta_id,),
    )
    preguntas = [dict(r) for r in cur.fetchall()]
    for p in preguntas:
        if p["tipo"] in ("unica", "multiple"):
            cur.execute(
                "SELECT * FROM encuesta_opciones WHERE pregunta_id = %s ORDER BY orden",
                (p["id"],),
            )
            p["opciones"] = [dict(o) for o in cur.fetchall()]
        else:
            p["opciones"] = []
    return preguntas


def _insert_preguntas(cur, encuesta_id: int, preguntas: list[PreguntaIn]):
    for i, p in enumerate(preguntas, start=1):
        cur.execute(
            """INSERT INTO encuesta_preguntas
               (encuesta_id, orden, texto, tipo, requerida, escala_max)
               VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
            (encuesta_id, p.orden or i, p.texto, p.tipo, p.requerida, p.escala_max),
        )
        pq_id = cur.fetchone()["id"]
        if p.tipo in ("unica", "multiple"):
            for j, op in enumerate(p.opciones, start=1):
                cur.execute(
                    "INSERT INTO encuesta_opciones (pregunta_id, orden, texto) VALUES (%s,%s,%s)",
                    (pq_id, op.orden or j, op.texto),
                )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
def list_encuestas(
    edificio_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            params: list = []
            query = """
                SELECT e.*,
                       (SELECT COUNT(*) FROM encuesta_sesiones s WHERE s.encuesta_id = e.id) AS total_respuestas
                FROM encuestas e
                WHERE 1=1
            """
            if edificio_id:
                query += " AND e.edificio_id = %s"
                params.append(edificio_id)
            query += " ORDER BY e.created_at DESC"
            cur.execute(query, params)
            rows = cur.fetchall()
            result = []
            for r in rows:
                row = dict(r)
                row["total_respuestas"] = int(row.get("total_respuestas") or 0)
                result.append(row)
            return result


@router.get("/{encuesta_id}")
def get_encuesta(encuesta_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM encuestas WHERE id = %s", (encuesta_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Encuesta no encontrada")
            encuesta = dict(row)
            encuesta["preguntas"] = _fetch_preguntas(cur, encuesta_id)
            cur.execute(
                "SELECT COUNT(*) FROM encuesta_sesiones WHERE encuesta_id = %s",
                (encuesta_id,),
            )
            encuesta["total_respuestas"] = int(cur.fetchone()["count"])
            return encuesta


@router.post("", status_code=201)
def create_encuesta(data: EncuestaCreate, _: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO encuestas
                   (edificio_id, titulo, descripcion, anonima, unidades_destino,
                    fecha_inicio, fecha_cierre, autor_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (
                    data.edificio_id, data.titulo, data.descripcion, data.anonima,
                    data.unidades_destino, data.fecha_inicio, data.fecha_cierre, None,
                ),
            )
            encuesta = dict(cur.fetchone())
            _insert_preguntas(cur, encuesta["id"], data.preguntas)
            encuesta["preguntas"] = _fetch_preguntas(cur, encuesta["id"])
            encuesta["total_respuestas"] = 0
            return encuesta


@router.put("/{encuesta_id}")
def update_encuesta(encuesta_id: int, data: EncuestaUpdate, _: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT estado FROM encuestas WHERE id = %s", (encuesta_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Encuesta no encontrada")
            if row["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se pueden editar encuestas en borrador")

            fields, values = [], []
            if data.titulo is not None:
                fields.append("titulo = %s"); values.append(data.titulo)
            if data.descripcion is not None:
                fields.append("descripcion = %s"); values.append(data.descripcion)
            if data.anonima is not None:
                fields.append("anonima = %s"); values.append(data.anonima)
            if data.unidades_destino is not None:
                fields.append("unidades_destino = %s"); values.append(data.unidades_destino)
            if data.fecha_inicio is not None:
                fields.append("fecha_inicio = %s"); values.append(data.fecha_inicio)
            if data.fecha_cierre is not None:
                fields.append("fecha_cierre = %s"); values.append(data.fecha_cierre)

            if fields:
                values.append(encuesta_id)
                cur.execute(
                    f"UPDATE encuestas SET {', '.join(fields)} WHERE id = %s RETURNING *",
                    values,
                )
                encuesta = dict(cur.fetchone())
            else:
                cur.execute("SELECT * FROM encuestas WHERE id = %s", (encuesta_id,))
                encuesta = dict(cur.fetchone())

            if data.preguntas is not None:
                cur.execute(
                    "DELETE FROM encuesta_preguntas WHERE encuesta_id = %s",
                    (encuesta_id,),
                )
                _insert_preguntas(cur, encuesta_id, data.preguntas)

            encuesta["preguntas"] = _fetch_preguntas(cur, encuesta_id)
            cur.execute(
                "SELECT COUNT(*) FROM encuesta_sesiones WHERE encuesta_id = %s",
                (encuesta_id,),
            )
            encuesta["total_respuestas"] = int(cur.fetchone()["count"])
            return encuesta


@router.delete("/{encuesta_id}", status_code=204)
def delete_encuesta(encuesta_id: int, _: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM encuestas WHERE id = %s", (encuesta_id,))


@router.patch("/{encuesta_id}/estado")
def cambiar_estado(encuesta_id: int, data: EstadoUpdate, _: dict = Depends(_require_admin)):
    if data.estado not in ("borrador", "activa", "cerrada"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE encuestas SET estado = %s WHERE id = %s RETURNING id, estado",
                (data.estado, encuesta_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Encuesta no encontrada")
            return dict(row)


@router.post("/{encuesta_id}/responder", status_code=201)
def responder_encuesta(
    encuesta_id: int,
    data: SubmitEncuesta,
    current_user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT estado, anonima, unidades_destino FROM encuestas WHERE id = %s",
                (encuesta_id,),
            )
            enc = cur.fetchone()
            if not enc:
                raise HTTPException(status_code=404, detail="Encuesta no encontrada")
            if enc["estado"] != "activa":
                raise HTTPException(status_code=400, detail="La encuesta no está activa")

            # Verificar que el usuario no haya respondido ya
            cur.execute(
                "SELECT id FROM encuesta_sesiones WHERE encuesta_id = %s AND usuario_id = %s",
                (encuesta_id, data.usuario_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Ya respondiste esta encuesta")

            # Verificar restricción de unidades si aplica
            if enc["unidades_destino"]:
                try:
                    destino_ids = json.loads(enc["unidades_destino"])
                    if data.unidad_id and destino_ids and data.unidad_id not in destino_ids:
                        raise HTTPException(status_code=403, detail="Tu unidad no está en el destino de esta encuesta")
                except (json.JSONDecodeError, TypeError):
                    pass

            cur.execute(
                """INSERT INTO encuesta_sesiones (encuesta_id, usuario_id, unidad_id)
                   VALUES (%s,%s,%s) RETURNING id""",
                (encuesta_id, data.usuario_id, data.unidad_id),
            )
            sesion_id = cur.fetchone()["id"]

            for r in data.respuestas:
                if r.opcion_ids:
                    for opcion_id in r.opcion_ids:
                        cur.execute(
                            """INSERT INTO encuesta_respuestas
                               (sesion_id, pregunta_id, opcion_id)
                               VALUES (%s,%s,%s)""",
                            (sesion_id, r.pregunta_id, opcion_id),
                        )
                elif r.texto_libre is not None:
                    cur.execute(
                        """INSERT INTO encuesta_respuestas
                           (sesion_id, pregunta_id, texto_libre)
                           VALUES (%s,%s,%s)""",
                        (sesion_id, r.pregunta_id, r.texto_libre),
                    )
                elif r.valor_escala is not None:
                    cur.execute(
                        """INSERT INTO encuesta_respuestas
                           (sesion_id, pregunta_id, valor_escala)
                           VALUES (%s,%s,%s)""",
                        (sesion_id, r.pregunta_id, r.valor_escala),
                    )

            return {"ok": True, "sesion_id": sesion_id}


@router.get("/{encuesta_id}/resultados")
def get_resultados(encuesta_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, titulo, anonima, estado FROM encuestas WHERE id = %s",
                (encuesta_id,),
            )
            enc = cur.fetchone()
            if not enc:
                raise HTTPException(status_code=404, detail="Encuesta no encontrada")

            is_admin = current_user.get("rol") in ("administrador", "superadmin", "backoffice")
            cur.execute(
                "SELECT COUNT(*) FROM encuesta_sesiones WHERE encuesta_id = %s",
                (encuesta_id,),
            )
            total_sesiones = int(cur.fetchone()["count"])

            cur.execute(
                "SELECT * FROM encuesta_preguntas WHERE encuesta_id = %s ORDER BY orden",
                (encuesta_id,),
            )
            preguntas = [dict(r) for r in cur.fetchall()]

            resultados = []
            for p in preguntas:
                pid = p["id"]
                tipo = p["tipo"]
                bloque: dict = {"pregunta_id": pid, "texto": p["texto"], "tipo": tipo}

                if tipo in ("unica", "multiple"):
                    cur.execute(
                        """SELECT o.texto, COUNT(er.id) AS conteo
                           FROM encuesta_opciones o
                           LEFT JOIN encuesta_respuestas er ON er.opcion_id = o.id
                               AND er.pregunta_id = %s
                           WHERE o.pregunta_id = %s
                           GROUP BY o.id, o.texto ORDER BY o.orden""",
                        (pid, pid),
                    )
                    bloque["opciones"] = [
                        {"texto": r["texto"], "count": int(r["conteo"])}
                        for r in cur.fetchall()
                    ]

                elif tipo == "escala":
                    cur.execute(
                        """SELECT AVG(valor_escala) AS promedio,
                                  valor_escala, COUNT(*) AS n
                           FROM encuesta_respuestas
                           WHERE pregunta_id = %s AND valor_escala IS NOT NULL
                           GROUP BY valor_escala ORDER BY valor_escala""",
                        (pid,),
                    )
                    rows = cur.fetchall()
                    promedio = 0.0
                    distribucion = {}
                    for row in rows:
                        v = int(row["valor_escala"])
                        distribucion[str(v)] = int(row["n"])
                    cur.execute(
                        "SELECT AVG(valor_escala) FROM encuesta_respuestas WHERE pregunta_id = %s AND valor_escala IS NOT NULL",
                        (pid,),
                    )
                    avg_row = cur.fetchone()
                    promedio = float(avg_row["avg"] or 0)
                    bloque["promedio"] = round(promedio, 2)
                    bloque["distribucion"] = distribucion
                    bloque["escala_max"] = p["escala_max"]

                elif tipo == "texto":
                    if is_admin or not enc["anonima"]:
                        cur.execute(
                            """SELECT er.texto_libre
                               FROM encuesta_respuestas er
                               WHERE er.pregunta_id = %s AND er.texto_libre IS NOT NULL""",
                            (pid,),
                        )
                        bloque["respuestas"] = [r["texto_libre"] for r in cur.fetchall()]
                    else:
                        bloque["respuestas"] = []

                resultados.append(bloque)

            return {
                "encuesta_id": encuesta_id,
                "titulo": enc["titulo"],
                "estado": enc["estado"],
                "total_sesiones": total_sesiones,
                "preguntas": resultados,
            }
