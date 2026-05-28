"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#1a5276", "#2e86c1", "#1e8449", "#d35400", "#8e44ad", "#16a085"];

const ROL_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  administrador: "Admin",
  propietario: "Propietario",
  inquilino: "Inquilino",
  portero: "Portero",
  servicios: "Servicios",
  backoffice: "Backoffice",
};

const ESTADO_COLORES: Record<string, string> = {
  pendiente: "#d97706",
  en_proceso: "#2563eb",
  resuelto: "#16a34a",
  cancelado: "#6b7280",
};

export type KpiFilter =
  | null
  | "estructura"
  | "actividad"
  | "finanzas"
  | "cuotas_vencidas"
  | "cuotas_pendientes"
  | "mantenimientos"
  | "modulos";

export default function BackofficeDashboard() {
  const user = getUser();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<KpiFilter>(null);

  const estructuraRef = useRef<HTMLDivElement>(null);
  const actividadRef = useRef<HTMLDivElement>(null);
  const cuotasRef = useRef<HTMLDivElement>(null);
  const modulosRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);

  const scopeParams = {
    organizacion_id: user?.organizacion_id,
    conjunto_id: user?.conjunto_id,
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, a] = await Promise.all([
        api.backoffice.stats(scopeParams),
        api.backoffice.analytics(scopeParams),
      ]);
      setStats(s);
      setAnalytics(a);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("401")) {
        setError("Sesión expirada. Por favor, vuelve a iniciar sesión.");
      } else if (msg.includes("403")) {
        setError("Tu usuario no tiene permisos de Backoffice.");
      } else {
        setError(`Error al cargar los datos: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.organizacion_id, user?.conjunto_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleKpi(filter: KpiFilter) {
    const next = activeKpi === filter ? null : filter;
    setActiveKpi(next);
    requestAnimationFrame(() => {
      if (!next) return;
      const target =
        next === "finanzas" || next === "cuotas_vencidas" || next === "cuotas_pendientes"
          ? cuotasRef.current
          : next === "actividad" || next === "mantenimientos"
            ? actividadRef.current
            : next === "estructura"
              ? estructuraRef.current
              : next === "modulos"
                ? modulosRef.current
                : chartsRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function rowVisible(row: "estructura" | "actividad" | "finanzas" | "modulos" | "charts") {
    if (!activeKpi) return true;
    if (activeKpi === "estructura") return row === "estructura";
    if (activeKpi === "actividad" || activeKpi === "mantenimientos") return row === "actividad" || row === "charts";
    if (activeKpi === "finanzas" || activeKpi === "cuotas_vencidas" || activeKpi === "cuotas_pendientes") {
      return row === "finanzas" || row === "charts";
    }
    if (activeKpi === "modulos") return row === "modulos";
    return true;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando reportería global…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        {error ?? "Error al cargar los datos. Verifique que tiene permisos de Backoffice."}
      </div>
    );
  }

  const usuariosChartData = Object.entries(stats.usuarios_por_rol ?? {}).map(([rol, total]) => ({
    name: ROL_LABELS[rol] ?? rol,
    value: total as number,
  }));

  const mantenimientosData = (analytics?.mantenimientos_por_estado ?? []).map((r: any) => ({
    name: r.estado,
    value: r.total,
    fill: ESTADO_COLORES[r.estado] ?? "#9ca3af",
  }));

  const comunicadosTipoData = (analytics?.comunicados_por_tipo ?? []).map((r: any) => ({
    name: r.tipo,
    total: r.total,
  }));

  const scopeLabel = [
    user?.organizacion_nombre,
    user?.conjunto_id ? "Conjunto específico" : null,
  ].filter(Boolean).join(" · ") || "Plataforma completa";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Global</h2>
          <p className="text-gray-500 text-sm mt-1">Resumen de la plataforma TorreAdmin</p>
          <p className="text-xs text-primary font-medium mt-1">Alcance: {scopeLabel}</p>
        </div>
        {activeKpi && (
          <button
            type="button"
            onClick={() => setActiveKpi(null)}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 self-start"
          >
            ✕ Quitar filtro de tarjeta
          </button>
        )}
      </div>

      <div ref={estructuraRef} className={rowVisible("estructura") ? "" : "hidden"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="🏘️" label="Conjuntos" value={stats.conjuntos} color="blue"
            active={activeKpi === "estructura"} onClick={() => toggleKpi("estructura")} />
          <KpiCard icon="🔌" label="Módulos disponibles" value={stats.modulos_total ?? 0} color="green"
            active={activeKpi === "modulos"} onClick={() => toggleKpi("modulos")} />
          <KpiCard icon="👥" label="Total usuarios"
            value={Object.values(stats.usuarios_por_rol ?? {}).reduce((a: number, b: any) => a + b, 0)}
            color="purple" active={activeKpi === "estructura"} onClick={() => toggleKpi("estructura")} />
        </div>
      </div>

      <div ref={actividadRef} className={rowVisible("actividad") ? "" : "hidden"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="📅" label="Reservas" value={stats.reservas} color="teal"
            active={activeKpi === "actividad"} onClick={() => toggleKpi("actividad")} />
          <KpiCard icon="📢" label="Comunicados" value={stats.comunicados} color="teal"
            active={activeKpi === "actividad"} onClick={() => toggleKpi("actividad")} />
          <KpiCard icon="🔧" label="Mantenimientos" value={stats.mantenimientos} color="orange"
            active={activeKpi === "mantenimientos"} onClick={() => toggleKpi("mantenimientos")} />
          <KpiCard icon="🏭" label="Proveedores" value={stats.proveedores} color="orange"
            active={activeKpi === "actividad"} onClick={() => toggleKpi("actividad")} />
        </div>
      </div>

      <div ref={cuotasRef} className={rowVisible("finanzas") ? "" : "hidden"}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon="✅" label="Cuotas pagadas" value={stats.cuotas?.pagadas ?? 0} color="green"
            active={activeKpi === "finanzas"} onClick={() => toggleKpi("finanzas")} />
          <KpiCard icon="⏳" label="Cuotas pendientes" value={stats.cuotas?.pendientes ?? 0} color="yellow"
            active={activeKpi === "cuotas_pendientes"} onClick={() => toggleKpi("cuotas_pendientes")} />
          <KpiCard icon="⚠️" label="Cuotas vencidas" value={stats.cuotas?.vencidas ?? 0} color="red"
            active={activeKpi === "cuotas_vencidas"} onClick={() => toggleKpi("cuotas_vencidas")} />
          <KpiCard icon="📦" label="Paquetes totales" value={stats.paquetes} color="gray"
            active={activeKpi === "actividad"} onClick={() => toggleKpi("actividad")} />
        </div>
      </div>

      <div ref={modulosRef} className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${rowVisible("modulos") ? "" : "hidden"}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Activación por módulo</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
              {stats.modulos_activaciones ?? 0} activaciones totales
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Conjuntos con cada módulo habilitado</p>
          <div className="space-y-2.5">
            {(stats.modulos_detalle ?? []).map((m: any) => (
              <div key={m.clave} className="flex items-center gap-3">
                <span className="text-base w-5 flex-shrink-0">{m.icono}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate">{m.nombre}</span>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {m.activaciones}/{stats.conjuntos}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: stats.conjuntos > 0 ? `${Math.round((m.activaciones / stats.conjuntos) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Módulos más usados</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
              {(analytics?.modulos_mas_usados ?? []).reduce((a: number, m: any) => a + m.usos, 0)} usos totales
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Conteo de interacciones registradas por módulo</p>
          {(analytics?.modulos_mas_usados ?? []).length > 0 ? (
            <div className="space-y-2.5">
              {(() => {
                const maxUsos = Math.max(...(analytics?.modulos_mas_usados ?? []).map((m: any) => m.usos), 1);
                return (analytics?.modulos_mas_usados ?? []).map((m: any) => (
                  <div key={m.clave} className="flex items-center gap-3">
                    <span className="text-base w-5 flex-shrink-0">{m.icono}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{m.nombre}</span>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{m.usos.toLocaleString("es-CO")}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-accent h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((m.usos / maxUsos) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-3xl mb-2">📊</span>
              <p className="text-sm text-gray-500 font-medium">Sin datos de uso aún</p>
            </div>
          )}
        </div>
      </div>

      <div ref={chartsRef} className={rowVisible("charts") ? "space-y-6" : "hidden"}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Usuarios por Rol</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={usuariosChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Usuarios" fill="#1a5276" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Mantenimientos por Estado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={mantenimientosData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }: { name?: string; value?: number }) => `${name ?? ""}: ${value ?? ""}`}
                >
                  {mantenimientosData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Reservas — Últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics?.reservas_por_mes ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2e86c1" strokeWidth={2} dot={false} name="Reservas" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comunicados — Últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics?.comunicados_por_mes ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Comunicados" fill="#1e8449" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Cuotas — Últimos 6 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics?.cuotas_por_mes ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pagadas" name="Pagadas" fill="#16a34a" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="pendientes" name="Pendientes" fill="#d97706" stackId="a" />
                <Bar dataKey="vencidas" name="Vencidas" fill="#dc2626" stackId="a" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Comunicados por Tipo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comunicadosTipoData} layout="vertical" margin={{ top: 5, right: 10, left: 50, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#8e44ad" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Contratos activos" value={stats.contratos} icon="📋" />
        <SummaryCard label="Accesos registrados" value={stats.accesos} icon="🔐" />
        <SummaryCard label="Mant. abiertos" value={(stats.mantenimientos_estado?.pendientes ?? 0) + (stats.mantenimientos_estado?.en_proceso ?? 0)} icon="🔧" />
        <SummaryCard label="Usuarios nuevos (6m)" value={(analytics?.usuarios_por_mes ?? []).reduce((a: number, r: any) => a + r.total, 0)} icon="👤" />
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, color, active, onClick,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
    teal: "bg-teal-50 text-teal-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3 text-left w-full transition-all hover:shadow-md ${
        active ? "border-primary ring-2 ring-primary/30" : "border-gray-100"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${colorMap[color] ?? colorMap.gray}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value?.toLocaleString("es-CO") ?? 0}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </button>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900">{value?.toLocaleString("es-CO") ?? 0}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
