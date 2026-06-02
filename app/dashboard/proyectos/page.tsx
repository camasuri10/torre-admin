"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { proyectosApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

const TIPO_LABEL: Record<string, string> = {
  proyecto_mayor: "Proyecto Mayor",
  proyecto: "Proyecto",
  tarea: "Tarea",
};

const TIPO_COLOR: Record<string, string> = {
  proyecto_mayor: "bg-purple-100 text-purple-700",
  proyecto: "bg-blue-100 text-blue-700",
  tarea: "bg-gray-100 text-gray-600",
};

const ETAPA_LABEL: Record<string, string> = {
  PENDING:     "No iniciado",
  STARTED:     "Inicio",
  QUOTING:     "Cotización",
  APPROVAL:    "Aprobación",
  PLANNING:    "Planificación",
  IN_PROGRESS: "Ejecución",
  MONITORING:  "Control",
  COMPLETED:   "Finalizado",
  CANCELLED:   "Cancelado",
};

const ETAPA_COLOR: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-500",
  STARTED:     "bg-blue-100 text-blue-600",
  QUOTING:     "bg-amber-100 text-amber-700",
  APPROVAL:    "bg-orange-100 text-orange-700",
  PLANNING:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-teal-100 text-teal-700",
  MONITORING:  "bg-cyan-100 text-cyan-700",
  COMPLETED:   "bg-green-100 text-green-700",
  CANCELLED:   "bg-red-100 text-red-500",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-orange-100 text-orange-700",
  baja: "bg-gray-100 text-gray-500",
};

const ETAPAS_ORDEN = ["PENDING","STARTED","QUOTING","APPROVAL","PLANNING","IN_PROGRESS","MONITORING","COMPLETED","CANCELLED"];

export default function ProyectosPage() {
  const user = getUser();
  const router = useRouter();
  const conjuntoId = user?.conjunto_id ?? undefined;
  const isAdmin = user?.rol === "administrador" || user?.rol === "superadmin";
  const isConsejo = user?.rol === "consejo";

  const [proyectos, setProyectos] = useState<any[]>([]);
  const [proximosVencer, setProximosVencer] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formTipo, setFormTipo] = useState("proyecto");

  const load = useCallback(async () => {
    if (!conjuntoId) { setLoading(false); return; }
    setLoading(true);
    const params: any = { conjunto_id: conjuntoId };
    if (filtroEtapa) params.etapa = filtroEtapa;
    if (filtroTipo) params.tipo = filtroTipo;
    const [ps, pv] = await Promise.allSettled([
      proyectosApi.list(params),
      proyectosApi.reporte.proximosVencer(conjuntoId, 7),
    ]);
    if (ps.status === "fulfilled") setProyectos(ps.value);
    if (pv.status === "fulfilled") setProximosVencer(pv.value);
    setLoading(false);
  }, [conjuntoId, filtroEtapa, filtroTipo]);

  useEffect(() => { load(); }, [load]);

  if (!conjuntoId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-4xl mb-4">🏢</p>
        <p className="text-gray-600 font-medium">Selecciona un conjunto específico para ver los proyectos.</p>
        <p className="text-sm text-gray-400 mt-1">Usa el selector de edificio en la barra superior.</p>
      </div>
    );
  }

  const sq = search.trim().toLowerCase();
  const filtrados = sq
    ? proyectos.filter((p) => p.titulo?.toLowerCase().includes(sq) || p.descripcion?.toLowerCase().includes(sq))
    : proyectos;

  const activos     = proyectos.filter((p) => !["COMPLETED","CANCELLED"].includes(p.etapa)).length;
  const completados = proyectos.filter((p) => p.etapa === "COMPLETED").length;
  const enAprobacion = proyectos.filter((p) => p.etapa === "APPROVAL").length;
  const miVotoPendiente = proyectos.filter((p) => p.mi_voto_pendiente > 0).length;

  const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  async function handleCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const body: any = {
        conjunto_id: conjuntoId,
        titulo: fd.get("titulo"),
        tipo: fd.get("tipo"),
        descripcion: fd.get("descripcion") || null,
        prioridad: fd.get("prioridad"),
      };
      const fc = fd.get("fecha_compromiso");
      if (fc) body.fecha_compromiso = fc;
      const nuevo = await proyectosApi.create(body);
      setShowForm(false);
      router.push(`/dashboard/proyectos/${nuevo.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Alerta próximos a vencer */}
      {proximosVencer.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{proximosVencer.length} proyecto(s)</span> con fecha compromiso en los próximos 7 días.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Activos",       value: activos,         color: "bg-blue-50 text-blue-700" },
          { label: "En aprobación", value: enAprobacion,    color: "bg-orange-50 text-orange-700" },
          { label: isConsejo ? "Mi voto pendiente" : "Próximos a vencer", value: isConsejo ? miVotoPendiente : proximosVencer.length, color: "bg-amber-50 text-amber-700" },
          { label: "Completados",   value: completados,     color: "bg-green-50 text-green-700" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl p-4 border border-current/10 ${k.color}`}>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-sm">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros y acciones */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto…"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas las etapas</option>
            {ETAPAS_ORDEN.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los tipos</option>
            <option value="proyecto_mayor">Proyecto Mayor</option>
            <option value="proyecto">Proyecto</option>
            <option value="tarea">Tarea</option>
          </select>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Título","Tipo","Etapa","Prioridad","Zona","Fecha compromiso",""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay proyectos</td></tr>
              ) : filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dashboard/proyectos/${p.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 max-w-[240px]">{p.titulo}</div>
                    {p.mi_voto_pendiente > 0 && (
                      <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 mt-0.5">
                        ⏳ Mi voto pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[p.tipo]}`}>
                      {TIPO_LABEL[p.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLOR[p.etapa]}`}>
                      {ETAPA_LABEL[p.etapa]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORIDAD_COLOR[p.prioridad]}`}>
                      {p.prioridad}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.zona_tipo === "torre" ? `🏗️ ${p.zona_torre_nombre ?? "—"}` :
                     p.zona_tipo === "zona_comun" ? `🌳 ${p.zona_comun_nombre ?? "—"}` :
                     p.zona_texto || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.fecha_compromiso
                      ? new Date(p.fecha_compromiso).toLocaleDateString("es-CO")
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/proyectos/${p.id}`); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nuevo proyecto */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Nuevo proyecto / tarea</h3>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input name="titulo" required className={INPUT} placeholder="Ej: Reparación piscina niños" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select name="tipo" className={INPUT} value={formTipo} onChange={(e) => setFormTipo(e.target.value)}>
                    <option value="proyecto_mayor">Proyecto Mayor</option>
                    <option value="proyecto">Proyecto</option>
                    <option value="tarea">Tarea</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select name="prioridad" defaultValue="media" className={INPUT}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={3} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha compromiso</label>
                <input name="fecha_compromiso" type="date" className={INPUT} />
              </div>
              {formTipo !== "tarea" && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2">
                  Este tipo requiere cotizaciones{formTipo === "proyecto_mayor" ? " (mínimo 3)" : " (mínimo 1)"} y aprobación del Consejo.
                </p>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
