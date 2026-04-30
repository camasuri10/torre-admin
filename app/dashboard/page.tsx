"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  dashboardStats as mockStats,
  solicitudesMantenimiento as mockMant,
  comunicados as mockComun,
  cuotas as mockCuotas,
} from "@/lib/mock-data";

const EDIFICIO_ID = 1;

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [morosos, setMorosos] = useState<any[]>([]);
  const [paquetes, setPaquetes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, mant, com, cuotas, paq] = await Promise.all([
          api.reportes.dashboard(EDIFICIO_ID),
          api.mantenimientos.list({ edificio_id: EDIFICIO_ID, estado: "pendiente" }),
          api.comunicados.list({ edificio_id: EDIFICIO_ID }),
          api.cuotas.list({ edificio_id: EDIFICIO_ID, estado: "vencido" }),
          api.paquetes.stats(EDIFICIO_ID),
        ]);
        setStats(s);
        setPendientes(mant.slice(0, 5));
        setComunicados(com.slice(0, 3));
        setMorosos(cuotas.slice(0, 5));
        setPaquetes(paq);
      } catch {
        // Fallback to mock data when API is not available
        setStats({
          total_unidades: mockStats.totalUnidades,
          morosos: mockStats.morosos,
          solicitudes_pendientes: mockStats.solicitudesPendientes,
          recaudo_mes: mockStats.recaudoMes,
          meta_recaudo: mockStats.metaRecaudo,
          ingresos_hoy: 4,
          paquetes_pendientes: 3,
          alertas_proximas: 2,
        });
        setPendientes(
          mockMant
            .filter((s) => s.estado === "Pendiente" || s.estado === "En Proceso")
            .slice(0, 5)
            .map((s) => ({
              id: s.id,
              titulo: s.titulo,
              unidad_numero: s.apto,
              edificio_nombre: s.edificio,
              prioridad: s.prioridad.toLowerCase(),
              estado: s.estado.toLowerCase().replace(" ", "_"),
            }))
        );
        setComunicados(
          mockComun.slice(0, 3).map((c) => ({
            id: c.id,
            titulo: c.titulo,
            fecha: c.fecha,
            tipo: c.tipo.toLowerCase(),
          }))
        );
        setMorosos(
          mockCuotas
            .filter((c) => c.estado === "Vencido")
            .slice(0, 5)
            .map((c) => ({
              id: c.id,
              residente_nombre: c.residente,
              unidad_numero: c.apto,
              monto: c.monto,
            }))
        );
        setPaquetes({ recibidos: 2, notificados: 1, entregados: 8, hoy: 3 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const recaudoPct = stats
    ? Math.round((stats.recaudo_mes / (stats.meta_recaudo || 1)) * 100)
    : 0;

  const statCards = [
    { label: "Unidades", value: stats?.total_unidades ?? "—", icon: "🏠", color: "bg-indigo-50 text-indigo-700", iconBg: "bg-indigo-100", href: "/dashboard/residentes" },
    { label: "Morosos", value: stats?.morosos ?? "—", icon: "⚠️", color: "bg-red-50 text-red-700", iconBg: "bg-red-100", href: "/dashboard/finanzas" },
    { label: "Solicitudes abiertas", value: stats?.solicitudes_pendientes ?? "—", icon: "🔧", color: "bg-amber-50 text-amber-700", iconBg: "bg-amber-100", href: "/dashboard/mantenimiento" },
    { label: "Ingresos hoy", value: stats?.ingresos_hoy ?? "—", icon: "🔐", color: "bg-purple-50 text-purple-700", iconBg: "bg-purple-100", href: "/dashboard/accesos" },
    { label: "Paquetes pendientes", value: paquetes ? (paquetes.recibidos + paquetes.notificados) : "—", icon: "📦", color: "bg-orange-50 text-orange-700", iconBg: "bg-orange-100", href: "/dashboard/paquetes" },
    { label: "Alertas próximas", value: stats?.alertas_proximas ?? "—", icon: "🔔", color: "bg-yellow-50 text-yellow-700", iconBg: "bg-yellow-100", href: "/dashboard/mantenimiento" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${card.iconBg}`}>
              {card.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{loading ? "…" : card.value}</div>
              <div className="text-xs text-gray-500 leading-tight">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recaudo del mes */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Recaudo del mes</h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
            </p>
          </div>
          <Link href="/dashboard/finanzas" className="text-sm text-primary font-medium hover:underline">
            Ver detalle →
          </Link>
        </div>
        <div className="flex items-end gap-4 mb-3">
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? "…" : formatCOP(stats?.recaudo_mes ?? 0)}
            </div>
            <div className="text-sm text-gray-500">
              de {loading ? "…" : formatCOP(stats?.meta_recaudo ?? 0)} meta
            </div>
          </div>
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${recaudoPct >= 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {recaudoPct}%
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-accent h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, recaudoPct)}%` }}
          />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Solicitudes recientes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Solicitudes de mantenimiento</h2>
            <Link href="/dashboard/mantenimiento" className="text-sm text-primary font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-4">Cargando...</div>
            ) : pendientes.length === 0 ? (
              <div className="text-center text-gray-400 py-4">Sin solicitudes pendientes ✅</div>
            ) : pendientes.map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  s.prioridad === "alta" ? "bg-red-500" :
                  s.prioridad === "media" ? "bg-amber-500" : "bg-green-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.titulo}</div>
                  <div className="text-xs text-gray-500">{s.unidad_numero} · {s.edificio_nombre}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  s.estado === "en_proceso" || s.estado === "En Proceso"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {s.estado.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          {/* Morosos */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm">Morosos recientes</h2>
              <Link href="/dashboard/finanzas" className="text-xs text-primary font-medium hover:underline">Ver →</Link>
            </div>
            <div className="space-y-2">
              {loading ? (
                <div className="text-xs text-gray-400">Cargando...</div>
              ) : morosos.length === 0 ? (
                <div className="text-xs text-gray-400">Sin morosos ✅</div>
              ) : morosos.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-800 text-xs truncate max-w-[130px]">
                      {(c.residente_nombre ?? c.residente ?? "").split(" ").slice(0, 2).join(" ")}
                    </div>
                    <div className="text-gray-400 text-xs">{c.unidad_numero ?? c.apto}</div>
                  </div>
                  <span className="text-red-600 font-semibold text-xs">{formatCOP(c.monto)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Últimos comunicados */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm">Comunicados</h2>
              <Link href="/dashboard/comunicados" className="text-xs text-primary font-medium hover:underline">Ver →</Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="text-xs text-gray-400">Cargando...</div>
              ) : comunicados.map((c) => (
                <div key={c.id} className="border-l-2 border-primary/30 pl-3">
                  <div className="text-xs font-medium text-gray-800 leading-snug">{c.titulo}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.fecha}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
