"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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

export default function BackofficeDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.backoffice.stats(),
      api.backoffice.analytics(),
    ])
      .then(([s, a]) => {
        setStats(s);
        setAnalytics(a);
      })
      .catch((err: any) => {
        const msg: string = err?.message ?? String(err);
        if (msg.includes("401")) {
          setError("Sesión expirada. Por favor, vuelve a iniciar sesión.");
        } else if (msg.includes("403")) {
          setError("Tu usuario no tiene permisos de Backoffice.");
        } else {
          setError(`Error al cargar los datos: ${msg}`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Global</h2>
        <p className="text-gray-500 text-sm mt-1">Resumen completo de la plataforma TorreAdmin</p>
      </div>

      {/* KPI Cards — Fila 1: Estructura */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="🏘️" label="Conjuntos" value={stats.conjuntos} color="blue" />
        <KpiCard icon="🏢" label="Edificios" value={stats.edificios} color="blue" />
        <KpiCard icon="🔌" label="Módulos activos" value={stats.modulos_activos} color="green" />
        <KpiCard icon="👥" label="Total usuarios"
          value={Object.values(stats.usuarios_por_rol ?? {}).reduce((a: number, b: any) => a + b, 0)}
          color="purple" />
      </div>

      {/* KPI Cards — Fila 2: Actividad */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📅" label="Reservas" value={stats.reservas} color="teal" />
        <KpiCard icon="📢" label="Comunicados" value={stats.comunicados} color="teal" />
        <KpiCard icon="🔧" label="Mantenimientos" value={stats.mantenimientos} color="orange" />
        <KpiCard icon="🏭" label="Proveedores" value={stats.proveedores} color="orange" />
      </div>

      {/* KPI Cards — Fila 3: Finanzas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="✅" label="Cuotas pagadas" value={stats.cuotas?.pagadas ?? 0} color="green" />
        <KpiCard icon="⏳" label="Cuotas pendientes" value={stats.cuotas?.pendientes ?? 0} color="yellow" />
        <KpiCard icon="⚠️" label="Cuotas vencidas" value={stats.cuotas?.vencidas ?? 0} color="red" />
        <KpiCard icon="📦" label="Paquetes totales" value={stats.paquetes} color="gray" />
      </div>

      {/* Charts — Fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usuarios por rol */}
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

        {/* Mantenimientos por estado */}
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

      {/* Charts — Fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservas por mes */}
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

        {/* Comunicados por mes */}
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

      {/* Charts — Fila 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuotas por mes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Cuotas — Últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics?.cuotas_por_mes ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="pagadas" name="Pagadas" fill="#16a34a" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="pendientes" name="Pendientes" fill="#d97706" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="vencidas" name="Vencidas" fill="#dc2626" radius={[0, 0, 0, 0]} stackId="a" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Comunicados por tipo */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Contratos activos" value={stats.contratos} icon="📋" />
        <SummaryCard label="Accesos registrados" value={stats.accesos} icon="🔐" />
        <SummaryCard label="Mant. abiertos" value={(stats.mantenimientos_estado?.pendientes ?? 0) + (stats.mantenimientos_estado?.en_proceso ?? 0)} icon="🔧" />
        <SummaryCard label="Usuarios nuevos (6m)" value={(analytics?.usuarios_por_mes ?? []).reduce((a: number, r: any) => a + r.total, 0)} icon="👤" />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${colorMap[color] ?? colorMap.gray}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value?.toLocaleString("es-CO") ?? 0}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
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
