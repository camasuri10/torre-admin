"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi, conjuntosApi } from "@/lib/api";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats]         = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [conjuntos, setConjuntos] = useState<any[]>([]);
  const [conjuntoId, setConjuntoId] = useState<number | undefined>(undefined);
  const [loading, setLoading]     = useState(true);

  // Cuotas detail modal
  const [detailEstado, setDetailEstado] = useState<"pendiente" | "vencido" | null>(null);
  const [detailCuotas, setDetailCuotas] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    conjuntosApi.list().then((r: any) => setConjuntos(r?.conjuntos ?? [])).catch(() => {});
    superadminApi.analytics().then(setAnalytics).catch(console.error);
  }, [router]);

  useEffect(() => {
    setLoading(true);
    superadminApi.stats(conjuntoId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conjuntoId]);

  async function openDetalle(estado: "pendiente" | "vencido") {
    setDetailEstado(estado);
    setDetailLoading(true);
    setDetailCuotas([]);
    try {
      const data = await superadminApi.cuotasDetalle(estado, conjuntoId);
      setDetailCuotas(data?.cuotas ?? []);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }

  const statCards = [
    { label: "Conjuntos",        value: stats?.total_conjuntos ?? 0, icon: "🏘️", href: "/dashboard/superadmin/conjuntos", color: "bg-sky-50 border-sky-100" },
    { label: "Edificios",        value: stats?.total_edificios  ?? 0, icon: "🏢", href: "/dashboard/superadmin/edificios", color: "bg-blue-50 border-blue-100" },
    { label: "Administradores",  value: stats?.total_admins     ?? 0, icon: "👤", href: "/dashboard/superadmin/admins",    color: "bg-green-50 border-green-100" },
    { label: "Staff Servicios",  value: stats?.total_staff      ?? 0, icon: "🧹", href: "/dashboard/superadmin/admins",    color: "bg-teal-50 border-teal-100" },
    { label: "Usuarios totales", value: stats?.total_usuarios   ?? 0, icon: "👥", href: null,                              color: "bg-purple-50 border-purple-100" },
    { label: "Módulos",          value: stats?.total_modulos    ?? 0, icon: "🧩", href: null,                              color: "bg-orange-50 border-orange-100" },
  ];

  const kpis = [
    {
      label: "Cuotas pendientes",
      value: stats?.cuotas_pendientes ?? 0,
      sub: stats?.cuotas_pendientes_monto != null ? fmt(stats.cuotas_pendientes_monto) : null,
      icon: "⏳",
      color: "bg-yellow-50 border-yellow-200 text-yellow-700",
      valueColor: "text-yellow-800",
      clickable: true,
      estado: "pendiente" as const,
    },
    {
      label: "Cuotas vencidas",
      value: stats?.cuotas_vencidas ?? 0,
      sub: stats?.cuotas_vencidas_monto != null ? fmt(stats.cuotas_vencidas_monto) : null,
      icon: "🚨",
      color: "bg-red-50 border-red-200 text-red-700",
      valueColor: "text-red-700",
      clickable: true,
      estado: "vencido" as const,
    },
    {
      label: "Recaudo del mes",
      value: stats?.recaudo_mes != null ? fmt(stats.recaudo_mes) : "—",
      sub: null,
      icon: "💰",
      color: "bg-green-50 border-green-200 text-green-700",
      valueColor: "text-green-700",
      clickable: false,
      estado: null,
    },
    {
      label: "Mantenimientos activos",
      value: stats?.mantenimientos_activos ?? 0,
      sub: null,
      icon: "🔧",
      color: "bg-orange-50 border-orange-200 text-orange-700",
      valueColor: "text-orange-700",
      clickable: false,
      estado: null,
    },
    {
      label: "Reservas hoy",
      value: stats?.reservas_hoy ?? 0,
      sub: null,
      icon: "📅",
      color: "bg-blue-50 border-blue-200 text-blue-700",
      valueColor: "text-blue-700",
      clickable: false,
      estado: null,
    },
    {
      label: "Ocupación",
      value: `${stats?.ocupacion_pct != null ? Number(stats.ocupacion_pct).toFixed(1) : "—"}%`,
      sub: null,
      icon: "🏠",
      color: "bg-purple-50 border-purple-200 text-purple-700",
      valueColor: "text-purple-700",
      clickable: false,
      estado: null,
    },
  ];

  const topModulos: any[] = analytics?.top_modulos ?? [];
  const maxUsos = topModulos.reduce((m: number, x: any) => Math.max(m, x.total_usos), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Panel Super Admin</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestión global de la plataforma TorreAdmin</p>
        </div>

        {conjuntos.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">Filtrar por conjunto:</label>
            <select
              value={conjuntoId ?? ""}
              onChange={(e) => setConjuntoId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos</option>
              {conjuntos.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPIs operacionales */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Indicadores operacionales</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((k) => {
            const inner = (
              <div className={`border rounded-2xl p-4 h-full ${k.color} ${k.clickable && !loading ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
                <div className="text-xl mb-1">{k.icon}</div>
                <div className={`text-2xl font-bold ${k.valueColor}`}>
                  {loading ? "—" : k.value}
                </div>
                <div className="text-xs font-medium mt-0.5 opacity-80">{k.label}</div>
                {k.sub && !loading && (
                  <div className="text-xs opacity-70 mt-1 font-mono">{k.sub}</div>
                )}
                {k.clickable && !loading && (
                  <div className="text-xs mt-1 opacity-60 underline">Ver detalle →</div>
                )}
              </div>
            );
            return k.clickable && !loading ? (
              <button key={k.label} className="text-left h-full" onClick={() => openDetalle(k.estado!)}>
                {inner}
              </button>
            ) : (
              <div key={k.label}>{inner}</div>
            );
          })}
        </div>
      </div>

      {/* Stats globales */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen de la plataforma</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((c) => {
            const inner = (
              <div className={`border rounded-2xl p-5 h-full ${c.color} ${c.href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="text-3xl font-bold text-gray-900">{loading ? "—" : c.value}</div>
                <div className="text-sm text-gray-500 mt-1">{c.label}</div>
              </div>
            );
            return c.href ? (
              <Link key={c.label} href={c.href} className="h-full block">{inner}</Link>
            ) : (
              <div key={c.label}>{inner}</div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Módulos más usados */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Módulos más usados</h3>
          {topModulos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos de uso aún. El uso se registra automáticamente al navegar por los módulos.</p>
          ) : (
            <div className="space-y-3">
              {topModulos.slice(0, 5).map((m: any) => (
                <div key={m.modulo_clave} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{m.modulo_nombre ?? m.modulo_clave}</span>
                    <span className="text-gray-500 text-xs">{m.total_usos} usos · {m.usuarios_unicos} usuarios</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((m.total_usos / maxUsos) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones rápidas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { href: "/dashboard/superadmin/conjuntos", icon: "🏘️", label: "Gestionar conjuntos", desc: "Agrupar torres bajo un conjunto" },
              { href: "/dashboard/superadmin/edificios", icon: "🏢", label: "Gestionar edificios",  desc: "Crear, editar y configurar módulos" },
              { href: "/dashboard/superadmin/admins",    icon: "👤", label: "Gestionar personal",   desc: "Admins, porteros y staff de servicios" },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-blue-50/40 transition-all group">
                <span className="text-xl">{a.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800 group-hover:text-primary">{a.label}</div>
                  <div className="text-xs text-gray-400">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Cuotas detail modal */}
      {detailEstado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {detailEstado === "pendiente" ? "⏳ Cuotas pendientes" : "🚨 Cuotas vencidas"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Detalle de quien debe y el mes correspondiente</p>
              </div>
              <button onClick={() => setDetailEstado(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {detailLoading ? (
                <p className="text-center text-gray-400 py-8">Cargando…</p>
              ) : detailCuotas.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay cuotas {detailEstado === "pendiente" ? "pendientes" : "vencidas"} en este momento.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Residente</th>
                      <th className="pb-2 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Unidad</th>
                      <th className="pb-2 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Edificio</th>
                      <th className="pb-2 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Mes</th>
                      <th className="pb-2 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detailCuotas.map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-gray-800 font-medium">{c.residente_nombre}</td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          {c.torre_nombre ? `${c.torre_nombre} - ` : ""}{c.unidad_numero}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500 hidden sm:table-cell">{c.edificio_nombre}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{c.mes}</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-red-600">{fmt(c.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setDetailEstado(null)}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
