"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { api, proveedoresApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

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
  piscina: "🏊",
  otro: "🔧",
};

const PERIODICIDADES = ["diario", "semanal", "mensual", "trimestral", "anual"];

export default function MantenimientoPage() {
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"solicitudes" | "alertas">("solicitudes");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [filtroProgramado, setFiltroProgramado] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAlertaForm, setShowAlertaForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [esProgramado, setEsProgramado] = useState(false);
  const [editEsProgramado, setEditEsProgramado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params: any = { edificio_id: edificioId };
    if (filtroEstado) params.estado = filtroEstado;
    if (filtroPrioridad) params.prioridad = filtroPrioridad;
    if (filtroProgramado !== null) params.es_programado = filtroProgramado;
    const [s, a] = await Promise.allSettled([
      api.mantenimientos.list(params),
      api.mantenimientos.alertas.list(edificioId),
    ]);
    if (s.status === "fulfilled") setSolicitudes(s.value);
    if (a.status === "fulfilled") setAlertas(a.value);
    setLoading(false);
  }, [edificioId, filtroEstado, filtroPrioridad, filtroProgramado]);

  useEffect(() => { load(); }, [load]);

  // Proveedores se carga por separado para no bloquear la lista principal
  useEffect(() => {
    proveedoresApi.list(edificioId ? { edificio_id: edificioId } : undefined)
      .then((p: any) => setProveedores(Array.isArray(p) ? p : (p?.proveedores ?? [])))
      .catch(() => {});
  }, [edificioId]);

  const handleUpdateEstado = async (id: number, estado: string) => {
    await api.mantenimientos.update(id, { estado });
    load();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, estado }));
  };

  const handleCrear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      edificio_id: edificioId,
      titulo: fd.get("titulo"),
      descripcion: fd.get("descripcion"),
      categoria: fd.get("categoria"),
      prioridad: fd.get("prioridad"),
      es_programado: esProgramado,
    };
    if (esProgramado) body.periodicidad = fd.get("periodicidad");
    const proveedor = fd.get("proveedor_id");
    if (proveedor) body.proveedor_id = parseInt(proveedor as string);
    const vencimiento = fd.get("fecha_vencimiento");
    if (vencimiento) body.fecha_vencimiento = vencimiento;
    const presupuesto = fd.get("presupuesto");
    if (presupuesto) body.presupuesto = parseFloat(presupuesto as string);
    const contrato = fd.get("contrato_url");
    if (contrato) body.contrato_url = contrato;

    await api.mantenimientos.create(body);
    setShowForm(false);
    setEsProgramado(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleCrearAlerta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.mantenimientos.alertas.create({
      edificio_id: edificioId,
      titulo: fd.get("titulo"),
      descripcion: fd.get("descripcion"),
      tipo: fd.get("tipo"),
      fecha_programada: fd.get("fecha_programada"),
    });
    setShowAlertaForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const openEdit = () => {
    setEditEsProgramado(selected?.es_programado ?? false);
    setShowEditForm(true);
  };

  const handleEditar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      titulo:      fd.get("titulo"),
      descripcion: fd.get("descripcion") || null,
      categoria:   fd.get("categoria"),
      prioridad:   fd.get("prioridad"),
      es_programado: editEsProgramado,
      periodicidad: editEsProgramado ? fd.get("periodicidad") : null,
    };
    const proveedor = fd.get("proveedor_id");
    if (proveedor) body.proveedor_id = parseInt(proveedor as string);
    else body.proveedor_id = null;
    const vencimiento = fd.get("fecha_vencimiento");
    body.fecha_vencimiento = vencimiento || null;
    const presupuesto = fd.get("presupuesto");
    body.presupuesto = presupuesto ? parseFloat(presupuesto as string) : null;
    const contrato = fd.get("contrato_url");
    body.contrato_url = contrato || null;

    await api.mantenimientos.update(selected!.id, body);
    setShowEditForm(false);
    const updated = await api.mantenimientos.get(selected!.id);
    setSelected(updated);
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
    const updated = await api.mantenimientos.get(selected.id);
    setSelected(updated);
    load();
  };

  const canEdit = !["servicios", "propietario", "inquilino"].includes(user?.rol ?? "");

  // Aplicar búsqueda aquí para que las stats siempre coincidan con la tabla
  const sq = search.trim().toLowerCase();
  const solicitudesFiltradas = sq
    ? solicitudes.filter((s) =>
        (s.titulo ?? "").toLowerCase().includes(sq) ||
        (s.descripcion ?? "").toLowerCase().includes(sq)
      )
    : solicitudes;

  const pendientes = solicitudesFiltradas.filter((s) => s.estado === "pendiente").length;
  const enProceso = solicitudesFiltradas.filter((s) => s.estado === "en_proceso").length;
  const resueltos = solicitudesFiltradas.filter((s) => s.estado === "resuelto").length;
  const altas = solicitudesFiltradas.filter((s) => s.prioridad === "alta").length;
  const alertasProximas = alertas.filter((a) => a.estado === "pendiente").length;
  const programados = solicitudesFiltradas.filter((s) => s.es_programado).length;

  const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        {[
          { label: "Pendientes", value: pendientes, color: "bg-amber-50 text-amber-700" },
          { label: "En proceso", value: enProceso, color: "bg-blue-50 text-blue-700" },
          { label: "Resueltos", value: resueltos, color: "bg-green-50 text-green-700" },
          { label: "Prioridad alta", value: altas, color: "bg-red-50 text-red-700" },
          { label: "Alertas preventivas", value: alertasProximas, color: "bg-purple-50 text-purple-700", tooltip: "Revisiones programadas pendientes (mantenimiento preventivo del edificio)" },
          { label: "Programados", value: programados, color: "bg-teal-50 text-teal-700" },
        ].map((s: any) => (
          <div key={s.label} className={`rounded-xl p-4 border border-current/10 ${s.color} relative group`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm flex items-center gap-1">
              {s.label}
              {s.tooltip && (
                <span className="cursor-help text-xs opacity-60" title={s.tooltip}>ⓘ</span>
              )}
            </div>
            {s.tooltip && (
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {s.tooltip}
              </div>
            )}
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
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar solicitud…"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

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
                <button
                  onClick={() => setFiltroProgramado(filtroProgramado === true ? null : true)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filtroProgramado === true ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  📅 Programados
                </button>
              </div>
              {canEdit && (
                <button onClick={() => setShowForm(true)}
                  className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90">
                  + Nueva
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["#", "Solicitud", "Cat.", "Prioridad", "Estado", "Vencimiento"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
                    ) : (() => {
                      const filtered = solicitudesFiltradas;
                      if (filtered.length === 0) return (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{sq ? "Sin resultados." : "No hay solicitudes"}</td></tr>
                      );
                      return filtered.map((s) => (
                        <tr key={s.id}
                          onClick={() => setSelected(s)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === s.id ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">#{s.id}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 max-w-[180px] truncate flex items-center gap-1.5">
                              {s.titulo}
                              {s.es_programado && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 flex-shrink-0">
                                  📅 Prog.
                                </span>
                              )}
                            </div>
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
                            {s.fecha_vencimiento
                              ? new Date(s.fecha_vencimiento).toLocaleDateString("es-CO")
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ));
                    })()}
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
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{selected.titulo}</h3>
                    {selected.es_programado && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-700 mt-1">
                        📅 Programado {selected.periodicidad ? `· ${selected.periodicidad}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canEdit && (
                      <button onClick={openEdit} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-colors" title="Editar solicitud">
                        ✏️ Editar
                      </button>
                    )}
                    <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-600">{selected.descripcion}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-400">Categoría</span><div className="font-medium capitalize">{selected.categoria}</div></div>
                  <div><span className="text-gray-400">Prioridad</span><div className="font-medium capitalize">{selected.prioridad}</div></div>
                  <div><span className="text-gray-400">Solicitante</span><div className="font-medium">{selected.solicitante_nombre ?? "—"}</div></div>
                  <div><span className="text-gray-400">Unidad</span><div className="font-medium">{selected.unidad_numero ?? "General"}</div></div>
                  {selected.proveedor_nombre && (
                    <div className="col-span-2"><span className="text-gray-400">Proveedor</span><div className="font-medium">{selected.proveedor_nombre}</div></div>
                  )}
                  {selected.presupuesto && (
                    <div><span className="text-gray-400">Presupuesto</span><div className="font-medium">${Number(selected.presupuesto).toLocaleString("es-CO")}</div></div>
                  )}
                  {selected.costo && (
                    <div><span className="text-gray-400">Costo real</span><div className="font-medium">${Number(selected.costo).toLocaleString("es-CO")}</div></div>
                  )}
                  {selected.fecha_vencimiento && (
                    <div><span className="text-gray-400">Vencimiento</span><div className="font-medium">{new Date(selected.fecha_vencimiento).toLocaleDateString("es-CO")}</div></div>
                  )}
                  {selected.torre_nombre && (
                    <div><span className="text-gray-400">Torre</span><div className="font-medium">{selected.torre_nombre}</div></div>
                  )}
                </div>

                {selected.contrato_url && (
                  <a href={selected.contrato_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    📄 Ver contrato
                  </a>
                )}

                {/* Estado actions */}
                {canEdit && (
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
                )}

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
                  {canEdit && (
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
                  )}
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
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Nueva solicitud de mantenimiento</h3>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input name="titulo" required className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={3} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select name="categoria" className={INPUT}>
                    {Object.keys(CAT_ICON).map((c) => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
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

              {/* Toggle programado */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-700">¿Es mantenimiento programado?</div>
                  <div className="text-xs text-gray-400">Mantenimientos recurrentes o preventivos</div>
                </div>
                <button type="button"
                  onClick={() => setEsProgramado((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${esProgramado ? "bg-teal-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${esProgramado ? "left-5" : "left-1"}`} />
                </button>
              </div>

              {esProgramado && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
                  <select name="periodicidad" className={INPUT}>
                    {PERIODICIDADES.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select name="proveedor_id" className={INPUT}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto</label>
                  <input name="presupuesto" type="number" step="0.01" min="0" placeholder="0.00" className={INPUT} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
                <input name="fecha_vencimiento" type="date" className={INPUT} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del contrato</label>
                <input name="contrato_url" type="url" placeholder="https://…" className={INPUT} />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEsProgramado(false); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editar solicitud modal */}
      {showEditForm && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Editar solicitud #{selected.id}</h3>
            <form onSubmit={handleEditar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input name="titulo" required defaultValue={selected.titulo} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={3} defaultValue={selected.descripcion ?? ""} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select name="categoria" defaultValue={selected.categoria} className={INPUT}>
                    {Object.keys(CAT_ICON).map((c) => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select name="prioridad" defaultValue={selected.prioridad} className={INPUT}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              {/* Toggle programado */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-700">¿Es mantenimiento programado?</div>
                  <div className="text-xs text-gray-400">Mantenimientos recurrentes o preventivos</div>
                </div>
                <button type="button"
                  onClick={() => setEditEsProgramado((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${editEsProgramado ? "bg-teal-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editEsProgramado ? "left-5" : "left-1"}`} />
                </button>
              </div>

              {editEsProgramado && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
                  <select name="periodicidad" defaultValue={selected.periodicidad ?? "mensual"} className={INPUT}>
                    {PERIODICIDADES.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select name="proveedor_id" defaultValue={selected.proveedor_id ?? ""} className={INPUT}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto</label>
                  <input name="presupuesto" type="number" step="0.01" min="0"
                    defaultValue={selected.presupuesto ?? ""} placeholder="0.00" className={INPUT} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
                <input name="fecha_vencimiento" type="date"
                  defaultValue={selected.fecha_vencimiento ? selected.fecha_vencimiento.slice(0, 10) : ""} className={INPUT} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del contrato</label>
                <input name="contrato_url" type="url" placeholder="https://…"
                  defaultValue={selected.contrato_url ?? ""} className={INPUT} />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowEditForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                  Guardar cambios
                </button>
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
                <input name="titulo" required className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={2} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select name="tipo" className={INPUT}>
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="inspeccion">Inspección</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada</label>
                  <input name="fecha_programada" type="date" required className={INPUT} />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAlertaForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Programar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
