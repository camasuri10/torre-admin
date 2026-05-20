"""Gestión de contratos — tareas/timeline, comentarios, pagos y generación de PDF."""
import io
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from db import get_db
from routers.auth import get_current_user

router = APIRouter()


def _safe(v):
    return float(v) if isinstance(v, Decimal) else v


def _safe_row(row: dict) -> dict:
    return {k: _safe(v) for k, v in row.items()}


def _require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("superadmin", "administrador", "backoffice"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    return current_user


# Hitos predefinidos por tipo de servicio
HITOS_PREDEFINIDOS = {
    "seguridad": [
        "Inicio del servicio de vigilancia",
        "Primera revisión de personal y bitácoras",
        "Auditoría de cumplimiento de protocolos",
        "Evaluación trimestral del servicio",
        "Renovación / cierre del contrato",
    ],
    "aseo": [
        "Inicio del servicio de aseo",
        "Inspección mensual de áreas comunes",
        "Auditoría de calidad y productos",
        "Evaluación trimestral del servicio",
        "Renovación / cierre del contrato",
    ],
    "jardineria": [
        "Inicio del servicio de jardinería",
        "Revisión trimestral de zonas verdes",
        "Auditoría del estado de áreas exteriores",
        "Renovación / cierre del contrato",
    ],
    "mantenimiento": [
        "Levantamiento inicial y diagnóstico",
        "Ejecución de trabajos (fase 1)",
        "Revisión técnica intermedia",
        "Entrega y cierre técnico",
    ],
    "otro": [
        "Inicio del servicio",
        "Seguimiento de avance",
        "Auditoría de cumplimiento",
        "Cierre del contrato",
    ],
}


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TareaCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_programada: Optional[date] = None
    tipo: Optional[str] = "personalizado"


class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_programada: Optional[date] = None
    fecha_completada: Optional[date] = None
    estado: Optional[str] = None
    orden: Optional[int] = None


class ComentarioCreate(BaseModel):
    comentario: str
    tarea_id: Optional[int] = None


class PagoCreate(BaseModel):
    tipo_pago: str
    monto: float
    fecha_pago: date
    descripcion: Optional[str] = None
    url_comprobante: Optional[str] = None


# ─── Tareas / Timeline ────────────────────────────────────────────────────────

@router.get("/{contrato_id}/tareas")
def list_tareas(contrato_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM contrato_tareas WHERE contrato_id = %s ORDER BY orden, id",
                (contrato_id,)
            )
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/{contrato_id}/tareas")
def create_tarea(contrato_id: int, body: TareaCreate, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM contratos_servicio WHERE id = %s AND activo = TRUE", (contrato_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Contrato no encontrado")
            cur.execute(
                """INSERT INTO contrato_tareas
                   (contrato_id, titulo, descripcion, fecha_programada, tipo, orden)
                   VALUES (%s, %s, %s, %s, %s,
                       (SELECT COALESCE(MAX(orden),0)+1 FROM contrato_tareas WHERE contrato_id=%s))
                   RETURNING *""",
                (contrato_id, body.titulo, body.descripcion, body.fecha_programada,
                 body.tipo or "personalizado", contrato_id)
            )
            return _safe_row(dict(cur.fetchone()))


@router.post("/{contrato_id}/tareas/predefinidos")
def seed_tareas_predefinidas(contrato_id: int, current_user: dict = Depends(_require_admin)):
    """Auto-crea hitos predefinidos según el tipo_servicio del contrato."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tipo_servicio FROM contratos_servicio WHERE id = %s AND activo = TRUE",
                (contrato_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Contrato no encontrado")

            tipo = row["tipo_servicio"]
            titulos = HITOS_PREDEFINIDOS.get(tipo, HITOS_PREDEFINIDOS["otro"])

            # Eliminar los predefinidos existentes antes de re-sembrar
            cur.execute(
                "DELETE FROM contrato_tareas WHERE contrato_id = %s AND tipo = 'predefinido'",
                (contrato_id,)
            )
            created = []
            for i, titulo in enumerate(titulos):
                cur.execute(
                    """INSERT INTO contrato_tareas (contrato_id, titulo, tipo, orden)
                       VALUES (%s, %s, 'predefinido', %s) RETURNING *""",
                    (contrato_id, titulo, i)
                )
                created.append(_safe_row(dict(cur.fetchone())))
            return {"created": len(created), "tareas": created}


@router.put("/tareas/{tarea_id}")
def update_tarea(tarea_id: int, body: TareaUpdate, current_user: dict = Depends(_require_admin)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    if "estado" in fields and fields["estado"] not in ("pendiente", "en_progreso", "completada", "vencida"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [tarea_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE contrato_tareas SET {set_clause} WHERE id = %s RETURNING *",
                values
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Tarea no encontrada")
            return _safe_row(dict(row))


@router.delete("/tareas/{tarea_id}")
def delete_tarea(tarea_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM contrato_tareas WHERE id = %s RETURNING id", (tarea_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Tarea no encontrada")
            return {"ok": True}


# ─── Comentarios ──────────────────────────────────────────────────────────────

@router.get("/{contrato_id}/comentarios")
def list_comentarios(contrato_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.*, u.nombre AS autor_nombre,
                       t.titulo AS tarea_titulo
                FROM contrato_comentarios c
                LEFT JOIN usuarios u ON u.id = c.autor_id
                LEFT JOIN contrato_tareas t ON t.id = c.tarea_id
                WHERE c.contrato_id = %s
                ORDER BY c.created_at ASC
            """, (contrato_id,))
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/{contrato_id}/comentarios")
def create_comentario(
    contrato_id: int, body: ComentarioCreate, current_user: dict = Depends(_require_admin)
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO contrato_comentarios (contrato_id, tarea_id, comentario, autor_id)
                   VALUES (%s, %s, %s, %s) RETURNING *""",
                (contrato_id, body.tarea_id, body.comentario, current_user["id"])
            )
            row = dict(cur.fetchone())
            cur.execute("SELECT nombre FROM usuarios WHERE id = %s", (current_user["id"],))
            u = cur.fetchone()
            row["autor_nombre"] = u["nombre"] if u else None
            row["tarea_titulo"] = None
            if body.tarea_id:
                cur.execute("SELECT titulo FROM contrato_tareas WHERE id = %s", (body.tarea_id,))
                t = cur.fetchone()
                row["tarea_titulo"] = t["titulo"] if t else None
            return _safe_row(row)


@router.delete("/comentarios/{cmt_id}")
def delete_comentario(cmt_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM contrato_comentarios WHERE id = %s RETURNING id", (cmt_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Comentario no encontrado")
            return {"ok": True}


# ─── Pagos ────────────────────────────────────────────────────────────────────

@router.get("/{contrato_id}/pagos")
def list_pagos(contrato_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM contrato_pagos WHERE contrato_id = %s ORDER BY fecha_pago DESC",
                (contrato_id,)
            )
            return [_safe_row(dict(r)) for r in cur.fetchall()]


@router.post("/{contrato_id}/pagos")
def create_pago(contrato_id: int, body: PagoCreate, current_user: dict = Depends(_require_admin)):
    if body.tipo_pago not in ("anticipo", "finiquito", "parcial"):
        raise HTTPException(status_code=400, detail="tipo_pago inválido")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM contratos_servicio WHERE id = %s AND activo = TRUE", (contrato_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Contrato no encontrado")
            cur.execute(
                """INSERT INTO contrato_pagos
                   (contrato_id, tipo_pago, monto, fecha_pago, descripcion, url_comprobante)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
                (contrato_id, body.tipo_pago, body.monto, body.fecha_pago,
                 body.descripcion, body.url_comprobante)
            )
            return _safe_row(dict(cur.fetchone()))


