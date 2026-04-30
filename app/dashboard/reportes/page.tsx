"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, sub, color = "bg-blue-50 text-blue-700" }: any) {
  return (
    <div className={`rounded-xl p-4 border border-current/10 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ReportesPage() {
  const [tab, setTab] = useState<"general" | "finanzas" | "mantenimiento" | "accesos" | "paquetes" | "guardias">("general");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let result: any;
      switch (tab) {
        case "general":    result = await api.reportes.dashboard(EDIFICIO_ID); break;
        case "finanzas":   result = await api.reportes.finanzas(EDIFICIO_ID, 6); break;
        case "mantenimiento": result = await api.reportes.mantenimiento(EDIFICIO_ID); break;
        case "accesos":    result = await api.reportes.accesos(EDIFICIO_ID, 7); break;
        case "paquetes":   result = await api.reportes.paquetes(EDIFICIO_ID); break;
        case "guardias":   result = await api.reportes.guardias(EDIFICIO_ID); break;
      }
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: "general", label: "📊 General" },
    { key: "finanzas", label: "💰 Finanzas" },
    { key: "mantenimiento", label: "🔧 Mantenimiento" },
    { key: "accesos", label: "🔐 Accesos" },
    { key: "paquetes", label: "📦 Paquetes" },
    { key: "guardias", label: "👮 Guardias" },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Cargando reporte...</div>
      )}

      {!loading && data && (
        <>
          {/* General */}
          {tab === "general" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Unidades" value={data.total_unidades ?? 0} color="bg-blue-50 text-blue-700" />
                <StatCard label="Morosos" value={data.morosos ?? 0} color="bg-red-50 text-red-700" />
                <StatCard label="Solicitudes abiertas" value={data.solicitudes_pendientes ?? 0} color="bg-amber-50 text-amber-700" />
                <StatCard label="Ingresos hoy" value={data.ingresos_hoy ?? 0} color="bg-purple-50 text-purple-700" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Recaudo del mes" value={formatCOP(data.recaudo_mes ?? 0)} sub={`Meta: ${formatCOP(data.meta_recaudo ?? 0)}`} color="bg-green-50 text-green-700" />
                <StatCard label="Paquetes pendientes" value={data.paquetes_pendientes ?? 0} color="bg-orange-50 text-orange-700" />
                <StatCard label="Alertas próximas" value={data.alertas_proximas ?? 0} sub="Próximos 7 días" color="bg-yellow-50 text-yellow-700" />
              </div>
            </div>
          )}

          {/* Finanzas */}
          {tab === "finanzas" && Array.isArray(data) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Resumen financiero — últimos 6 meses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Mes", "Total cuotas", "Pagadas", "Vencidas", "Recaudado", "Total meta", "% Recaudo"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((row: any) => {
                      const pct = row.total > 0 ? Math.round((row.recaudado / row.total) * 100) : 0;
                      return (
                        <tr key={row.mes} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{row.mes}</td>
                          <td className="px-4 py-3">{row.total_cuotas}</td>
                          <td className="px-4 py-3 text-green-600 font-medium">{row.pagadas}</td>
                          <td className="px-4 py-3 text-red-600 font-medium">{row.vencidas}</td>
                          <td className="px-4 py-3 font-medium">{formatCOP(row.recaudado)}</td>
                          <td className="px-4 py-3 text-gray-500">{formatCOP(row.total)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-medium">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mantenimiento */}
          {tab === "mantenimiento" && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Por categoría</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Categoría", "Total", "Pendientes", "En proceso", "Resueltos", "Prom. horas"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(data.por_categoria ?? []).map((row: any) => (
                        <tr key={row.categoria} className="hover:bg-gray-50">
                          <td className="px-4 py-2 capitalize font-medium">{row.categoria}</td>
                          <td className="px-4 py-2">{row.total}</td>
                          <td className="px-4 py-2 text-amber-600">{row.pendientes}</td>
                          <td className="px-4 py-2 text-blue-600">{row.en_proceso}</td>
                          <td className="px-4 py-2 text-green-600">{row.resueltos}</td>
                          <td className="px-4 py-2 text-gray-500">{Number(row.promedio_horas_resolucion).toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Por prioridad</h2>
                </div>
                <div className="p-5 space-y-3">
                  {(data.por_prioridad ?? []).map((row: any) => (
                    <div key={row.prioridad} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${row.prioridad === "alta" ? "bg-red-500" : row.prioridad === "media" ? "bg-yellow-500" : "bg-green-500"}`} />
                      <span className="capitalize font-medium text-gray-700 w-16">{row.prioridad}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${row.prioridad === "alta" ? "bg-red-500" : row.prioridad === "media" ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(100, (row.abiertos / row.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm text-gray-500">{row.abiertos}/{row.total} abiertos</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Accesos */}
          {tab === "accesos" && Array.isArray(data) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Accesos — últimos 7 días</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Fecha", "Total", "Visitas", "Domicilios", "Servicios", "No autorizados"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((row: any) => (
                      <tr key={row.fecha} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.fecha}</td>
                        <td className="px-4 py-3">{row.total}</td>
                        <td className="px-4 py-3">{row.visitas}</td>
                        <td className="px-4 py-3">{row.domicilios}</td>
                        <td className="px-4 py-3">{row.servicios}</td>
                        <td className="px-4 py-3">
                          {row.no_autorizados > 0 ? (
                            <span className="text-red-600 font-semibold">{row.no_autorizados}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paquetes */}
          {tab === "paquetes" && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Recibidos" value={data.resumen?.recibidos ?? 0} color="bg-blue-50 text-blue-700" />
                  <StatCard label="Notificados" value={data.resumen?.notificados ?? 0} color="bg-yellow-50 text-yellow-700" />
                  <StatCard label="Entregados" value={data.resumen?.entregados ?? 0} color="bg-green-50 text-green-700" />
                  <StatCard label="Prom. entrega" value={`${Number(data.resumen?.promedio_horas_entrega ?? 0).toFixed(1)}h`} color="bg-purple-50 text-purple-700" />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Top empresas mensajería</h2>
                </div>
                <div className="p-5 space-y-3">
                  {(data.por_empresa ?? []).map((row: any) => (
                    <div key={row.empresa_mensajeria} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{row.empresa_mensajeria}</span>
                      <span className="text-sm font-semibold text-primary">{row.total} paquetes</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Guardias */}
          {tab === "guardias" && Array.isArray(data) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Desempeño de guardias</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Guardia", "Total turnos", "Completados", "Ausencias", "Novedades"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((row: any) => (
                      <tr key={row.guardia_nombre} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.guardia_nombre}</td>
                        <td className="px-4 py-3">{row.total_turnos}</td>
                        <td className="px-4 py-3 text-green-600">{row.completados}</td>
                        <td className="px-4 py-3 text-red-600">{row.ausencias}</td>
                        <td className="px-4 py-3">{row.total_eventos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <p>No hay datos disponibles. Conecta la API para ver reportes en tiempo real.</p>
        </div>
      )}
    </div>
  );
}
