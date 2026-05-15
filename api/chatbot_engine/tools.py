"""
Tool definitions and role-based filtering for the chatbot engine.
Each tool maps to one or more internal API calls executed server-side.
"""
import httpx

# Role hierarchy for permission checks
_ROLE_LEVEL = {
    "propietario": 1,
    "inquilino": 1,
    "portero": 2,
    "servicios": 2,
    "administrador": 3,
    "backoffice": 3,
    "superadmin": 4,
}

# ── Tool catalog ──────────────────────────────────────────────────────────────
# Each entry: name, description, parameters (JSON Schema), min_rol, handler fn.
# Handler receives (params: dict, context: dict) where context has:
#   token, edificio_id, usuario_id, rol, api_base

TOOLS: list[dict] = [
    # ── Available to all authenticated roles ──────────────────────────────────
    {
        "name": "get_dashboard_stats",
        "description": "Obtiene estadísticas generales del edificio: unidades, ocupación, cuotas, mantenimientos activos y recaudo.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "min_rol": "propietario",
    },
    {
        "name": "get_comunicados",
        "description": "Lista los comunicados/anuncios del edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "tipo": {
                    "type": "string",
                    "description": "Filtrar por tipo: general, urgente, reunion, etc. Omitir para todos.",
                },
            },
            "required": [],
        },
        "min_rol": "propietario",
    },
    {
        "name": "get_zonas_comunes",
        "description": "Lista las zonas comunes disponibles en el edificio (salón comunal, piscina, gimnasio, etc.).",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "min_rol": "propietario",
    },
    {
        "name": "get_disponibilidad_zona",
        "description": "Consulta los horarios disponibles de una zona común para una fecha específica.",
        "parameters": {
            "type": "object",
            "properties": {
                "zona_id": {"type": "integer", "description": "ID de la zona común"},
                "fecha": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
            },
            "required": ["zona_id", "fecha"],
        },
        "min_rol": "propietario",
    },
    # ── Propietario+ ──────────────────────────────────────────────────────────
    {
        "name": "get_cuotas",
        "description": "Consulta el estado de cuotas/administración del usuario autenticado o del edificio completo si es admin.",
        "parameters": {
            "type": "object",
            "properties": {
                "estado": {
                    "type": "string",
                    "description": "Filtrar por estado: pendiente, pagada, vencida. Omitir para todos.",
                },
            },
            "required": [],
        },
        "min_rol": "propietario",
    },
    {
        "name": "crear_reserva",
        "description": "Crea una reserva de zona común para el usuario autenticado.",
        "parameters": {
            "type": "object",
            "properties": {
                "zona_id": {"type": "integer", "description": "ID de la zona común a reservar"},
                "fecha": {"type": "string", "description": "Fecha de la reserva en formato YYYY-MM-DD"},
                "hora_inicio": {"type": "string", "description": "Hora de inicio en formato HH:MM"},
                "hora_fin": {"type": "string", "description": "Hora de fin en formato HH:MM"},
                "notas": {"type": "string", "description": "Observaciones o comentarios opcionales"},
            },
            "required": ["zona_id", "fecha", "hora_inicio", "hora_fin"],
        },
        "min_rol": "propietario",
    },
    {
        "name": "get_mantenimientos",
        "description": "Lista las solicitudes de mantenimiento del edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "estado": {
                    "type": "string",
                    "description": "Filtrar por estado: pendiente, en_proceso, resuelto. Omitir para todos.",
                },
            },
            "required": [],
        },
        "min_rol": "propietario",
    },
    {
        "name": "crear_mantenimiento",
        "description": "Crea una solicitud de mantenimiento o reporte de problema.",
        "parameters": {
            "type": "object",
            "properties": {
                "titulo": {"type": "string", "description": "Título breve del problema"},
                "descripcion": {"type": "string", "description": "Descripción detallada del problema"},
                "categoria": {
                    "type": "string",
                    "description": "Categoría: electrico, plomeria, estructura, ascensor, areas_comunes, otro",
                },
                "prioridad": {
                    "type": "string",
                    "enum": ["baja", "media", "alta", "urgente"],
                    "description": "Prioridad de atención",
                },
            },
            "required": ["titulo", "descripcion", "categoria"],
        },
        "min_rol": "propietario",
    },
    # ── Administrador+ ────────────────────────────────────────────────────────
    {
        "name": "get_usuarios",
        "description": "Lista los usuarios/residentes del edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "rol": {
                    "type": "string",
                    "description": "Filtrar por rol: propietario, inquilino, portero. Omitir para todos.",
                },
            },
            "required": [],
        },
        "min_rol": "administrador",
    },
    {
        "name": "crear_usuario",
        "description": "Crea un nuevo usuario (propietario, inquilino u otro rol) en el edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre completo"},
                "email": {"type": "string", "description": "Correo electrónico"},
                "telefono": {"type": "string", "description": "Número de teléfono (opcional)"},
                "cedula": {"type": "string", "description": "Número de cédula/documento (opcional)"},
                "rol": {
                    "type": "string",
                    "enum": ["propietario", "inquilino", "portero", "servicios"],
                    "description": "Rol del nuevo usuario",
                },
                "password": {"type": "string", "description": "Contraseña inicial (opcional, se genera aleatoria si no se especifica)"},
            },
            "required": ["nombre", "email", "rol"],
        },
        "min_rol": "administrador",
    },
    {
        "name": "get_morosos",
        "description": "Lista los propietarios/unidades con cuotas vencidas (morosos).",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "min_rol": "administrador",
    },
    {
        "name": "registrar_pago",
        "description": "Registra el pago de una cuota de administración.",
        "parameters": {
            "type": "object",
            "properties": {
                "cuota_id": {"type": "integer", "description": "ID de la cuota a pagar"},
                "metodo_pago": {
                    "type": "string",
                    "enum": ["efectivo", "transferencia", "tarjeta", "cheque"],
                    "description": "Método de pago utilizado",
                },
                "fecha_pago": {"type": "string", "description": "Fecha de pago en formato YYYY-MM-DD (por defecto hoy)"},
            },
            "required": ["cuota_id", "metodo_pago"],
        },
        "min_rol": "administrador",
    },
    {
        "name": "crear_comunicado",
        "description": "Crea y publica un comunicado para los residentes del edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "titulo": {"type": "string", "description": "Título del comunicado"},
                "contenido": {"type": "string", "description": "Contenido del comunicado"},
                "tipo": {
                    "type": "string",
                    "enum": ["general", "urgente", "reunion", "mantenimiento", "financiero"],
                    "description": "Tipo de comunicado",
                },
            },
            "required": ["titulo", "contenido", "tipo"],
        },
        "min_rol": "administrador",
    },
    {
        "name": "registrar_paquete",
        "description": "Registra un paquete/encomienda recibida para un residente.",
        "parameters": {
            "type": "object",
            "properties": {
                "unidad_id": {"type": "integer", "description": "ID de la unidad destinataria"},
                "remitente": {"type": "string", "description": "Nombre del remitente o empresa de mensajería"},
                "descripcion": {"type": "string", "description": "Descripción del paquete"},
                "empresa_mensajeria": {"type": "string", "description": "Empresa de mensajería (opcional)"},
            },
            "required": ["unidad_id", "remitente", "descripcion"],
        },
        "min_rol": "administrador",
    },
    {
        "name": "registrar_acceso",
        "description": "Registra el ingreso de un visitante al edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "visitante_nombre": {"type": "string", "description": "Nombre del visitante"},
                "visitante_documento": {"type": "string", "description": "Documento de identidad del visitante"},
                "destino_unidad_id": {"type": "integer", "description": "ID de la unidad que visita"},
                "motivo": {"type": "string", "description": "Motivo de la visita"},
                "autorizado": {"type": "boolean", "description": "Si el ingreso fue autorizado"},
            },
            "required": ["visitante_nombre", "destino_unidad_id"],
        },
        "min_rol": "administrador",
    },
    {
        "name": "get_paquetes",
        "description": "Lista los paquetes/encomiendas pendientes de entrega en el edificio.",
        "parameters": {
            "type": "object",
            "properties": {
                "estado": {
                    "type": "string",
                    "enum": ["pendiente", "entregado", "notificado"],
                    "description": "Estado del paquete. Omitir para ver todos.",
                },
            },
            "required": [],
        },
        "min_rol": "administrador",
    },
    # ── Superadmin ────────────────────────────────────────────────────────────
    {
        "name": "get_stats_globales",
        "description": "Obtiene KPIs globales de toda la plataforma: edificios, usuarios, cuotas, ocupación.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "min_rol": "superadmin",
    },
    {
        "name": "get_edificios",
        "description": "Lista todos los edificios registrados en la plataforma.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "min_rol": "superadmin",
    },
    {
        "name": "gestionar_modulos",
        "description": "Activa o desactiva módulos de un edificio específico.",
        "parameters": {
            "type": "object",
            "properties": {
                "edificio_id": {"type": "integer", "description": "ID del edificio"},
                "modulos": {
                    "type": "array",
                    "description": "Lista de módulos a cambiar",
                    "items": {
                        "type": "object",
                        "properties": {
                            "clave": {"type": "string"},
                            "activo": {"type": "boolean"},
                        },
                        "required": ["clave", "activo"],
                    },
                },
            },
            "required": ["edificio_id", "modulos"],
        },
        "min_rol": "superadmin",
    },
]


