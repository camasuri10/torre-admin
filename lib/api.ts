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
  seleccionarTodos: () =>
    request<any>("/api/auth/seleccionar-todos", { method: "POST", body: JSON.stringify({}) }),
  misEdificios: () => request<{ edificios: { id: number; nombre: string }[] }>("/api/auth/mis-edificios"),
  me: () => request<any>("/api/auth/me"),
};

// ── Super Admin ───────────────────────────────────────────────────────────────
export const superadminApi = {
  stats: (conjunto_id?: number) => {
    const q = conjunto_id ? `?conjunto_id=${conjunto_id}` : "";
    return request<any>(`/api/superadmin/stats${q}`);
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
    updateAsignaciones: (id: number, data: { edificio_ids: number[]; conjunto_ids: number[] }) =>
      request<any>(`/api/superadmin/admins/${id}/edificios`, { method: "PUT", body: JSON.stringify(data) }),
  },
  staff: {
    list: () => request<any>("/api/superadmin/staff"),
    create: (data: any) => request<any>("/api/superadmin/admins", { method: "POST", body: JSON.stringify(data) }),
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
      create: (edificio_id: number, data: { nombre: string; numero?: string; pisos?: number }) =>
        request<any>(`/api/edificios/${edificio_id}/torres`, { method: "POST", body: JSON.stringify(data) }),
      update: (edificio_id: number, torre_id: number, data: any) =>
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
    list: (params?: { rol?: string; edificio_id?: number }) => {
      const q = new URLSearchParams(params as any).toString();
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
  },

  // ── Comunicados ────────────────────────────────────────────────────────────
  comunicados: {
    list: (params?: { edificio_id?: number; tipo?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/comunicados/${q ? "?" + q : ""}`);
    },
    create: (data: any) => request<any>("/api/comunicados/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/api/comunicados/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/api/comunicados/${id}`, { method: "DELETE" }),
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
    registrar: (data: any) => request<any>("/api/accesos/", { method: "POST", body: JSON.stringify(data) }),
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
    registrar: (formData: FormData) =>
      fetch(`${BASE}/api/paquetes/`, { method: "POST", body: formData }).then((r) => r.json()),
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
    cuadro: (edificio_id: number, semana?: string) => {
      const q = semana ? `?semana=${semana}` : "";
      return request<any[]>(`/api/guardias/cuadro-turnos/${edificio_id}${q}`);
    },
  },

  // ── Chat ───────────────────────────────────────────────────────────────────
  chat: {
    mensajes: (edificio_id: number, limit = 50) =>
      request<any[]>(`/api/chat/${edificio_id}?limit=${limit}`),
    enviar: (data: any) => request<any>("/api/chat/", { method: "POST", body: JSON.stringify(data) }),
    marcarLeidos: (edificio_id: number, usuario_id: number) =>
      request<any>(`/api/chat/${edificio_id}/marcar-leidos?usuario_id=${usuario_id}`, { method: "PATCH" }),
    noLeidos: (edificio_id: number, usuario_id: number) =>
      request<any>(`/api/chat/${edificio_id}/no-leidos?usuario_id=${usuario_id}`),
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
};