@router.delete("/pagos/{pago_id}")
def delete_pago(pago_id: int, current_user: dict = Depends(_require_admin)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM contrato_pagos WHERE id = %s RETURNING id", (pago_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Pago no encontrado")
            return {"ok": True}


# ─── Generación de PDF ────────────────────────────────────────────────────────

@router.get("/{contrato_id}/pdf")
def generar_pdf_contrato(contrato_id: int, current_user: dict = Depends(_require_admin)):
    """Genera y descarga un contrato de servicios en PDF usando reportlab."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Datos del contrato + proveedor + edificio
            cur.execute("""
                SELECT cs.*,
                       p.nombre AS proveedor_nombre,
                       p.nit    AS proveedor_nit,
                       p.contacto AS proveedor_contacto,
                       p.telefono AS proveedor_telefono,
                       p.email AS proveedor_email,
                       e.nombre AS edificio_nombre,
                       e.direccion AS edificio_direccion
                FROM contratos_servicio cs
                JOIN proveedores p ON p.id = cs.proveedor_id
                LEFT JOIN edificios e ON e.id = cs.edificio_id
                WHERE cs.id = %s AND cs.activo = TRUE
            """, (contrato_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Contrato no encontrado")
            c = dict(row)

    pdf_bytes = _build_pdf(c)
    nombre_archivo = f"contrato_{contrato_id}_{c['tipo_servicio']}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


def _build_pdf(c: dict) -> bytes:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        rightMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"], fontSize=16, alignment=TA_CENTER,
        spaceAfter=6, textColor=colors.HexColor("#1a5276")
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER,
        spaceAfter=4, textColor=colors.HexColor("#2e86c1")
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"], fontSize=11,
        textColor=colors.HexColor("#1a5276"), spaceBefore=12, spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=10, leading=14,
        alignment=TA_JUSTIFY, spaceAfter=6,
    )
    label_style = ParagraphStyle(
        "Label", parent=styles["Normal"], fontSize=9,
        textColor=colors.HexColor("#555555"), spaceAfter=2,
    )

    def sec(title): return Paragraph(title, section_style)
    def txt(text): return Paragraph(text, body_style)
    def lbl(text): return Paragraph(text, label_style)
    def sp(h=0.3): return Spacer(1, h * cm)
    def hr(): return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aaaaaa"))

    # Helpers for formatting
    entidad = c.get("edificio_nombre") or "Propiedad Horizontal"
    direccion = c.get("edificio_direccion") or ""
    proveedor = c.get("proveedor_nombre") or ""
    nit = c.get("proveedor_nit") or "N/A"
    contacto = c.get("proveedor_contacto") or "N/A"
    telefono = c.get("proveedor_telefono") or "N/A"
    email = c.get("proveedor_email") or "N/A"
    tipo_servicio = (c.get("tipo_servicio") or "").replace("_", " ").title()
    descripcion = c.get("descripcion") or "Servicio contratado según términos acordados."
    condiciones = c.get("condiciones") or "Según lo acordado entre las partes."
    fecha_inicio = str(c.get("fecha_inicio") or "Por definir")
    fecha_fin = str(c.get("fecha_fin") or "Por definir")
    fecha_auditoria = str(c.get("fecha_auditoria") or "Por definir")
    valor = c.get("valor")
    moneda = c.get("moneda") or "COP"
    valor_str = f"{moneda} {float(valor):,.2f}" if valor else "Según cotización aprobada"
    anticipo_str = f"{moneda} {float(valor) * 0.5:,.2f}" if valor else "50% del valor total"
    finiquito_str = f"{moneda} {float(valor) * 0.5:,.2f}" if valor else "50% restante"
    hoy = datetime.now().strftime("%d de %B de %Y")

    story = []

    # ── Encabezado ────────────────────────────────────────────────────────────
    story.append(Paragraph("CONTRATO DE PRESTACIÓN DE SERVICIOS", title_style))
    story.append(Paragraph(f"{entidad} — {tipo_servicio}", subtitle_style))
    story.append(Paragraph(f"Fecha de elaboración: {hoy}", subtitle_style))
    story.append(sp(0.5))
    story.append(hr())
    story.append(sp(0.4))

    # ── Partes ────────────────────────────────────────────────────────────────
    story.append(sec("1. PARTES DEL CONTRATO"))
    parties_data = [
        ["CONTRATANTE", "CONTRATISTA"],
        [
            f"{entidad}\n{direccion}\nRepresentado por el Administrador",
            f"{proveedor}\nNIT: {nit}\nContacto: {contacto}\nTel: {telefono}\nEmail: {email}",
        ],
    ]
    parties_table = Table(parties_data, colWidths=[8 * cm, 8 * cm])
    parties_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a5276")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f4f9ff"), colors.white]),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, 1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
    ]))
    story.append(parties_table)
    story.append(sp())

    # ── Objeto ────────────────────────────────────────────────────────────────
    story.append(sec("2. OBJETO DEL CONTRATO"))
    story.append(txt(f"El CONTRATISTA se compromete a prestar a el CONTRATANTE el servicio de "
                     f"<b>{tipo_servicio}</b> bajo las siguientes condiciones y especificaciones:"))
    story.append(sp(0.2))
    story.append(txt(descripcion))

    # ── Vigencia ──────────────────────────────────────────────────────────────
    story.append(sec("3. VIGENCIA DEL CONTRATO"))
    vigencia_data = [
        ["Fecha de Inicio", "Fecha de Fin", "Fecha de Auditoría"],
        [fecha_inicio, fecha_fin, fecha_auditoria],
    ]
    vig_table = Table(vigencia_data, colWidths=[5.3 * cm, 5.3 * cm, 5.3 * cm])
    vig_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e86c1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f7ff")]),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(vig_table)
    story.append(sp())

    # ── Valor y Forma de Pago ─────────────────────────────────────────────────
    story.append(sec("4. VALOR Y FORMA DE PAGO"))
    story.append(txt(f"El valor total del presente contrato es de <b>{valor_str}</b>, "
                     f"pagadero de la siguiente manera:"))
    story.append(sp(0.2))
    pago_data = [
        ["Concepto", "Monto", "Momento de Pago"],
        ["Anticipo (50%)", anticipo_str, "Al inicio del contrato / firma del acta de inicio"],
        ["Finiquito (50%)", finiquito_str, "Al finalizar y recibir a satisfacción el servicio"],
    ]
    pago_table = Table(pago_data, colWidths=[4 * cm, 5 * cm, 7 * cm])
    pago_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a5276")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f4f9ff"), colors.HexColor("#e8f4fd")]),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(pago_table)
    story.append(sp())

    # ── Garantías ─────────────────────────────────────────────────────────────
    story.append(sec("5. GARANTÍAS DEL SERVICIO"))
    story.append(txt(
        "El CONTRATISTA garantiza que el servicio prestado cumplirá con los estándares de calidad "
        "acordados. En caso de incumplimiento, el CONTRATISTA deberá corregir las deficiencias sin "
        "costo adicional dentro de los plazos establecidos. Las garantías incluyen: calidad del "
        "trabajo entregado, cumplimiento de normativas vigentes y disponibilidad del personal "
        "requerido según el alcance del servicio."
    ))

    # ── Condiciones ───────────────────────────────────────────────────────────
    story.append(sec("6. CONDICIONES Y OBLIGACIONES"))
    story.append(txt(condiciones))
    story.append(sp(0.2))
    story.append(txt(
        "El CONTRATISTA deberá mantener al día los pagos de seguridad social (salud, pensión y ARL) "
        "de todos los empleados asignados al servicio, y presentar los comprobantes cuando el "
        "CONTRATANTE los requiera. El incumplimiento de esta obligación faculta al CONTRATANTE para "
        "suspender los pagos hasta regularizar la situación."
    ))

    # ── Cláusula de Cumplimiento ──────────────────────────────────────────────
    story.append(sec("7. CLÁUSULA DE CUMPLIMIENTO"))
    story.append(txt(
        "El incumplimiento de las obligaciones pactadas en este contrato por parte del CONTRATISTA, "
        "sin mediar causa justificada, facultará al CONTRATANTE para dar por terminado el contrato "
        "de manera unilateral, sin lugar a indemnización por parte del CONTRATANTE, y a exigir al "
        "CONTRATISTA los perjuicios que dicho incumplimiento haya causado."
    ))

    # ── Firmas ────────────────────────────────────────────────────────────────
    story.append(sp(0.8))
    story.append(hr())
    story.append(sp(0.5))
    story.append(sec("8. FIRMAS DE LAS PARTES"))
    story.append(sp(0.3))

    firma_data = [
        ["CONTRATANTE", "", "CONTRATISTA", ""],
        [" ", " ", " ", " "],
        [" ", " ", " ", " "],
        [" ", " ", " ", " "],
        ["_________________________", "", "_________________________", ""],
        [entidad, "", proveedor, ""],
        ["Administrador", "", f"NIT: {nit}", ""],
        [f"Ciudad y fecha: ________________", "", f"Ciudad y fecha: ________________", ""],
    ]
    firma_table = Table(firma_data, colWidths=[7 * cm, 1 * cm, 7 * cm, 1 * cm])
    firma_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("LINEBELOW", (0, 4), (0, 4), 0.5, colors.black),
        ("LINEBELOW", (2, 4), (2, 4), 0.5, colors.black),
        ("TEXTCOLOR", (0, 5), (0, -1), colors.HexColor("#444444")),
        ("TEXTCOLOR", (2, 5), (2, -1), colors.HexColor("#444444")),
    ]))
    story.append(firma_table)

    doc.build(story)
    return buf.getvalue()
