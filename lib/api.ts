/**
 * TorreAdmin API client.
 * All fetch calls go through here so the base URL is configured in one place.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Edificios ─────────────────────────────────────────────────────────────────
export const api = {
  edificios: {
    list: () => request<any[]>("/api/edificios/"),
    get: (id: number) => request<any>(`/api/edificios/${id}`),
    stats: (id: number) => request<any>(`/api/edificios/${id}/stats`),
    unidades: (id: number) => request<any[]>(`/api/edificios/${id}/unidades`),
    create: (data: any) => request<any>("/api/edificios/", { method: "POST", body: JSON.stringify(data) }),
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
  },

  // ── Finanzas ───────────────────────────────────────────────────────────────
  cuotas: {
    list: (params?: { edificio_id?: number; estado?: string; mes?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/cuotas/${q ? "?" + q : ""}`);
    },
    create: (data: any) => request<any>("/api/cuotas/", { method: "POST", body: JSON.stringify(data) }),
    pagar: (id: number, data: any) => request<any>(`/api/cuotas/${id}/pagar`, { method: "PATCH", body: JSON.stringify(data) }),
    resumen: (edificio_id: number, mes?: string) => {
      const q = mes ? `?mes=${mes}` : "";
      return request<any>(`/api/cuotas/resumen/${edificio_id}${q}`);
    },
  },

  // ── Mantenimiento ──────────────────────────────────────────────────────────
  mantenimientos: {
    list: (params?: { edificio_id?: number; estado?: string; prioridad?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/mantenimientos/${q ? "?" + q : ""}`);
    },
    get: (id: number) => request<any>(`/api/mantenimientos/${id}`),
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
    list: (edificio_id?: number) => {
      const q = edificio_id ? `?edificio_id=${edificio_id}` : "";
      return request<any[]>(`/api/zonas-comunes/${q}`);
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
      return request<any[]>(`/api/guardias/${q}`);
    },
    create: (data: any) => request<any>("/api/guardias/", { method: "POST", body: JSON.stringify(data) }),
    turnos: {
      list: (params?: { edificio_id?: number; guardia_id?: number }) => {
        const q = new URLSearchParams(params as any).toString();
        return request<any[]>(`/api/guardias/turnos${q ? "?" + q : ""}`);
      },
      create: (data: any) => request<any>("/api/guardias/turnos", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) =>
        request<any>(`/api/guardias/turnos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      eventos: (turno_id: number) => request<any[]>(`/api/guardias/turnos/${turno_id}/eventos`),
      crearEvento: (turno_id: number, formData: FormData) =>
        fetch(`${BASE}/api/guardias/turnos/${turno_id}/eventos`, { method: "POST", body: formData }).then((r) => r.json()),
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
