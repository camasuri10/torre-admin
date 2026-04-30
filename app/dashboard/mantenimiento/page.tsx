"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;

const ESTADO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  en_proceso: "bg-blue-100 text-blue-700",
  resuelto: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};

const PRIORIDAD_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-orange-100 text-orange-700",
  baja: "bg-gray-100 text-gray-600",
};

const CAT_ICON: Record<string, string> = {
  plomeria: "🚿",
  electricidad: "⚡",
  estructura: "🏗️",
  ascensor: "🛗",
  zonas_comunes: "🌳",
  otro: "🔧",
};

export default function MantenimientoPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"solicitudes" | "alertas">("solicitudes");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAlertaForm, setShowAlertaForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { edificio_id: EDIFICIO_ID };
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroPrioridad) params.prioridad = filtroPrioridad;
      const [s, a] = await Promise.all([
        api.mantenimientos.list(params),
        api.mantenimientos.alertas.list(EDIFICIO_ID),
      ]);
      setSolicitudes(s);
      setAlertas(a);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroPrioridad]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateEstado = async (id: number, estado: string) => {
    await api.mantenimientos.update(id, { estado });
    load();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, estado }));
  };

  const handleCrear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.mantenimientos.create({
      edificio_id: EDIFICIO_ID,
      titulo: fd.get("titulo"),
      descripcion: fd.get("descripcion"),
      categoria: fd.get("categoria"),
      prioridad: fd.get("prioridad"),
    });
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleCrearAlerta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.mantenimientos.alertas.create({
      edificio_id: EDIFICIO_ID,
      titulo: fd.get("titulo"),
      descripcion: fd.get("descripcion"),
      tipo: fd.get("tipo"),
      fecha_programada: fd.get("fecha_programada"),
    });
    setShowAlertaForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleUploadArchivo = async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
    if (!selected || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("nombre_archivo", file.name);
    fd.append("file", file);
    await api.mantenimientos.uploadArchivo(selected.id, fd);
    // Reload selected
    const updated = await api.mantenimientos.get(selected.id);
    setSelected(updated);
    load();
  };

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;
  const enProceso = solicitudes.filter((s) => s.estado === "en_proceso").length;
  const resueltos = solicitudes.filter((s) => s.estado === "resuelto").length;
  const altas = solicitudes.filter((s) => s.prioridad === "alta").length;
  const alertasProximas = alertas.filter((a) => a.estado === "pendiente").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Pendientes", value: pendientes, color: "bg-amber-50 text-amber-700" },
          { label: "En proceso", value: enProceso, color: "bg-blue-50 text-blue-700" },
          { label: "Resueltos", value: resueltos, color: "bg-green-50 text-green-700" },
          { label: "Prioridad alta", value: altas, color: "bg-red-50 text-red-700" },
          { label: "Alertas activas", value: alertasProximas, color: "bg-purple-50 text-purple-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 border border-current/10 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["solicitudes", "alertas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "solicitudes" ? "🔧 Solicitudes" : "🔔 Alertas preventivas"}
          </button>
        ))}
      </div>

      {tab === "solicitudes" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* List */}
          <div className="xl:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {["", "pendiente", "en_proceso", "resuelto"].map((e) => (
                  <button key={e} onClick={() => setFiltroEstado(e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filtroEstado === e ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {e === "" ? "Todos" : e.replace("_", " ")}
                  </button>
                ))}
                {["", "alta", "media", "baja"].map((p) => (
                  <button key={p} onClick={() => setFiltroPrioridad(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filtroPrioridad === p
                        ? p === "alta" ? "bg-red-500 text-white" : p === "media" ? "bg-orange-500 text-white" : p === "baja" ? "bg-gray-500 text-white" : "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {p === "" ? "Todas prioridades" : p}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowForm(true)}
                className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-dark">
                + Nueva
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["#", "Solicitud", "Cat.", "Prioridad", "Estado", "Fecha"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
                    ) : solicitudes.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay solicitudes</td></tr>
                    ) : solicitudes.map((s) => (
                      <tr key={s.id}
                        onClick={() => setSelected(s)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === s.id ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">#{s.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 max-w-[180px] truncate">{s.titulo}</div>
                          <div className="text-xs text-gray-400">{s.unidad_numero ?? "General"}</div>
                        </td>
                        <td className="px-4 py-3 text-lg">{CAT_ICON[s.categoria] ?? "🔧"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_BADGE[s.prioridad]}`}>
                            {s.prioridad}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[s.estado]}`}>
                            {s.estado.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(s.fecha_solicitud).toLocaleDateString("es-CO")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug">{selected.titulo}</h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-600">{selected.descripcion}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-400">Categoría</span><div className="font-medium capitalize">{selected.categoria}</div></div>
                  <div><span className="text-gray-400">Prioridad</span><div className="font-medium capitalize">{selected.prioridad}</div></div>
                  <div><span className="text-gray-400">Solicitante</span><div className="font-medium">{selected.solicitante_nombre ?? "—"}</div></div>
                  <div><span className="text-gray-400">Unidad</span><div className="font-medium">{selected.unidad_numero ?? "General"}</div></div>
                  {selected.costo && <div><span className="text-gray-400">Costo</span><div className="font-medium">${Number(selected.costo).toLocaleString("es-CO")}</div></div>}
                </div>

                {/* Estado actions */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Cambiar estado</p>
                  <div className="flex flex-wrap gap-2">
                    {["pendiente", "en_proceso", "resuelto", "cancelado"].map((e) => (
                      <button key={e} onClick={() => handleUpdateEstado(selected.id, e)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          selected.estado === e ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {e.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Archivos */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Archivos adjuntos</p>
                  {(selected.archivos ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">Sin archivos</p>
                  ) : (
                    <div className="space-y-1">
                      {(selected.archivos ?? []).map((a: any) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          {a.tipo === "foto" ? "📷" : "📄"} {a.nombre}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <label className="cursor-pointer px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                      📷 Subir foto
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadArchivo(e, "foto")} />
                    </label>
                    <label className="cursor-pointer px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                      📄 Subir factura
                      <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={(e) => handleUploadArchivo(e, "factura")} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center p-8 text-center text-gray-400">
              <div>
                <div className="text-3xl mb-2">🔧</div>
                <p className="text-sm">Selecciona una solicitud para ver el detalle</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {tab === "alertas" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAlertaForm(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark">
              + Nueva alerta
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertas.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🔔</div>
                <p>No hay alertas de mantenimiento programadas</p>
              </div>
            ) : alertas.map((a) => (
              <div key={a.id} className={`bg-white rounded-xl border shadow-sm p-5 ${
                a.estado === "pendiente" ? "border-amber-200" : "border-gray-100"
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.tipo === "preventivo" ? "bg-blue-100 text-blue-700" :
                    a.tipo === "correctivo" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                  }`}>{a.tipo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.estado === "pendiente" ? "bg-amber-100 text-amber-700" :
                    a.estado === "completado" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>{a.estado}</span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{a.titulo}</h3>
                {a.descripcion && <p className="text-xs text-gray-500 mb-3">{a.descripcion}</p>}
                <div className="text-xs text-gray-400">📅 {a.fecha_programada}</div>
                {a.estado === "pendiente" && (
                  <button onClick={() => api.mantenimientos.alertas.update(a.id, "completado").then(load)}
                    className="mt-3 w-full text-xs bg-green-100 text-green-700 py-1.5 rounded-lg hover:bg-green-200 font-medium">
                    Marcar completada
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nueva solicitud modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Nueva solicitud de mantenimiento</h3>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input name="titulo" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select name="categoria" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {Object.keys(CAT_ICON).map((c) => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select name="prioridad" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="alta">Alta</option>
                    <option value="media" selected>Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nueva alerta modal */}
      {showAlertaForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Programar alerta de mantenimiento</h3>
            <form onSubmit={handleCrearAlerta} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input name="titulo" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select name="tipo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="inspeccion">Inspección</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
                  <input name="fecha_programada" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAlertaForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">Programar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
