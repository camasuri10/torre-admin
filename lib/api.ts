/**
 * TorreAdmin API client.
 * All fetch calls go through here so the base URL is configured in one place.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("torre_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function formRequest<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...authHeaders() },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  seleccionarEdificio: (user_id: number, edificio_id: number) =>
    request<any>("/api/auth/seleccionar-edificio", {
      method: "POST",
      body: JSON.stringify({ user_id, edificio_id }),
    }),
  seleccionarOrganizacion: (user_id: number, organizacion_id: number) =>
    request<any>("/api/auth/seleccionar-organizacion", {
      method: "POST",
      body: JSON.stringify({ user_id, organizacion_id }),
    }),
  seleccionarTodos: () =>
    request<any>("/api/auth/seleccionar-todos", { method: "POST", body: JSON.stringify({}) }),
  seleccionarConjunto: (user_id: number, conjunto_id: number | null) =>
    request<any>("/api/auth/seleccionar-conjunto", {
      method: "POST",
      body: JSON.stringify({ user_id, conjunto_id }),
    }),
  misEdificios: () => request<{ edificios: { id: number; nombre: string }[] }>("/api/auth/mis-edificios"),
  misOrganizaciones: () => request<{ organizaciones: { id: number; nombre: string }[] }>("/api/auth/mis-organizaciones"),
  me: () => request<any>("/api/auth/me"),
};

// ── Super Admin ───────────────────────────────────────────────────────────────
export const superadminApi = {
  stats: (conjunto_id?: number) => {
    const q = conjunto_id ? `?conjunto_id=${conjunto_id}` : "";
    return request<any>(`/api/superadmin/stats${q}`);
  },
  cuotasDetalle: (estado: "pendiente" | "vencido", conjunto_id?: number) => {
    const params = new URLSearchParams({ estado });
    if (conjunto_id) params.set("conjunto_id", String(conjunto_id));
    return request<any>(`/api/superadmin/stats/cuotas-detalle?${params}`);
  },
  mantenimientosDetalle: (estado?: string, conjunto_id?: number) => {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (conjunto_id) params.set("conjunto_id", String(conjunto_id));
    return request<any>(`/api/superadmin/stats/mantenimientos-detalle?${params}`);
  },
  analytics: (edificio_id?: number) => {
    const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
    return request<any>(`/api/superadmin/analytics${q}`);
  },
  edificios: {
    list: (conjunto_id?: number) => {
      const q = conjunto_id ? `?conjunto_id=${conjunto_id}` : "";
      return request<any>(`/api/superadmin/edificios${q}`);
    },
    create: (data: any) => request<any>("/api/superadmin/edificios", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/superadmin/edificios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    getModulos: (id: number) => request<any>(`/api/superadmin/edificios/${id}/modulos`),
    updateModulos: (id: number, modulos: { clave: string; activo: boolean }[]) =>
      request<any>(`/api/superadmin/edificios/${id}/modulos`, { method: "PUT", body: JSON.stringify({ modulos }) }),
  },
  admins: {
    list: () => request<any>("/api/superadmin/admins"),
    create: (data: any) => request<any>("/api/superadmin/admins", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/superadmin/admins/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    updateAsignaciones: (id: number, data: { edificio_ids: number[]; conjunto_ids: number[] }) =>
      request<any>(`/api/superadmin/admins/${id}/edificios`, { method: "PUT", body: JSON.stringify(data) }),
  },
  staff: {
    list: () => request<any>("/api/superadmin/staff"),
    create: (data: any) => request<any>("/api/superadmin/admins", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/superadmin/admins/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    updateAsignaciones: (id: number, data: { edificio_ids: number[]; conjunto_ids: number[] }) =>
      request<any>(`/api/superadmin/admins/${id}/edificios`, { method: "PUT", body: JSON.stringify(data) }),
  },
};

// ── Conjuntos ─────────────────────────────────────────────────────────────────
export const conjuntosApi = {
  list: () => request<any>("/api/conjuntos"),
  get: (id: number) => request<any>(`/api/conjuntos/${id}`),
  create: (data: any) => request<any>("/api/conjuntos", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/api/conjuntos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  edificios: (id: number) => request<any>(`/api/conjuntos/${id}/edificios`),
  assignEdificio: (conjunto_id: number, edificio_id: number) =>
    request<any>(`/api/conjuntos/${conjunto_id}/edificios/${edificio_id}`, { method: "POST", body: JSON.stringify({}) }),
  removeEdificio: (conjunto_id: number, edificio_id: number) =>
    request<void>(`/api/conjuntos/${conjunto_id}/edificios/${edificio_id}`, { method: "DELETE" }),
};

// ── Vehículos ─────────────────────────────────────────────────────────────────
export const vehiculosApi = {
  list: (usuario_id?: number) => {
    const q = usuario_id ? `?usuario_id=${usuario_id}` : "";
    return request<any>(`/api/vehiculos${q}`);
  },
  create: (data: any) => request<any>("/api/vehiculos", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/api/vehiculos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/vehiculos/${id}`, { method: "DELETE" }),
};

// ── Mascotas ──────────────────────────────────────────────────────────────────
export const mascotasApi = {
  list: (usuario_id?: number) => {
    const q = usuario_id ? `?usuario_id=${usuario_id}` : "";
    return request<any>(`/api/mascotas${q}`);
  },
  create: (data: any) => request<any>("/api/mascotas", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/api/mascotas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/mascotas/${id}`, { method: "DELETE" }),
};

// ── Proveedores ───────────────────────────────────────────────────────────────
export const proveedoresApi = {
  list: (params?: { edificio_id?: number; conjunto_id?: number }) => {
    const q = params ? new URLSearchParams(params as any).toString() : "";
    return request<any>(`/api/proveedores${q ? "?" + q : ""}`);
  },
  get: (id: number) => request<any>(`/api/proveedores/${id}`),
  create: (data: any) => request<any>("/api/proveedores", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/api/proveedores/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/proveedores/${id}`, { method: "DELETE" }),
  contratos: {
    list: (proveedor_id: number) => request<any>(`/api/proveedores/${proveedor_id}/contratos`),
    create: (proveedor_id: number, data: any) =>
      request<any>(`/api/proveedores/${proveedor_id}/contratos`, { method: "POST", body: JSON.stringify(data) }),
    update: (contrato_id: number, data: any) =>
      request<any>(`/api/proveedores/contratos/${contrato_id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (contrato_id: number) =>
      request<void>(`/api/proveedores/contratos/${contrato_id}`, { method: "DELETE" }),
  },
  empleados: {
    list: (proveedor_id: number) => request<any>(`/api/proveedores/${proveedor_id}/empleados`),
    create: (proveedor_id: number, data: any) =>
      request<any>(`/api/proveedores/${proveedor_id}/empleados`, { method: "POST", body: JSON.stringify(data) }),
    update: (empleado_id: number, data: any) =>
      request<any>(`/api/proveedores/empleados/${empleado_id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (empleado_id: number) =>
      request<void>(`/api/proveedores/empleados/${empleado_id}`, { method: "DELETE" }),
    documentos: {
      list: (empleado_id: number) => request<any>(`/api/proveedores/empleados/${empleado_id}/documentos`),
      create: (empleado_id: number, data: any) =>
        request<any>(`/api/proveedores/empleados/${empleado_id}/documentos`, { method: "POST", body: JSON.stringify(data) }),
      delete: (doc_id: number) =>
        request<void>(`/api/proveedores/empleados/documentos/${doc_id}`, { method: "DELETE" }),
    },
  },
  edificios: {
    list: (proveedor_id: number) => request<any>(`/api/proveedores/${proveedor_id}/edificios`),
    add: (proveedor_id: number, data: { edificio_id?: number; conjunto_id?: number }) =>
      request<any>(`/api/proveedores/${proveedor_id}/edificios`, { method: "POST", body: JSON.stringify(data) }),
    remove: (proveedor_id: number, pe_id: number) =>
      request<void>(`/api/proveedores/${proveedor_id}/edificios/${pe_id}`, { method: "DELETE" }),
  },
};

// ── Edificios ─────────────────────────────────────────────────────────────────
export const api = {
  edificios: {
    list: () => request<any[]>("/api/edificios/"),
    get: (id: number) => request<any>(`/api/edificios/${id}`),
    stats: (id: number) => request<any>(`/api/edificios/${id}/stats`),
    unidades: (id: number, torre_id?: number) => {
      const q = torre_id ? `?torre_id=${torre_id}` : "";
      return request<any[]>(`/api/edificios/${id}/unidades${q}`);
    },
    create: (data: any) => request<any>("/api/edificios/", { method: "POST", body: JSON.stringify(data) }),
    getModulos: (id: number) => request<any>(`/api/superadmin/edificios/${id}/modulos`),
    // Torres
    torres: {
      list: (edificio_id: number) => request<any>(`/api/edificios/${edificio_id}/torres`),
      create: (edificio_id: number, data: { nombre: string; numero?: string; pisos?: number; tipo?: string }) =>
        request<any>(`/api/edificios/${edificio_id}/torres`, { method: "POST", body: JSON.stringify(data) }),
      update: (edificio_id: number, torre_id: number, data: { nombre?: string; numero?: string; pisos?: number; tipo?: string }) =>
        request<any>(`/api/edificios/${edificio_id}/torres/${torre_id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (edificio_id: number, torre_id: number) =>
        request<void>(`/api/edificios/${edificio_id}/torres/${torre_id}`, { method: "DELETE" }),
      unidades: (edificio_id: number, torre_id: number) =>
        request<any[]>(`/api/edificios/${edificio_id}/torres/${torre_id}/unidades`),
    },
    // Unidades
    createUnidad: (id: number, data: { torre_id: number; numero: string; piso?: number; tipo?: string; area_m2?: number; coeficiente?: number }) =>
      request<any>(`/api/edificios/${id}/unidades`, { method: "POST", body: JSON.stringify(data) }),
    updateUnidad: (id: number, uid: number, data: any) =>
      request<any>(`/api/edificios/${id}/unidades/${uid}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteUnidad: (id: number, uid: number) =>
      request<void>(`/api/edificios/${id}/unidades/${uid}`, { method: "DELETE" }),
  },

  // ── Usuarios ───────────────────────────────────────────────────────────────
  usuarios: {
    list: (params?: { rol?: string; edificio_id?: number; tipo_ocupacion?: string; solo_inactivos?: boolean }) => {
      const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ""));
      const q = new URLSearchParams(filtered as any).toString();
      return request<any[]>(`/api/usuarios/${q ? "?" + q : ""}`);
    },
    get: (id: number) => request<any>(`/api/usuarios/${id}`),
    create: (data: any) => request<any>("/api/usuarios/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/usuarios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/usuarios/${id}`, { method: "DELETE" }),
    asignarUnidad: (data: any) => request<any>("/api/usuarios/ocupaciones", { method: "POST", body: JSON.stringify(data) }),
    removeOcupacion: (id: number) => request<void>(`/api/usuarios/ocupaciones/${id}`, { method: "DELETE" }),
  },

  // ── Finanzas ───────────────────────────────────────────────────────────────
  cuotas: {
    list: (params?: { edificio_id?: number; estado?: string; mes?: string; usuario_id?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/cuotas${q ? "?" + q : ""}`);
    },
    create: (data: any) => request<any>("/api/cuotas", { method: "POST", body: JSON.stringify(data) }),
    generarMes: (data: { edificio_id: number; mes: string; monto: number; fecha_vencimiento: string }) =>
      request<any>("/api/cuotas/generar-mes", { method: "POST", body: JSON.stringify(data) }),
    pagar: (id: number, data: any) => request<any>(`/api/cuotas/${id}/pagar`, { method: "PATCH", body: JSON.stringify(data) }),
    marcarVencido: (id: number) => request<any>(`/api/cuotas/${id}/estado?estado=vencido`, { method: "PATCH" }),
    resumen: (edificio_id: number, mes?: string) => {
      const q = mes ? `?mes=${mes}` : "";
      return request<any>(`/api/cuotas/resumen/${edificio_id}${q}`);
    },
  },

  // ── Mantenimiento ──────────────────────────────────────────────────────────
  mantenimientos: {
    list: (params?: { edificio_id?: number; estado?: string; prioridad?: string; es_programado?: boolean }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/mantenimientos/${q ? "?" + q : ""}`);
    },
    get: (id: number) => request<any>(`/api/mantenimientos/${id}`),
    vencimientos: (edificio_id?: number, dias = 30) => {
      const params: any = { dias };
      if (edificio_id) params.edificio_id = edificio_id;
      const q = new URLSearchParams(params).toString();
      return request<any[]>(`/api/mantenimientos/vencimientos?${q}`);
    },
    create: (data: any) => request<any>("/api/mantenimientos/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/mantenimientos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    clonar: (id: number) => request<any>(`/api/mantenimientos/${id}/clonar`, { method: "POST", body: "{}" }),
    uploadArchivo: (id: number, formData: FormData) =>
      fetch(`${BASE}/api/mantenimientos/${id}/archivos`, { method: "POST", body: formData }).then((r) => r.json()),
    alertas: {
      list: (edificio_id?: number) => {
        const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
        return request<any[]>(`/api/mantenimientos/alertas/${q}`);
      },
      create: (data: any) => request<any>("/api/mantenimientos/alertas/", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, estado: string) =>
        request<any>(`/api/mantenimientos/alertas/${id}?estado=${estado}`, { method: "PATCH" }),
    },
    inventario: {
      list: (edificio_id?: number, tipo?: string) => {
        const params: any = {};
        if (edificio_id) params.edificio_id = edificio_id;
        if (tipo) params.tipo = tipo;
        const q = new URLSearchParams(params).toString();
        return request<any[]>(`/api/mantenimientos/inventario${q ? "?" + q : ""}`);
      },
      create: (data: any) => request<any>("/api/mantenimientos/inventario", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => request<any>(`/api/mantenimientos/inventario/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    },
  },

  // ── Comunicados ────────────────────────────────────────────────────────────
  comunicados: {
    list: (params?: { edificio_id?: number; tipo?: string; usuario_id?: number }) => {
      const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null));
      const q = new URLSearchParams(filtered as any).toString();
      return request<any[]>(`/api/comunicados/${q ? "?" + q : ""}`);
    },
    create: (data: any) => request<any>("/api/comunicados/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/comunicados/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/comunicados/${id}`, { method: "DELETE" }),
    envios: (id: number) => request<any[]>(`/api/comunicados/${id}/envios`),
    marcarLeido: (comunicado_id: number, usuario_id: number) =>
      request<any>(`/api/comunicados/${comunicado_id}/leido`, {
        method: "PATCH",
        body: JSON.stringify({ usuario_id }),
      }),
  },

  // ── Zonas Comunes ──────────────────────────────────────────────────────────
  zonas: {
    list: (edificio_id?: number, incluir_inactivas = false) => {
      const params: any = {};
      if (edificio_id) params.edificio_id = edificio_id;
      if (incluir_inactivas) params.incluir_inactivas = true;
      const q = new URLSearchParams(params).toString();
      return request<any[]>(`/api/zonas-comunes/${q ? "?" + q : ""}`);
    },
    create: (data: any) => request<any>("/api/zonas-comunes/", { method: "POST", body: JSON.stringify(data) }),
    updateConfig: (id: number, data: any) =>
      request<any>(`/api/zonas-comunes/${id}/config`, { method: "PATCH", body: JSON.stringify(data) }),
    disponibilidad: (id: number, fecha: string) =>
      request<any>(`/api/zonas-comunes/${id}/disponibilidad?fecha=${fecha}`),
    reservas: {
      list: (params?: { edificio_id?: number; zona_id?: number; fecha?: string; estado?: string }) => {
        const q = new URLSearchParams(params as any).toString();
        return request<any[]>(`/api/zonas-comunes/reservas${q ? "?" + q : ""}`);
      },
      create: (data: any) => request<any>("/api/zonas-comunes/reservas", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, estado: string) =>
        request<any>(`/api/zonas-comunes/reservas/${id}?estado=${estado}`, { method: "PATCH" }),
      cancelar: (id: number, data: { cancelada_por: string; motivo?: string }) =>
        request<any>(`/api/zonas-comunes/reservas/${id}/cancelar`, { method: "PATCH", body: JSON.stringify(data) }),
      entrega: (id: number, data: { inventario_url?: string; deposito_devuelto?: boolean; estado_entrega?: string }) =>
        request<any>(`/api/zonas-comunes/reservas/${id}/entrega`, { method: "PATCH", body: JSON.stringify(data) }),
      pendientesAlerta: () => request<any[]>("/api/zonas-comunes/reservas/pendientes-alerta"),
      marcarAlertaEnviada: (id: number) =>
        request<any>(`/api/zonas-comunes/reservas/${id}/alerta-enviada`, { method: "PATCH", body: JSON.stringify({}) }),
    },
  },

  // ── Accesos ────────────────────────────────────────────────────────────────
  accesos: {
    list: (params?: { edificio_id?: number; fecha?: string; activos?: boolean }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/accesos/${q ? "?" + q : ""}`);
    },
    registrar: (formData: FormData) => formRequest<any>("/api/accesos/", formData),
    salida: (id: number) => request<any>(`/api/accesos/${id}/salida`, { method: "PATCH", body: JSON.stringify({}) }),
    stats: (edificio_id: number) => request<any>(`/api/accesos/stats/${edificio_id}`),
  },

  // ── Paquetes ───────────────────────────────────────────────────────────────
  paquetes: {
    list: (params?: { edificio_id?: number; unidad_id?: number; estado?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/paquetes/${q ? "?" + q : ""}`);
    },
    get: (id: number) => request<any>(`/api/paquetes/${id}`),
    registrar: (formData: FormData) => formRequest<any>("/api/paquetes/", formData),
    entregar: (id: number, data: any) =>
      request<any>(`/api/paquetes/${id}/entregar`, { method: "PATCH", body: JSON.stringify(data) }),
    stats: (edificio_id: number) => request<any>(`/api/paquetes/stats/${edificio_id}`),
  },

  // ── Guardias ───────────────────────────────────────────────────────────────
  guardias: {
    list: (edificio_id?: number) => {
      const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
      return request<any[]>(`/api/guardias${q}`);
    },
    create: (data: any) => request<any>("/api/guardias", { method: "POST", body: JSON.stringify(data) }),
    turnos: {
      list: (params?: { edificio_id?: number; guardia_id?: number }) => {
        const filtered = Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null));
        const q = new URLSearchParams(filtered as any).toString();
        return request<any[]>(`/api/guardias/turnos${q ? "?" + q : ""}`);
      },
      create: (data: any) => request<any>("/api/guardias/turnos", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) =>
        request<any>(`/api/guardias/turnos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      eventos: (turno_id: number) => request<any[]>(`/api/guardias/turnos/${turno_id}/eventos`),
      crearEvento: (turno_id: number, formData: FormData) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("torre_auth_token") : null;
        return fetch(`${BASE}/api/guardias/turnos/${turno_id}/eventos`, {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json());
      },
    },
    cuadro: (edificio_id: number, mes?: string) => {
      const q = mes ? `?mes=${mes}` : "";
      return request<any[]>(`/api/guardias/cuadro-turnos/${edificio_id}${q}`);
    },
  },

  // ── Chat ───────────────────────────────────────────────────────────────────
  chat: {
    mensajes: (edificio_id: number, limit = 100) =>
      request<any[]>(`/api/chat/${edificio_id}?limit=${limit}`),
    mensajesDM: (edificio_id: number, usuario_a: number, usuario_b: number, limit = 100) =>
      request<any[]>(`/api/chat/${edificio_id}?usuario_a=${usuario_a}&usuario_b=${usuario_b}&limit=${limit}`),
    enviar: (data: any) => request<any>("/api/chat", { method: "POST", body: JSON.stringify(data) }),
    conversaciones: (edificio_id: number, usuario_id: number) =>
      request<any[]>(`/api/chat/${edificio_id}/conversaciones/${usuario_id}`),
    marcarLeidos: (edificio_id: number, usuario_id: number, otro_id?: number) =>
      request<any>(`/api/chat/${edificio_id}/marcar-leidos?usuario_id=${usuario_id}${otro_id !== undefined ? `&otro_id=${otro_id}` : ""}`, { method: "PATCH" }),
    noLeidos: (edificio_id: number, usuario_id: number) =>
      request<any>(`/api/chat/${edificio_id}/no-leidos?usuario_id=${usuario_id}`),
  },

  // ── Backoffice ─────────────────────────────────────────────────────────────
  backoffice: {
    stats: (params?: { organizacion_id?: number; edificio_id?: number; conjunto_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.organizacion_id) q.set("organizacion_id", String(params.organizacion_id));
      if (params?.edificio_id) q.set("edificio_id", String(params.edificio_id));
      if (params?.conjunto_id) q.set("conjunto_id", String(params.conjunto_id));
      const qs = q.toString();
      return request<any>(`/api/backoffice/stats${qs ? `?${qs}` : ""}`);
    },
    analytics: (params?: { organizacion_id?: number; edificio_id?: number; conjunto_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.organizacion_id) q.set("organizacion_id", String(params.organizacion_id));
      if (params?.edificio_id) q.set("edificio_id", String(params.edificio_id));
      if (params?.conjunto_id) q.set("conjunto_id", String(params.conjunto_id));
      const qs = q.toString();
      return request<any>(`/api/backoffice/analytics${qs ? `?${qs}` : ""}`);
    },
    usuarios: {
      list: () => request<any[]>("/api/backoffice/usuarios"),
      create: (data: any) => request<any>("/api/backoffice/usuarios", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => request<any>(`/api/backoffice/usuarios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      desactivar: (id: number) => request<any>(`/api/backoffice/usuarios/${id}/desactivar`, { method: "PATCH" }),
    },
  },

  // ── Encuestas ──────────────────────────────────────────────────────────────
  encuestas: {
    list: (edificio_id: number) =>
      request<any[]>(`/api/encuestas?edificio_id=${edificio_id}`),
    get: (id: number) => request<any>(`/api/encuestas/${id}`),
    create: (data: any) =>
      request<any>("/api/encuestas", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/api/encuestas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/api/encuestas/${id}`, { method: "DELETE" }),
    cambiarEstado: (id: number, estado: string) =>
      request<any>(`/api/encuestas/${id}/estado`, {
        method: "PATCH", body: JSON.stringify({ estado }),
      }),
    responder: (id: number, data: any) =>
      request<any>(`/api/encuestas/${id}/responder`, {
        method: "POST", body: JSON.stringify(data),
      }),
    resultados: (id: number) => request<any>(`/api/encuestas/${id}/resultados`),
  },

  // ── Procurement ────────────────────────────────────────────────────────────
  procurement: {
    stats: (edificio_id: number) =>
      request<any>(`/api/procurement/stats?edificio_id=${edificio_id}`),
    ordenes: {
      list: (params?: { edificio_id?: number; estado?: string; tipo_orden?: string }) => {
        const q = params ? new URLSearchParams(params as any).toString() : "";
        return request<any[]>(`/api/procurement/ordenes${q ? "?" + q : ""}`);
      },
      get: (id: number) => request<any>(`/api/procurement/ordenes/${id}`),
      create: (data: any) =>
        request<any>("/api/procurement/ordenes", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) =>
        request<any>(`/api/procurement/ordenes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      cambiarEstado: (id: number, accion: string, comentario?: string) =>
        request<any>(`/api/procurement/ordenes/${id}/estado`, {
          method: "PATCH",
          body: JSON.stringify({ accion, comentario }),
        }),
      asamblea: {
        toggle: (id: number, requiere: boolean) =>
          request<any>(`/api/procurement/ordenes/${id}/asamblea`, {
            method: "PATCH",
            body: JSON.stringify({ requiere }),
          }),
        decision: (id: number, data: { decision: string; acta_url?: string; cotizacion_url?: string; comentario?: string }) =>
          request<any>(`/api/procurement/ordenes/${id}/asamblea/decision`, {
            method: "PATCH",
            body: JSON.stringify(data),
          }),
      },
      cotizacionesToggle: (id: number, requiere: boolean) =>
        request<any>(`/api/procurement/ordenes/${id}/cotizaciones/toggle`, {
          method: "PATCH",
          body: JSON.stringify({ requiere }),
        }),
      createCotizacion: (id: number, data: any) =>
        request<any>(`/api/procurement/ordenes/${id}/cotizaciones`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      deleteCotizacion: (cot_id: number) =>
        request<any>(`/api/procurement/cotizaciones/${cot_id}`, { method: "DELETE" }),
    },
    asamblea: {
      list: (edificio_id?: number) => {
        const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
        return request<any[]>(`/api/procurement/asamblea${q}`);
      },
    },
    kanban: (edificio_id?: number) => {
      const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
      return request<any>(`/api/procurement/kanban${q}`);
    },
    aprobaciones: {
      pendientes: () => request<any[]>("/api/procurement/aprobaciones/pendientes"),
    },
    cotizaciones: {
      list: (params?: { solicitud_id?: number; orden_id?: number; edificio_id?: number }) => {
        const q = params ? new URLSearchParams(params as any).toString() : "";
        return request<any[]>(`/api/procurement/cotizaciones${q ? "?" + q : ""}`);
      },
      create: (data: any) =>
        request<any>("/api/procurement/cotizaciones", { method: "POST", body: JSON.stringify(data) }),
      marcarGanadora: (id: number) =>
        request<any>(`/api/procurement/cotizaciones/${id}/ganadora`, { method: "PATCH", body: "{}" }),
    },
    solicitudes: {
      list: (edificio_id: number) =>
        request<any[]>(`/api/procurement/solicitudes?edificio_id=${edificio_id}`),
      create: (data: any) =>
        request<any>("/api/procurement/solicitudes", { method: "POST", body: JSON.stringify(data) }),
      cerrar: (id: number) =>
        request<any>(`/api/procurement/solicitudes/${id}/cerrar`, { method: "PATCH", body: "{}" }),
    },
    flujos: {
      list: (edificio_id: number) =>
        request<any[]>(`/api/procurement/flujos?edificio_id=${edificio_id}`),
      create: (data: any) =>
        request<any>("/api/procurement/flujos", { method: "POST", body: JSON.stringify(data) }),
      delete: (id: number) =>
        request<void>(`/api/procurement/flujos/${id}`, { method: "DELETE" }),
    },
  },

  // ── Contratos — Timeline, Pagos, PDF ──────────────────────────────────────
  contratos: {
    tareas: {
      list: (contrato_id: number) => request<any[]>(`/api/contratos/${contrato_id}/tareas`),
      create: (contrato_id: number, data: any) =>
        request<any>(`/api/contratos/${contrato_id}/tareas`, { method: "POST", body: JSON.stringify(data) }),
      seedPredefinidos: (contrato_id: number) =>
        request<any>(`/api/contratos/${contrato_id}/tareas/predefinidos`, { method: "POST", body: "{}" }),
      update: (tarea_id: number, data: any) =>
        request<any>(`/api/contratos/tareas/${tarea_id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (tarea_id: number) =>
        request<void>(`/api/contratos/tareas/${tarea_id}`, { method: "DELETE" }),
    },
    comentarios: {
      list: (contrato_id: number) => request<any[]>(`/api/contratos/${contrato_id}/comentarios`),
      create: (contrato_id: number, data: { comentario: string; tarea_id?: number }) =>
        request<any>(`/api/contratos/${contrato_id}/comentarios`, { method: "POST", body: JSON.stringify(data) }),
      delete: (cmt_id: number) =>
        request<void>(`/api/contratos/comentarios/${cmt_id}`, { method: "DELETE" }),
    },
    pagos: {
      list: (contrato_id: number) => request<any[]>(`/api/contratos/${contrato_id}/pagos`),
      create: (contrato_id: number, data: any) =>
        request<any>(`/api/contratos/${contrato_id}/pagos`, { method: "POST", body: JSON.stringify(data) }),
      delete: (pago_id: number) =>
        request<void>(`/api/contratos/pagos/${pago_id}`, { method: "DELETE" }),
    },
    pdf: async (contrato_id: number) => {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
      const token = typeof window !== "undefined" ? localStorage.getItem("torre_auth_token") : null;
      const res = await fetch(`${BASE}/api/contratos/${contrato_id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${contrato_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },

  // ── Reportes ───────────────────────────────────────────────────────────────
  reportes: {
    dashboard: (edificio_id: number) => request<any>(`/api/reportes/dashboard/${edificio_id}`),
    finanzas: (edificio_id: number, meses = 6) =>
      request<any[]>(`/api/reportes/finanzas/${edificio_id}?meses=${meses}`),
    mantenimiento: (edificio_id: number) => request<any>(`/api/reportes/mantenimiento/${edificio_id}`),
    accesos: (edificio_id: number, dias = 7) =>
      request<any[]>(`/api/reportes/accesos/${edificio_id}?dias=${dias}`),
    paquetes: (edificio_id: number) => request<any>(`/api/reportes/paquetes/${edificio_id}`),
    guardias: (edificio_id: number) => request<any[]>(`/api/reportes/guardias/${edificio_id}`),
  },

  // ── Chatbot IA ─────────────────────────────────────────────────────────────
  chatbot: {
    sendMessage: (message: string, history: { role: string; content: string }[]) =>
      request<{ message: string; actions: { tool: string; success: boolean; summary: string }[] }>(
        "/api/chatbot/message",
        { method: "POST", body: JSON.stringify({ message, history }) }
      ),
    // Active config (backward compat for test/bubble)
    getConfig: () => request<any>("/api/chatbot/config"),
    // Multi-config CRUD
    listConfigs: () => request<any[]>("/api/chatbot/configs"),
    createConfig: (data: {
      nombre: string;
      proveedor: string;
      api_key: string;
      modelo?: string;
      base_url?: string;
      temperatura: number;
    }) => request<any>("/api/chatbot/configs", { method: "POST", body: JSON.stringify(data) }),
    updateConfig: (id: number, data: {
      nombre?: string;
      proveedor?: string;
      api_key?: string;
      modelo?: string;
      base_url?: string;
      temperatura?: number;
    }) => request<any>(`/api/chatbot/configs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteConfig: (id: number) => request<void>(`/api/chatbot/configs/${id}`, { method: "DELETE" }),
    activateConfig: (id: number) =>
      request<any>(`/api/chatbot/configs/${id}/activate`, { method: "POST" }),
    testConnection: (config?: {
      proveedor?: string;
      api_key?: string;
      modelo?: string;
      base_url?: string;
      temperatura?: number;
    }) =>
      request<{ ok: boolean; message: string; latencia_ms: number }>(
        "/api/chatbot/test",
        { method: "POST", body: JSON.stringify(config ?? {}) }
      ),
  },
};

// ── Organizaciones (Backoffice) ────────────────────────────────────────────────
export const organizacionesApi = {
  list: () => request<any>("/api/organizaciones"),
  create: (data: any) => request<any>("/api/organizaciones", { method: "POST", body: JSON.stringify(data) }),
  get: (id: number) => request<any>(`/api/organizaciones/${id}`),
  update: (id: number, data: any) => request<any>(`/api/organizaciones/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  asignarSA: (orgId: number, usuario_id: number) =>
    request<any>(`/api/organizaciones/${orgId}/superadmins`, { method: "POST", body: JSON.stringify({ usuario_id }) }),
  crearYAsignarSA: (orgId: number, data: any) =>
    request<any>(`/api/organizaciones/${orgId}/superadmins/crear`, { method: "POST", body: JSON.stringify(data) }),
  quitarSA: (orgId: number, usuarioId: number) =>
    request<any>(`/api/organizaciones/${orgId}/superadmins/${usuarioId}`, { method: "DELETE" }),
  superadminsDisponibles: () => request<any>("/api/organizaciones/superadmins/disponibles"),
};