def get_tools_for_role(rol: str) -> list[dict]:
    """Return only tools the given role is allowed to use."""
    user_level = _ROLE_LEVEL.get(rol, 0)
    allowed = []
    for tool in TOOLS:
        min_level = _ROLE_LEVEL.get(tool["min_rol"], 99)
        if user_level >= min_level:
            # Return only name, description, parameters (not internal min_rol)
            allowed.append({
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            })
    return allowed


# ── Tool executor ─────────────────────────────────────────────────────────────

async def execute_tool(tool_name: str, params: dict, context: dict) -> dict:
    """
    Execute a tool by making an authenticated internal HTTP call to the API.
    context: {token, edificio_id, usuario_id, rol, api_base}
    """
    from datetime import date

    token = context["token"]
    edificio_id = context.get("edificio_id")
    usuario_id = context.get("usuario_id")
    api_base = context.get("api_base", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(base_url=api_base, timeout=30) as client:
        try:
            return await _dispatch(tool_name, params, context, client, headers)
        except httpx.HTTPStatusError as e:
            return {"error": f"API error {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"error": str(e)}


async def _dispatch(name: str, p: dict, ctx: dict, client: httpx.AsyncClient, headers: dict) -> dict:
    eid = ctx.get("edificio_id")
    uid = ctx.get("usuario_id")
    rol = ctx.get("rol")
    today = str(__import__("datetime").date.today())

    if name == "get_dashboard_stats":
        r = await client.get(f"/api/reportes/dashboard/{eid}", headers=headers)
        r.raise_for_status()
        return r.json()

    elif name == "get_comunicados":
        params = f"?edificio_id={eid}"
        if p.get("tipo"):
            params += f"&tipo={p['tipo']}"
        r = await client.get(f"/api/comunicados{params}", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"comunicados": data[:10], "total": len(data)}

    elif name == "get_zonas_comunes":
        r = await client.get(f"/api/zonas-comunes?edificio_id={eid}", headers=headers)
        r.raise_for_status()
        return {"zonas": r.json()}

    elif name == "get_disponibilidad_zona":
        zona_id = p["zona_id"]
        fecha = p["fecha"]
        r = await client.get(f"/api/zonas-comunes/{zona_id}/disponibilidad?fecha={fecha}", headers=headers)
        r.raise_for_status()
        return r.json()

    elif name == "get_cuotas":
        if rol == "propietario":
            params = f"?usuario_id={uid}"
        else:
            params = f"?edificio_id={eid}"
        if p.get("estado"):
            params += f"&estado={p['estado']}"
        r = await client.get(f"/api/cuotas{params}", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"cuotas": data[:20], "total": len(data)}

    elif name == "crear_reserva":
        payload = {
            "zona_id": p["zona_id"],
            "usuario_id": uid,
            "registrado_por_id": uid,
            "fecha": p["fecha"],
            "hora_inicio": p["hora_inicio"],
            "hora_fin": p["hora_fin"],
            "notas": p.get("notas", ""),
        }
        r = await client.post("/api/zonas-comunes/reservas", json=payload, headers=headers)
        r.raise_for_status()
        return {"reserva": r.json(), "mensaje": "Reserva creada exitosamente."}

    elif name == "get_mantenimientos":
        params = f"?edificio_id={eid}"
        if p.get("estado"):
            params += f"&estado={p['estado']}"
        r = await client.get(f"/api/mantenimientos{params}", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"mantenimientos": data[:15], "total": len(data)}

    elif name == "crear_mantenimiento":
        payload = {
            "edificio_id": eid,
            "titulo": p["titulo"],
            "descripcion": p["descripcion"],
            "categoria": p.get("categoria", "otro"),
            "prioridad": p.get("prioridad", "media"),
            "solicitante_id": uid,
            "es_programado": False,
        }
        r = await client.post("/api/mantenimientos", json=payload, headers=headers)
        r.raise_for_status()
        return {"mantenimiento": r.json(), "mensaje": "Solicitud de mantenimiento creada."}

    elif name == "get_usuarios":
        params = f"?edificio_id={eid}"
        if p.get("rol"):
            params += f"&rol={p['rol']}"
        r = await client.get(f"/api/usuarios{params}", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"usuarios": data[:20], "total": len(data)}

    elif name == "crear_usuario":
        payload = {
            "nombre": p["nombre"],
            "email": p["email"],
            "rol": p["rol"],
            "telefono": p.get("telefono"),
            "cedula": p.get("cedula"),
            "password": p.get("password"),
            "edificio_id": eid,
        }
        r = await client.post("/api/usuarios", json=payload, headers=headers)
        r.raise_for_status()
        return {"usuario": r.json(), "mensaje": f"Usuario {p['nombre']} creado exitosamente."}

    elif name == "get_morosos":
        r = await client.get(f"/api/cuotas?edificio_id={eid}&estado=vencida", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"morosos": data, "total": len(data)}

    elif name == "registrar_pago":
        payload = {
            "metodo_pago": p["metodo_pago"],
            "fecha_pago": p.get("fecha_pago", today),
        }
        r = await client.patch(f"/api/cuotas/{p['cuota_id']}/pagar", json=payload, headers=headers)
        r.raise_for_status()
        return {"cuota": r.json(), "mensaje": "Pago registrado exitosamente."}

    elif name == "crear_comunicado":
        payload = {
            "edificio_id": eid,
            "titulo": p["titulo"],
            "contenido": p["contenido"],
            "tipo": p.get("tipo", "general"),
            "autor_id": uid,
            "canales": ["sistema"],
        }
        r = await client.post("/api/comunicados", json=payload, headers=headers)
        r.raise_for_status()
        return {"comunicado": r.json(), "mensaje": "Comunicado publicado exitosamente."}

    elif name == "registrar_paquete":
        payload = {
            "edificio_id": eid,
            "unidad_id": p["unidad_id"],
            "remitente": p["remitente"],
            "descripcion": p["descripcion"],
            "empresa_mensajeria": p.get("empresa_mensajeria", ""),
            "recibido_por": uid,
        }
        r = await client.post("/api/paquetes", json=payload, headers=headers)
        r.raise_for_status()
        return {"paquete": r.json(), "mensaje": "Paquete registrado."}

    elif name == "registrar_acceso":
        payload = {
            "edificio_id": eid,
            "visitante_nombre": p["visitante_nombre"],
            "visitante_documento": p.get("visitante_documento", ""),
            "destino_unidad_id": p["destino_unidad_id"],
            "motivo": p.get("motivo", "Visita"),
            "autorizado": p.get("autorizado", True),
            "registrado_por": uid,
        }
        r = await client.post("/api/accesos", json=payload, headers=headers)
        r.raise_for_status()
        return {"acceso": r.json(), "mensaje": "Acceso registrado."}

    elif name == "get_paquetes":
        params = f"?edificio_id={eid}"
        if p.get("estado"):
            params += f"&estado={p['estado']}"
        r = await client.get(f"/api/paquetes{params}", headers=headers)
        r.raise_for_status()
        data = r.json()
        return {"paquetes": data[:20], "total": len(data)}

    elif name == "get_stats_globales":
        r = await client.get("/api/superadmin/stats", headers=headers)
        r.raise_for_status()
        return r.json()

    elif name == "get_edificios":
        r = await client.get("/api/superadmin/edificios", headers=headers)
        r.raise_for_status()
        return {"edificios": r.json()}

    elif name == "gestionar_modulos":
        target_eid = p["edificio_id"]
        payload = {"modulos": p["modulos"]}
        r = await client.put(f"/api/superadmin/edificios/{target_eid}/modulos", json=payload, headers=headers)
        r.raise_for_status()
        return {"mensaje": "Módulos actualizados correctamente.", "resultado": r.json()}

    return {"error": f"Tool '{name}' not implemented"}
