"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { api, proveedoresApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Bitacora from "@/components/Bitacora";
import FileUploadGenerico from "@/components/FileUploadGenerico";

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
const NEEDS_NEXT_DATE = ["trimestral", "anual"];

export default function MantenimientoPage() {
  const user = getUser();
  const conjuntoId = user?.conjunto_id ?? 1;

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"solicitudes" | "alertas" | "inventario">("solicitudes");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [filtroProgramado, setFiltroProgramado] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAlertaForm, setShowAlertaForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showInventarioForm, setShowInventarioForm] = useState(false);
  const [editInventario, setEditInventario] = useState<any | null>(null);
  const [esProgramado, setEsProgramado] = useState(false);
  const [editEsProgramado, setEditEsProgramado] = useState(false);
  const [periodicidad, setPeriodicidad] = useState("mensual");
  const [editPeriodicidad, setEditPeriodicidad] = useState("mensual");
  const [formProveedorId, setFormProveedorId] = useState<number | null>(null);
  const [editProveedorId, setEditProveedorId] = useState<number | null>(null);
  const [formContratos, setFormContratos] = useState<any[]>([]);
  const [editContratos, setEditContratos] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Change 3: date range filter state
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  // Change 1: date conflict alert state
  const [showConflictoAlert, setShowConflictoAlert] = useState(false);
  // Change 2: bitácora state
  const [bitacora, setBitacora] = useState<any[]>([]);
  const [loadingBitacora, setLoadingBitacora] = useState(false);
  // Change 4: crear hijos state
  const [creando, setCreando] = useState(false);
  const [creandoHijos, setCreandoHijos] = useState(false);
  const [hijosCreados, setHijosCreados] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params: any = { conjunto_id: conjuntoId };
    if (filtroEstado) params.estado = filtroEstado;
    if (filtroPrioridad) params.prioridad = filtroPrioridad;
    if (filtroProgramado !== null) params.es_programado = filtroProgramado;
    // Change 3: pass date range params
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const [s, a, inv] = await Promise.allSettled([
      api.mantenimientos.list(params),
      api.mantenimientos.alertas.list(conjuntoId),
      api.mantenimientos.inventario.list(conjuntoId),
    ]);
    if (s.status === "fulfilled") setSolicitudes(s.value);
    if (a.status === "fulfilled") setAlertas(a.value);
    if (inv.status === "fulfilled") setInventario(inv.value);
    setLoading(false);
  }, [conjuntoId, filtroEstado, filtroPrioridad, filtroProgramado, fechaDesde, fechaHasta]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    proveedoresApi.list()
      .then((p: any) => setProveedores(Array.isArray(p) ? p : (p?.proveedores ?? [])))
      .catch(() => {});
  }, []);

  // Load contracts when proveedor changes in create form
  useEffect(() => {
    if (!formProveedorId) { setFormContratos([]); return; }
    proveedoresApi.contratos.list(formProveedorId)
      .then((c: any) => setFormContratos(Array.isArray(c) ? c.filter((x: any) => x.activo) : []))
      .catch(() => setFormContratos([]));
  }, [formProveedorId]);

  // Load contracts when proveedor changes in edit form
  useEffect(() => {
    if (!editProveedorId) { setEditContratos([]); return; }
    proveedoresApi.contratos.list(editProveedorId)
      .then((c: any) => setEditContratos(Array.isArray(c) ? c.filter((x: any) => x.activo) : []))
      .catch(() => setEditContratos([]));
  }, [editProveedorId]);

  // Change 2: load bitácora when selected changes
  useEffect(() => {
    if (!selected) { setBitacora([]); return; }
    setLoadingBitacora(true);
    const API = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API}/api/mantenimientos/${selected.id}/bitacora`)
      .then((r) => r.json())
      .then((d) => setBitacora(Array.isArray(d) ? d : []))
      .catch(() => setBitacora([]))
      .finally(() => setLoadingBitacora(false));
  }, [selected?.id]);

  const handleUpdateEstado = async (id: number, estado: string) => {
    await api.mantenimientos.update(id, { estado });
    load();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, estado }));
  };

  const handleClonar = async () => {
    if (!selected) return;
    if (!confirm(`¿Clonar esta solicitud? Se creará una copia en estado pendiente.`)) return;
    const clonada = await api.mantenimientos.clonar(selected.id);
    await load();
    setSelected(clonada);
  };

  const handleCrear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creando) return;
    setCreando(true);
    try {
      const fd = new FormData(e.currentTarget);
      const body: any = {
        conjunto_id: conjuntoId,
        titulo: fd.get("titulo"),
        descripcion: fd.get("descripcion"),
        categoria: fd.get("categoria"),
        prioridad: fd.get("prioridad"),
        es_programado: esProgramado,
      };
      if (esProgramado) {
        body.periodicidad = periodicidad;
        if (NEEDS_NEXT_DATE.includes(periodicidad)) {
          const fp = fd.get("fecha_proxima_ejecucion");
          if (fp) body.fecha_proxima_ejecucion = fp;
        }
      }
      const inventarioId = fd.get("inventario_id");
      if (inventarioId) body.inventario_id = parseInt(inventarioId as string);
      const proveedor = fd.get("proveedor_id");
      if (proveedor) body.proveedor_id = parseInt(proveedor as string);
      const contratoId = fd.get("contrato_id");
      if (contratoId) body.contrato_id = parseInt(contratoId as string);
      const vencimiento = fd.get("fecha_vencimiento");
      if (vencimiento) body.fecha_vencimiento = vencimiento;
      const presupuesto = fd.get("presupuesto");
      if (presupuesto) body.presupuesto = parseFloat(presupuesto as string);

      const result = await api.mantenimientos.create(body);
      setShowForm(false);
      setEsProgramado(false);
      setPeriodicidad("mensual");
      setFormProveedorId(null);
      (e.target as HTMLFormElement).reset();
      load();
      if (result?.warning === "fecha_conflicto") setShowConflictoAlert(true);
    } finally {
      setCreando(false);
    }
  };

  const handleCrearAlerta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.mantenimientos.alertas.create({
      conjunto_id: conjuntoId,
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
    setEditPeriodicidad(selected?.periodicidad ?? "mensual");
    setEditProveedorId(selected?.proveedor_id ?? null);
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
      periodicidad: editEsProgramado ? editPeriodicidad : null,
    };
    if (editEsProgramado && NEEDS_NEXT_DATE.includes(editPeriodicidad)) {
      body.fecha_proxima_ejecucion = fd.get("fecha_proxima_ejecucion") || null;
    } else {
      body.fecha_proxima_ejecucion = null;
    }
    const inventarioId = fd.get("inventario_id");
    body.inventario_id = inventarioId ? parseInt(inventarioId as string) : null;
    const proveedor = fd.get("proveedor_id");
    body.proveedor_id = proveedor ? parseInt(proveedor as string) : null;
    const contratoId = fd.get("contrato_id");
    body.contrato_id = contratoId ? parseInt(contratoId as string) : null;
    const vencimiento = fd.get("fecha_vencimiento");
    body.fecha_vencimiento = vencimiento || null;
    const presupuesto = fd.get("presupuesto");
    body.presupuesto = presupuesto ? parseFloat(presupuesto as string) : null;

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

  const handleCrearInventario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      conjunto_id: conjuntoId,
      nombre: fd.get("nombre"),
      tipo: fd.get("tipo"),
      descripcion: fd.get("descripcion") || null,
    };
    if (editInventario) {
      await api.mantenimientos.inventario.update(editInventario.id, {
        nombre: body.nombre,
        tipo: body.tipo,
        descripcion: body.descripcion,
      });
    } else {
      await api.mantenimientos.inventario.create(body);
    }
    setShowInventarioForm(false);
    setEditInventario(null);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const canEdit = !["servicios", "propietario", "inquilino"].includes(user?.rol ?? "");

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

  const ContratosSelector = ({ contratos, defaultValue, name }: { contratos: any[]; defaultValue?: number; name: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
      {contratos.length === 0 ? (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          ⚠️ Sin contratos vigentes para este proveedor
        </div>
      ) : (
        <select name={name} defaultValue={defaultValue ?? ""} className={INPUT}>
          <option value="">Sin contrato específico</option>
          {contratos.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.tipo_servicio} — {c.descripcion ?? `Contrato #${c.id}`}
              {c.fecha_fin ? ` (hasta ${new Date(c.fecha_fin).toLocaleDateString("es-CO")})` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        {[
          { label: "Pendientes", value: pendientes, color: "bg-amber-50 text-amber-700" },
          { label: "En proceso", value: enProceso, color: "bg-blue-50 text-blue-700" },
          { label: "Resueltos", value: resueltos, color: "bg-green-50 text-green-700" },
          { label: "Prioridad alta", value: altas, color: "bg-red-50 text-red-700" },
          { label: "Alertas preventivas", value: alertasProximas, color: "bg-purple-50 text-purple-700", tooltip: "Revisiones programadas pendientes (mantenimiento preventivo del conjunto)" },
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
        {(["solicitudes", "alertas", "inventario"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "solicitudes" ? "🔧 Solicitudes" : t === "alertas" ? "🔔 Alertas preventivas" : "📦 Inventario"}
          </button>
        ))}
      </div>

      {tab === "solicitudes" && (
        <>
        <div className="space-y-4">
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

            {/* Change 3: Date range filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Desde" title="Fecha desde" />
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Hasta" title="Fecha hasta" />
              {(fechaDesde || fechaHasta) && (
                <button onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">Limpiar fechas</button>
              )}
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
                            <div className="text-xs text-gray-400">
                              {s.inventario_nombre ? `🏗️ ${s.inventario_nombre}` : (s.unidad_numero ?? "General")}
                            </div>
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

          {/* Detail drawer — fijo a la derecha, tabla conserva ancho completo */}
          {selected && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
              <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto h-full">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
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
                      <>
                        <button onClick={openEdit} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-colors" title="Editar solicitud">
                          ✏️ Editar
                        </button>
                        <button onClick={handleClonar} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-teal-600 hover:text-white transition-colors" title="Clonar solicitud">
                          📋 Clonar
                        </button>
                      </>
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
                  {selected.inventario_nombre && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Elemento a mantener</span>
                      <div className="font-medium">🏗️ {selected.inventario_nombre}
                        <span className="ml-1 text-xs text-gray-400">({selected.inventario_tipo})</span>
                      </div>
                    </div>
                  )}
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
                    <div><span className="text-gray-400">Vencimiento tarea</span><div className="font-medium">{new Date(selected.fecha_vencimiento).toLocaleDateString("es-CO")}</div></div>
                  )}
                  {selected.fecha_proxima_ejecucion && (
                    <div><span className="text-gray-400">Próxima ejecución</span><div className="font-medium text-teal-700">📅 {new Date(selected.fecha_proxima_ejecucion).toLocaleDateString("es-CO")}</div></div>
                  )}
                  {selected.torre_nombre && (
                    <div><span className="text-gray-400">Torre</span><div className="font-medium">{selected.torre_nombre}</div></div>
                  )}
                </div>

                {selected.contrato_descripcion && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    📄 Contrato: {selected.contrato_descripcion}
                    {selected.contrato_archivo_url && (
                      <a href={selected.contrato_archivo_url} target="_blank" rel="noreferrer" className="hover:underline ml-1">(ver)</a>
                    )}
                  </div>
                )}
                {!selected.contrato_descripcion && selected.contrato_url && (
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

                {/* Change 5: FileUploadGenerico replaces foto/factura buttons */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Archivos adjuntos</p>
                  <FileUploadGenerico
                    endpoint={`/api/mantenimientos/${selected.id}/archivos`}
                    archivos={(selected.archivos ?? []).map((a: any) => ({ id: a.id, url: a.url, nombre_archivo: a.nombre }))}
                    onUploaded={async () => {
                      const updated = await api.mantenimientos.get(selected.id);
                      setSelected(updated);
                    }}
                    label="Subir archivo"
                    multiple
                    disabled={!canEdit}
                  />
                </div>

                {/* Change 4: Crear hijos para programados */}
                {selected.es_programado && canEdit && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 font-medium">Registros recurrentes</p>
                      <button
                        onClick={async () => {
                          setCreandoHijos(true);
                          try {
                            const API = process.env.NEXT_PUBLIC_API_URL || "";
                            const res = await fetch(`${API}/api/mantenimientos/${selected.id}/crear-hijos`, { method: "POST" });
                            const data = await res.json();
                            setHijosCreados(data?.creados ?? 0);
                            load();
                          } finally { setCreandoHijos(false); }
                        }}
                        disabled={creandoHijos}
                        className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                      >
                        {creandoHijos ? "Generando…" : "📅 Generar registros"}
                      </button>
                    </div>
                    {hijosCreados !== null && (
                      <p className="text-xs text-teal-600 mt-1">{hijosCreados} registro(s) generado(s)</p>
                    )}
                  </div>
                )}

                {/* Change 2: Bitácora */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-2 font-medium">Historial</p>
                  <Bitacora eventos={bitacora} loading={loadingBitacora} />
                </div>
              </div>
            </div>
            </div>
          </div>
          )}
        </>
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

      {/* Inventario */}
      {tab === "inventario" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Catálogo de zonas y componentes del conjunto para asociar a mantenimientos.</p>
            {canEdit && (
              <button onClick={() => { setEditInventario(null); setShowInventarioForm(true); }}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                + Agregar elemento
              </button>
            )}
          </div>

          {inventario.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📦</div>
              <p>No hay elementos en el inventario</p>
              {canEdit && <p className="text-xs mt-1">Agrega zonas y componentes del conjunto</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventario.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.tipo === "zona" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>{item.tipo}</span>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditInventario(item); setShowInventarioForm(true); }}
                          className="text-xs text-gray-400 hover:text-primary px-1.5 py-0.5 rounded hover:bg-gray-100">
                          ✏️
                        </button>
                        <button onClick={() => api.mantenimientos.inventario.update(item.id, { activo: false }).then(load)}
                          className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-gray-100"
                          title="Desactivar">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.nombre}</h3>
                  {item.descripcion && <p className="text-xs text-gray-500 mt-1">{item.descripcion}</p>}
                </div>
              ))}
            </div>
          )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elemento a mantener</label>
                <select name="inventario_id" className={INPUT}>
                  <option value="">Sin elemento específico</option>
                  {inventario.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.tipo})</option>
                  ))}
                </select>
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
                    <select name="periodicidad" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)} className={INPUT}>
                      {PERIODICIDADES.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  {NEEDS_NEXT_DATE.includes(periodicidad) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha próxima ejecución</label>
                      <input name="fecha_proxima_ejecucion" type="date" className={INPUT} />
                      <p className="text-xs text-teal-600 mt-1">Se crearán alertas automáticas 30 y 15 días antes</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select name="proveedor_id" className={INPUT}
                    onChange={(e) => setFormProveedorId(e.target.value ? parseInt(e.target.value) : null)}>
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

              {formProveedorId && (
                <ContratosSelector contratos={formContratos} name="contrato_id" />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento (tarea)</label>
                <input name="fecha_vencimiento" type="date" className={INPUT} />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEsProgramado(false); setFormProveedorId(null); setPeriodicidad("mensual"); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={creando} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {creando ? "Creando…" : "Crear"}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elemento a mantener</label>
                <select name="inventario_id" defaultValue={selected.inventario_id ?? ""} className={INPUT}>
                  <option value="">Sin elemento específico</option>
                  {inventario.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.tipo})</option>
                  ))}
                </select>
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
                    <select name="periodicidad" value={editPeriodicidad}
                      onChange={(e) => setEditPeriodicidad(e.target.value)} className={INPUT}>
                      {PERIODICIDADES.map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  {NEEDS_NEXT_DATE.includes(editPeriodicidad) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha próxima ejecución</label>
                      <input name="fecha_proxima_ejecucion" type="date"
                        defaultValue={selected.fecha_proxima_ejecucion ? selected.fecha_proxima_ejecucion.slice(0, 10) : ""}
                        className={INPUT} />
                      <p className="text-xs text-teal-600 mt-1">Se crearán alertas automáticas 30 y 15 días antes</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select name="proveedor_id" defaultValue={selected.proveedor_id ?? ""}
                    onChange={(e) => setEditProveedorId(e.target.value ? parseInt(e.target.value) : null)}
                    className={INPUT}>
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

              {editProveedorId && (
                <ContratosSelector contratos={editContratos} defaultValue={selected.contrato_id} name="contrato_id" />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento (tarea)</label>
                <input name="fecha_vencimiento" type="date"
                  defaultValue={selected.fecha_vencimiento ? selected.fecha_vencimiento.slice(0, 10) : ""} className={INPUT} />
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

      {/* Change 1: Conflict alert modal */}
      {showConflictoAlert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-semibold text-gray-900">Conflicto de fechas</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              La fecha de vencimiento es anterior a la próxima ejecución programada. El registro fue guardado, pero revisa las fechas para evitar conflictos.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setShowConflictoAlert(false)}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventario modal */}
      {showInventarioForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {editInventario ? "Editar elemento" : "Agregar elemento al inventario"}
            </h3>
            <form onSubmit={handleCrearInventario} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input name="nombre" required defaultValue={editInventario?.nombre ?? ""} placeholder="Ej: Ascensor 1 Torre 1" className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select name="tipo" defaultValue={editInventario?.tipo ?? "zona"} className={INPUT}>
                  <option value="zona">Zona</option>
                  <option value="componente">Componente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={2} defaultValue={editInventario?.descripcion ?? ""} className={INPUT} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowInventarioForm(false); setEditInventario(null); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                  {editInventario ? "Guardar" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
