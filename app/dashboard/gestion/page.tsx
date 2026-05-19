"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { api, proveedoresApi } from "@/lib/api";
import FileUploadGenerico from "@/components/FileUploadGenerico";

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pend. Aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  en_ejecucion: "En Ejecución",
  completada: "Completada",
  cancelada: "Cancelada",
};

const ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  pendiente_aprobacion: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-blue-100 text-blue-700",
  rechazada: "bg-red-100 text-red-700",
  en_ejecucion: "bg-purple-100 text-purple-700",
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-200 text-gray-500",
};

const TIPOS_ORDEN = [
  { value: "compra_bienes", label: "Compra de Bienes" },
  { value: "servicio_mantenimiento", label: "Serv. Mantenimiento" },
  { value: "servicio_seguridad", label: "Serv. Seguridad" },
  { value: "servicio_aseo", label: "Serv. Aseo" },
  { value: "obra_civil", label: "Obra Civil" },
  { value: "otro", label: "Otro" },
];

// Change 2: Removed mantenimiento_preventivo / mantenimiento_correctivo
const CLASIFICACIONES = [
  { value: "", label: "Seleccionar tipo…" },
  { value: "proyecto", label: "Proyecto" },
  { value: "actividad", label: "Actividad" },
];

const ESTADO_SIGUIENTE: Record<string, string> = {
  borrador: "Enviar a aprobación",
  pendiente_aprobacion: "Aprobar / Rechazar",
  aprobada: "Iniciar ejecución",
  en_ejecucion: "Completar",
  rechazada: "—",
  completada: "—",
  cancelada: "—",
};

const KANBAN_COLS: { key: string; label: string; color: string }[] = [
  { key: "borrador",             label: "Borrador",       color: "bg-gray-50 border-gray-200" },
  { key: "pendiente_aprobacion", label: "En Aprobación",  color: "bg-yellow-50 border-yellow-200" },
  { key: "aprobada",             label: "Aprobado",       color: "bg-blue-50 border-blue-200" },
  { key: "en_ejecucion",         label: "En Ejecución",   color: "bg-purple-50 border-purple-200" },
  { key: "completada",           label: "Completado",     color: "bg-green-50 border-green-200" },
  { key: "cancelada",            label: "Cancelado",      color: "bg-red-50 border-red-200" },
];

function fmt(v: any) {
  if (v == null || v === "") return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Change 6: Removed "flujos" and "consejo" (consejo moved to its own module)
type Tab = "ordenes" | "cotizaciones" | "asamblea" | "kanban";
type ItemForm = { descripcion: string; cantidad: number; unidad_medida: string; precio_unitario: number };

const mkItem = (): ItemForm => ({ descripcion: "", cantidad: 1, unidad_medida: "und", precio_unitario: 0 });

function Badge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GestionPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [eid, setEid] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ordenes");

  const [stats, setStats] = useState<any>(null);

  // Ordenes tab
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);

  // Orden modal
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [editingOrden, setEditingOrden] = useState<any>(null);
  const [oForm, setOForm] = useState<any>({
    titulo: "", tipo_orden: "compra_bienes", proveedor_id: "",
    descripcion: "", monto_estimado: 0, fecha_necesidad: "",
  });
  const [oItems, setOItems] = useState<ItemForm[]>([mkItem()]);
  const [oClasificacion, setOClasificacion] = useState("");
  const [oEsIndividual, setOEsIndividual] = useState(false);
  const [oRequiereConsejo, setORequiereConsejo] = useState(false);
  const [oProyectoId, setOProyectoId] = useState("");
  const [savingO, setSavingO] = useState(false);

  // Quick tarea creation
  const [showQuickTarea, setShowQuickTarea] = useState(false);
  const [quickTareaTitulo, setQuickTareaTitulo] = useState("");
  const [savingQuickTarea, setSavingQuickTarea] = useState(false);

  // Consejo decision state (for approving/rejecting individual orders)
  const [showConsejoDecisionModal, setShowConsejoDecisionModal] = useState(false);
  const [consejoTarget, setConsejoTarget] = useState<any>(null);
  const [consejoDecisionForm, setConsejoDecisionForm] = useState({ decision: "aprobada", comentario: "" });
  const [savingConsejoDecision, setSavingConsejoDecision] = useState(false);

  // Action modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ accion: string; label: string; needsComment: boolean } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [doingAction, setDoingAction] = useState(false);

  // Cotizaciones tab
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [selSol, setSelSol] = useState<any>(null);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [loadingSols, setLoadingSols] = useState(false);
  const [showSolModal, setShowSolModal] = useState(false);
  const [solForm, setSolForm] = useState<any>({
    titulo: "", tipo: "RFQ", descripcion: "", fecha_limite: "", criterios_evaluacion: "",
  });
  const [savingSol, setSavingSol] = useState(false);
  const [showCotModal, setShowCotModal] = useState(false);
  const [cotForm, setCotForm] = useState<any>({
    proveedor_id: "", numero_cotizacion: "", monto: 0,
    condiciones_pago: "", tiempo_entrega: "", vigencia: "", observaciones: "",
  });
  const [savingCot, setSavingCot] = useState(false);

  // Cotizaciones directas en orden
  const [togglingCots, setTogglingCots] = useState(false);
  const [showCotDirectaForm, setShowCotDirectaForm] = useState(false);
  const [cotDirectaForm, setCotDirectaForm] = useState<any>({ proveedor_id: "", numero_cotizacion: "", monto: 0, condiciones_pago: "", tiempo_entrega: "", vigencia: "", observaciones: "" });
  const [savingCotDirecta, setSavingCotDirecta] = useState(false);

  // Kanban
  const [kanbanData, setKanbanData] = useState<Record<string, any[]>>({});
  const [loadingKanban, setLoadingKanban] = useState(false);

  // Asamblea
  const [asambleaOrders, setAsambleaOrders] = useState<any[]>([]);
  const [loadingAsamblea, setLoadingAsamblea] = useState(false);
  const [showAsambleaModal, setShowAsambleaModal] = useState(false);
  const [asambleaTarget, setAsambleaTarget] = useState<any>(null);
  const [asambleaDecisionForm, setAsambleaDecisionForm] = useState({ decision: "aprobada", acta_url: "", cotizacion_url: "", comentario: "" });
  const [savingAsamblea, setSavingAsamblea] = useState(false);
  const [togglingAsamblea, setTogglingAsamblea] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "";

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);
    const edificioId = u.edificio_id;
    if (!edificioId) return;
    setEid(edificioId);
    loadInitial(edificioId);
  }, []);

  async function loadInitial(edificioId: number) {
    setLoadingOrdenes(true);
    const [statsR, ordenesR, provsR] = await Promise.allSettled([
      api.procurement.stats(edificioId),
      api.procurement.ordenes.list({ edificio_id: edificioId }),
      proveedoresApi.list(),
    ]);
    if (statsR.status === "fulfilled") setStats(statsR.value);
    if (ordenesR.status === "fulfilled") setOrdenes(ordenesR.value);
    if (provsR.status === "fulfilled") {
      const d = provsR.value;
      setProveedores(Array.isArray(d) ? d : (d?.proveedores ?? []));
    }
    setLoadingOrdenes(false);
  }

  async function loadOrdenes(opts?: { estado?: string; tipo?: string }) {
    if (!eid) return;
    setLoadingOrdenes(true);
    try {
      const params: any = { edificio_id: eid };
      const e = opts?.estado !== undefined ? opts.estado : filterEstado;
      const t = opts?.tipo !== undefined ? opts.tipo : filterTipo;
      if (e) params.estado = e;
      if (t) params.tipo_orden = t;
      const data = await api.procurement.ordenes.list(params);
      setOrdenes(data);
    } finally {
      setLoadingOrdenes(false);
    }
  }

  async function selectOrden(orden: any) {
    setSelectedOrden(orden);
    setLoadingDetalle(true);
    try {
      const detail = await api.procurement.ordenes.get(orden.id);
      setSelectedOrden(detail);
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function loadSolicitudes() {
    if (!eid) return;
    setLoadingSols(true);
    try {
      const data = await api.procurement.solicitudes.list(eid);
      setSolicitudes(data);
    } finally {
      setLoadingSols(false);
    }
  }

  async function selectSolicitud(sol: any) {
    setSelSol(sol);
    const data = await api.procurement.cotizaciones.list({ solicitud_id: sol.id });
    setCotizaciones(data);
  }

  useEffect(() => {
    if (activeTab === "cotizaciones" && eid && solicitudes.length === 0) loadSolicitudes();
    if (activeTab === "kanban" && eid) loadKanban();
    if (activeTab === "asamblea" && eid) loadAsamblea();
  }, [activeTab, eid]);

  async function loadKanban() {
    if (!eid) return;
    setLoadingKanban(true);
    try {
      const data = await api.procurement.kanban(eid);
      setKanbanData(data?.datos ?? {});
    } finally {
      setLoadingKanban(false);
    }
  }

  async function loadAsamblea() {
    if (!eid) return;
    setLoadingAsamblea(true);
    try {
      const data = await api.procurement.asamblea.list(eid);
      setAsambleaOrders(Array.isArray(data) ? data : []);
    } finally {
      setLoadingAsamblea(false);
    }
  }

  // ── Orden modal ───────────────────────────────────────────────────────────

  function openCreateOrden() {
    setEditingOrden(null);
    setOForm({ titulo: "", tipo_orden: "compra_bienes", proveedor_id: "", descripcion: "", monto_estimado: 0, fecha_necesidad: "" });
    setOClasificacion("");
    setOEsIndividual(false);
    setORequiereConsejo(false);
    setOProyectoId("");
    setOItems([mkItem()]);
    setShowOrdenModal(true);
  }

  function openEditOrden(orden: any) {
    setEditingOrden(orden);
    setOForm({
      titulo: orden.titulo ?? "",
      tipo_orden: orden.tipo_orden ?? "compra_bienes",
      proveedor_id: orden.proveedor_id ?? "",
      descripcion: orden.descripcion ?? "",
      monto_estimado: orden.monto_estimado ?? 0,
      fecha_necesidad: orden.fecha_necesidad ? orden.fecha_necesidad.slice(0, 10) : "",
    });
    setOClasificacion(orden.clasificacion ?? "");
    setOEsIndividual(orden.es_individual ?? false);
    setORequiereConsejo(orden.requiere_aprobacion_consejo ?? false);
    setOProyectoId(orden.proyecto_id ? String(orden.proyecto_id) : "");
    setOItems(
      orden.items?.length
        ? orden.items.map((i: any) => ({
            descripcion: i.descripcion, cantidad: Number(i.cantidad),
            unidad_medida: i.unidad_medida, precio_unitario: Number(i.precio_unitario),
          }))
        : [mkItem()]
    );
    setShowOrdenModal(true);
  }

  async function saveOrden() {
    if (!eid) return;
    setSavingO(true);
    try {
      const payload = {
        ...oForm,
        edificio_id: eid,
        proveedor_id: oForm.proveedor_id ? parseInt(oForm.proveedor_id) : null,
        monto_estimado: parseFloat(oForm.monto_estimado) || 0,
        clasificacion: oClasificacion || null,
        es_individual: oEsIndividual,
        requiere_aprobacion_consejo: oRequiereConsejo,
        proyecto_id: (oClasificacion === "actividad" && !oEsIndividual && oProyectoId) ? parseInt(oProyectoId) : null,
        items: oItems.filter((i) => i.descripcion.trim()),
      };
      const result = editingOrden
        ? await api.procurement.ordenes.update(editingOrden.id, payload)
        : await api.procurement.ordenes.create(payload);
      setShowOrdenModal(false);
      setSelectedOrden(result);
      await loadOrdenes();
      if (eid) api.procurement.stats(eid).then(setStats).catch(() => {});
    } catch (e: any) {
      const msg = e?.message ?? "";
      const detail = msg.match(/"detail":"([^"]+)"/)?.[1] ?? msg;
      alert(detail || "Error al guardar la orden. Intente de nuevo.");
    } finally {
      setSavingO(false);
    }
  }

  async function saveQuickTarea() {
    if (!eid || !selectedOrden || !quickTareaTitulo.trim()) return;
    setSavingQuickTarea(true);
    try {
      await api.procurement.ordenes.create({
        titulo: quickTareaTitulo.trim(),
        tipo_orden: selectedOrden.tipo_orden ?? "compra_bienes",
        clasificacion: "actividad",
        proyecto_id: selectedOrden.id,
        edificio_id: eid,
        es_individual: false,
        monto_estimado: 0,
      });
      setQuickTareaTitulo("");
      setShowQuickTarea(false);
      await loadOrdenes();
    } finally {
      setSavingQuickTarea(false);
    }
  }

  // ── Estado actions ─────────────────────────────────────────────────────────

  function requestAction(accion: string, label: string, needsComment: boolean) {
    setPendingAction({ accion, label, needsComment });
    setActionComment("");
    setShowActionModal(true);
  }

  async function executeAction() {
    if (!selectedOrden || !pendingAction) return;
    setDoingAction(true);
    try {
      const result = await api.procurement.ordenes.cambiarEstado(
        selectedOrden.id, pendingAction.accion, actionComment || undefined,
      );
      setSelectedOrden(result);
      setShowActionModal(false);
      loadOrdenes();
      if (eid) api.procurement.stats(eid).then(setStats).catch(() => {});
    } catch (e: any) {
      alert(e.message ?? "Error al ejecutar acción");
    } finally {
      setDoingAction(false);
    }
  }

  // ── Solicitudes ───────────────────────────────────────────────────────────

  async function saveSolicitud() {
    if (!eid) return;
    setSavingSol(true);
    try {
      await api.procurement.solicitudes.create({ ...solForm, edificio_id: eid });
      setShowSolModal(false);
      loadSolicitudes();
    } finally {
      setSavingSol(false);
    }
  }

  async function cerrarSolicitud(id: number) {
    await api.procurement.solicitudes.cerrar(id);
    loadSolicitudes();
    if (selSol?.id === id) setSelSol((s: any) => ({ ...s, estado: "cerrada" }));
  }

  // ── Cotizaciones ──────────────────────────────────────────────────────────

  async function saveCotizacion() {
    if (!selSol) return;
    setSavingCot(true);
    try {
      await api.procurement.cotizaciones.create({
        ...cotForm,
        solicitud_id: selSol.id,
        proveedor_id: parseInt(cotForm.proveedor_id),
        monto: parseFloat(cotForm.monto) || 0,
      });
      setShowCotModal(false);
      selectSolicitud(selSol);
    } finally {
      setSavingCot(false);
    }
  }

  async function marcarGanadora(cotId: number) {
    if (!confirm("¿Marcar esta cotización como ganadora? Se creará un borrador de orden de compra.")) return;
    await api.procurement.cotizaciones.marcarGanadora(cotId);
    selectSolicitud(selSol);
    loadOrdenes();
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isAdmin = user?.rol === "administrador" || user?.rol === "superadmin" || user?.rol === "backoffice";
  // Change 6: Simplified — any admin can approve directly (no SA flow)
  const canApprove = isAdmin;
  const estado = selectedOrden?.estado;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return <div className="text-center py-10 text-gray-400">Cargando…</div>;
  if (!eid) return (
    <div className="text-center py-10 text-gray-400">
      Selecciona un conjunto para acceder al módulo de Gestión.
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header — Change 1: Renamed to Gestión */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestión</h2>
          <p className="text-sm text-gray-500 mt-0.5">Órdenes de compra, cotizaciones y consejo de administración</p>
        </div>
        {activeTab === "ordenes" && (
          <button onClick={openCreateOrden} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            + Nueva Orden
          </button>
        )}
        {activeTab === "cotizaciones" && (
          <button onClick={() => { setSolForm({ titulo: "", tipo: "RFQ", descripcion: "", fecha_limite: "", criterios_evaluacion: "" }); setShowSolModal(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            + Nueva Solicitud
          </button>
        )}
      </div>

      {/* KPI cards */}
      {activeTab === "ordenes" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Borradores</div>
            <div className="text-2xl font-bold text-gray-900">{stats.borradores ?? 0}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Pendientes aprobación</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.pendientes ?? 0}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">En curso</div>
            <div className="text-2xl font-bold text-purple-700">{stats.en_ejecucion ?? 0}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Aprobadas</div>
            <div className="text-2xl font-bold text-blue-700">{stats.aprobadas ?? 0}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Gasto del mes</div>
            <div className="text-xl font-bold text-green-700">{fmt(stats.gasto_mes)}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {(["ordenes", "cotizaciones", "asamblea", "kanban"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            ordenes: "📋 Órdenes",
            cotizaciones: "📊 Cotizaciones & RFQ",
            asamblea: "🏛️ Asamblea",
            kanban: "📌 Tablero",
          };
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? "bg-white shadow text-primary" : "text-gray-600 hover:text-gray-900"}`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Órdenes ── */}
      {activeTab === "ordenes" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* List panel */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterEstado}
                onChange={(e) => { setFilterEstado(e.target.value); loadOrdenes({ estado: e.target.value }); }}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos los estados</option>
                {Object.entries(ESTADO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                value={filterTipo}
                onChange={(e) => { setFilterTipo(e.target.value); loadOrdenes({ tipo: e.target.value }); }}
                className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos los tipos</option>
                {TIPOS_ORDEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {(filterEstado || filterTipo) && (
                <button
                  onClick={() => { setFilterEstado(""); setFilterTipo(""); loadOrdenes({ estado: "", tipo: "" }); }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Table — Change 5: Tipo column, Change 10: Auditoría column */}
            <div className="bg-white border rounded-xl overflow-hidden">
              {loadingOrdenes ? (
                <div className="py-12 text-center text-gray-400 text-sm">Cargando órdenes…</div>
              ) : ordenes.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No hay órdenes. Crea una nueva para comenzar.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Título</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Siguiente paso</th>
                      <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordenes.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => selectOrden(o)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrden?.id === o.id ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.numero_orden}</td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="font-medium text-gray-900 truncate">{o.titulo}</div>
                          {o.proyecto_titulo && (
                            <div className="text-xs text-blue-600 truncate">{o.proyecto_titulo}</div>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-xs text-gray-500 capitalize">
                          {o.clasificacion?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">{fmt(o.monto_estimado)}</td>
                        <td className="px-4 py-3"><Badge estado={o.estado} /></td>
                        <td className="hidden lg:table-cell px-4 py-3 text-xs text-gray-600">
                          {ESTADO_SIGUIENTE[o.estado] ?? "—"}
                        </td>
                        <td className="hidden xl:table-cell px-4 py-3">
                          <span className="text-xs text-gray-400">{fmtDate(o.updated_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          {/* Quick-tareas panel — visible when selected order is a project */}
          {selectedOrden?.clasificacion === "proyecto" && (() => {
            const tareas = ordenes.filter((o: any) => o.proyecto_id === selectedOrden.id);
            return (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-400 font-mono mr-2">{selectedOrden.numero_orden}</span>
                    <span className="text-sm font-semibold text-gray-800 truncate">{selectedOrden.titulo}</span>
                    <span className="ml-2 text-xs text-gray-400">— {tareas.length} tarea{tareas.length !== 1 ? "s" : ""}</span>
                  </div>
                  {isAdmin && !showQuickTarea && (
                    <button
                      onClick={() => setShowQuickTarea(true)}
                      className="shrink-0 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      + Tarea
                    </button>
                  )}
                </div>

                {tareas.length === 0 && !showQuickTarea && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Sin tareas. {isAdmin && <button onClick={() => setShowQuickTarea(true)} className="text-primary underline hover:text-primary/80">Crear la primera</button>}
                  </div>
                )}

                {tareas.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {tareas.map((t: any) => (
                      <div
                        key={t.id}
                        onClick={() => selectOrden(t)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrden?.id === t.id ? "bg-blue-50" : ""}`}
                      >
                        <Badge estado={t.estado} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">{t.titulo}</div>
                          {t.proveedor_nombre && <div className="text-xs text-gray-400 truncate">{t.proveedor_nombre}</div>}
                        </div>
                        <div className="text-xs text-gray-400 shrink-0">{t.monto_estimado > 0 ? fmt(t.monto_estimado) : ""}</div>
                      </div>
                    ))}
                  </div>
                )}

                {showQuickTarea && (
                  <div className="px-4 py-3 border-t bg-gray-50 flex gap-2 items-center">
                    <input
                      value={quickTareaTitulo}
                      onChange={(e) => setQuickTareaTitulo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveQuickTarea();
                        if (e.key === "Escape") { setShowQuickTarea(false); setQuickTareaTitulo(""); }
                      }}
                      placeholder="Título de la tarea… (Enter para guardar)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      onClick={saveQuickTarea}
                      disabled={savingQuickTarea || !quickTareaTitulo.trim()}
                      className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {savingQuickTarea ? "…" : "✓"}
                    </button>
                    <button
                      onClick={() => { setShowQuickTarea(false); setQuickTareaTitulo(""); }}
                      className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          </div>

          {/* Detail panel */}
          <div className="xl:col-span-1">
            {!selectedOrden ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
                Selecciona una orden para ver el detalle
              </div>
            ) : loadingDetalle ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">Cargando detalle…</div>
            ) : (
              <div className="bg-white border rounded-xl divide-y overflow-hidden">

                {/* Header */}
                <div className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-gray-400">{selectedOrden.numero_orden}</div>
                    <div className="font-semibold text-gray-900 mt-0.5 break-words">{selectedOrden.titulo}</div>
                  </div>
                  <Badge estado={selectedOrden.estado} />
                </div>

                {/* Info */}
                <div className="px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 shrink-0">Proveedor</span>
                    <span className="font-medium text-right">{selectedOrden.proveedor_nombre ?? "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 shrink-0">Tipo</span>
                    <span className="text-right">{TIPOS_ORDEN.find((t) => t.value === selectedOrden.tipo_orden)?.label ?? selectedOrden.tipo_orden}</span>
                  </div>
                  {selectedOrden.clasificacion && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Clasificación</span>
                      <span className="text-right capitalize">{selectedOrden.clasificacion.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {selectedOrden.proyecto_titulo && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Proyecto</span>
                      <span className="text-right text-xs font-medium text-blue-700">{selectedOrden.proyecto_titulo}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 shrink-0">Monto estimado</span>
                    <span className="font-semibold text-primary">{fmt(selectedOrden.monto_estimado)}</span>
                  </div>
                  {selectedOrden.fecha_necesidad && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Fecha necesidad</span>
                      <span>{selectedOrden.fecha_necesidad?.slice(0, 10)}</span>
                    </div>
                  )}
                  {selectedOrden.descripcion && (
                    <div className="text-gray-500 text-xs mt-1 leading-relaxed">{selectedOrden.descripcion}</div>
                  )}
                </div>

                {/* Items */}
                {selectedOrden.items?.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</div>
                    <div className="space-y-1">
                      {(selectedOrden.items ?? []).map((item: any) => (
                        <div key={item.id} className="flex justify-between items-baseline gap-2 text-sm">
                          <span className="text-gray-700 min-w-0 truncate">
                            {item.descripcion}
                            <span className="text-gray-400 ml-1 text-xs">×{item.cantidad} {item.unidad_medida}</span>
                          </span>
                          <span className="font-medium text-gray-900 shrink-0">{fmt(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial aprobaciones */}
                {selectedOrden.aprobaciones?.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Historial aprobación</div>
                    <div className="space-y-2">
                      {(selectedOrden.aprobaciones ?? []).map((a: any) => (
                        <div key={a.id} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            a.estado === "aprobada" ? "bg-green-100 text-green-700" :
                            a.estado === "rechazada" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{a.estado}</span>
                          <div>
                            <div className="text-gray-700">{a.approver_nombre ?? a.approver_rol}</div>
                            {a.comentario && <div className="text-gray-400 mt-0.5">{a.comentario}</div>}
                            {a.fecha_decision && (
                              <div className="text-gray-400">{new Date(a.fecha_decision).toLocaleDateString("es-CO")}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivo cancelación */}
                {selectedOrden.motivo_cancelacion && (
                  <div className="px-4 py-3 bg-red-50">
                    <div className="text-xs font-semibold text-red-700 mb-1">Motivo cancelación</div>
                    <div className="text-sm text-red-600">{selectedOrden.motivo_cancelacion}</div>
                  </div>
                )}

                {/* Change 3: FileUploadGenerico for evidencias */}
                <div className="px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Archivos adjuntos</div>
                  <FileUploadGenerico
                    endpoint={`/api/procurement/ordenes/${selectedOrden.id}/archivos`}
                    archivos={selectedOrden.evidencias ?? []}
                    onUploaded={async () => {
                      const updated = await api.procurement.ordenes.get(selectedOrden.id);
                      setSelectedOrden(updated);
                    }}
                    label="Subir archivo"
                    multiple
                  />
                </div>

                {/* Aprobación Asamblea */}
                {isAdmin && selectedOrden.clasificacion !== "actividad" && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Aprobación Asamblea</div>
                      {selectedOrden.estado === "borrador" && (
                        <button
                          onClick={async () => {
                            const newVal = !selectedOrden.requiere_asamblea;
                            setTogglingAsamblea(true);
                            try {
                              await api.procurement.ordenes.asamblea.toggle(selectedOrden.id, newVal);
                              setSelectedOrden((o: any) => ({ ...o, requiere_asamblea: newVal, asamblea_estado: newVal ? "pendiente" : null }));
                            } finally { setTogglingAsamblea(false); }
                          }}
                          disabled={togglingAsamblea}
                          className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                        >
                          {selectedOrden.requiere_asamblea ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                    {selectedOrden.requiere_asamblea ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            selectedOrden.asamblea_estado === "aprobada" ? "bg-green-100 text-green-700" :
                            selectedOrden.asamblea_estado === "rechazada" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{selectedOrden.asamblea_estado ?? "pendiente"}</span>
                          {selectedOrden.asamblea_fecha && (
                            <span className="text-xs text-gray-400">{new Date(selectedOrden.asamblea_fecha).toLocaleDateString("es-CO")}</span>
                          )}
                        </div>
                        {selectedOrden.asamblea_acta_url && (
                          <a href={selectedOrden.asamblea_acta_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline block">📄 Acta de Asamblea</a>
                        )}
                        {selectedOrden.asamblea_cotizacion_url && (
                          <a href={selectedOrden.asamblea_cotizacion_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline block">📊 Cotización Aprobada</a>
                        )}
                        {selectedOrden.asamblea_comentario && (
                          <div className="text-xs text-gray-500">{selectedOrden.asamblea_comentario}</div>
                        )}
                        {(!selectedOrden.asamblea_estado || selectedOrden.asamblea_estado === "pendiente") && (
                          <button
                            onClick={() => { setAsambleaTarget(selectedOrden); setAsambleaDecisionForm({ decision: "aprobada", acta_url: "", cotizacion_url: "", comentario: "" }); setShowAsambleaModal(true); }}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Registrar Decisión
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No requiere aprobación de asamblea</div>
                    )}
                  </div>
                )}

                {/* Change 9: Aprobación por Consejo */}
                {isAdmin && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Aprobación Consejo</div>
                      {selectedOrden.estado === "borrador" && (
                        <button
                          onClick={async () => {
                            const newVal = !selectedOrden.requiere_aprobacion_consejo;
                            try {
                              await api.procurement.ordenes.update(selectedOrden.id, { requiere_aprobacion_consejo: newVal });
                              setSelectedOrden((o: any) => ({ ...o, requiere_aprobacion_consejo: newVal }));
                            } catch {}
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {selectedOrden.requiere_aprobacion_consejo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                    {selectedOrden.requiere_aprobacion_consejo ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            selectedOrden.consejo_estado === "aprobada" ? "bg-green-100 text-green-700" :
                            selectedOrden.consejo_estado === "rechazada" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{selectedOrden.consejo_estado ?? "pendiente"}</span>
                        </div>
                        {selectedOrden.consejo_comentario && (
                          <div className="text-xs text-gray-500">{selectedOrden.consejo_comentario}</div>
                        )}
                        {(!selectedOrden.consejo_estado || selectedOrden.consejo_estado === "pendiente") && isAdmin && (
                          <button
                            onClick={() => { setConsejoTarget(selectedOrden); setConsejoDecisionForm({ decision: "aprobada", comentario: "" }); setShowConsejoDecisionModal(true); }}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Registrar Decisión
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No requiere aprobación del consejo</div>
                    )}
                  </div>
                )}

                {/* Cotizaciones directas */}
                {isAdmin && selectedOrden.clasificacion === "proyecto" && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Cotizaciones</div>
                      <button
                        onClick={async () => {
                          setTogglingCots(true);
                          try {
                            const updated = await api.procurement.ordenes.cotizacionesToggle(selectedOrden.id, !selectedOrden.requiere_cotizaciones);
                            setSelectedOrden(updated);
                            setShowCotDirectaForm(false);
                          } finally { setTogglingCots(false); }
                        }}
                        disabled={togglingCots}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors disabled:opacity-50 ${
                          selectedOrden.requiere_cotizaciones ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {selectedOrden.requiere_cotizaciones ? "Activado" : "Desactivado"}
                      </button>
                    </div>
                    {selectedOrden.requiere_cotizaciones && (
                      <div className="space-y-2">
                        {(selectedOrden.cotizaciones ?? []).length === 0 && !showCotDirectaForm && (
                          <div className="text-xs text-gray-400 text-center py-2">Sin cotizaciones registradas.</div>
                        )}
                        {(selectedOrden.cotizaciones ?? []).map((c: any) => (
                          <div key={c.id} className={`bg-gray-50 rounded-lg px-3 py-2 flex items-start justify-between gap-2 border ${c.estado === "ganadora" ? "border-green-300 bg-green-50" : "border-gray-100"}`}>
                            <div className="text-xs space-y-0.5">
                              <div className="font-medium text-gray-900 flex items-center gap-1">
                                {c.proveedor_nombre}
                                {c.estado === "ganadora" && <span className="text-green-600 text-xs">★ Ganadora</span>}
                              </div>
                              <div className="text-primary font-semibold">{fmt(c.monto)}</div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {c.estado !== "ganadora" && (
                                <button
                                  onClick={async () => {
                                    await api.procurement.cotizaciones.marcarGanadora(c.id);
                                    const updated = await api.procurement.ordenes.get(selectedOrden.id);
                                    setSelectedOrden(updated);
                                  }}
                                  className="text-xs text-green-600 hover:text-green-800 font-medium"
                                >★</button>
                              )}
                              <button
                                onClick={async () => {
                                  if (!confirm("¿Eliminar esta cotización?")) return;
                                  await api.procurement.ordenes.deleteCotizacion(c.id);
                                  const updated = await api.procurement.ordenes.get(selectedOrden.id);
                                  setSelectedOrden(updated);
                                }}
                                className="text-gray-400 hover:text-red-500 text-xs"
                              >✕</button>
                            </div>
                          </div>
                        ))}
                        {showCotDirectaForm ? (
                          <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-0.5">Proveedor *</label>
                                <select value={cotDirectaForm.proveedor_id} onChange={(e) => setCotDirectaForm((f: any) => ({ ...f, proveedor_id: e.target.value }))}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                                  <option value="">Seleccionar…</option>
                                  {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-0.5">Monto *</label>
                                <input type="number" min="0" value={cotDirectaForm.monto} onChange={(e) => setCotDirectaForm((f: any) => ({ ...f, monto: e.target.value }))}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-0.5">Condiciones pago</label>
                                <input value={cotDirectaForm.condiciones_pago} onChange={(e) => setCotDirectaForm((f: any) => ({ ...f, condiciones_pago: e.target.value }))}
                                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" placeholder="30 días…" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!cotDirectaForm.proveedor_id || !cotDirectaForm.monto) return;
                                  setSavingCotDirecta(true);
                                  try {
                                    await api.procurement.ordenes.createCotizacion(selectedOrden.id, {
                                      ...cotDirectaForm,
                                      proveedor_id: parseInt(cotDirectaForm.proveedor_id),
                                      monto: parseFloat(cotDirectaForm.monto),
                                    });
                                    const updated = await api.procurement.ordenes.get(selectedOrden.id);
                                    setSelectedOrden(updated);
                                    setShowCotDirectaForm(false);
                                    setCotDirectaForm({ proveedor_id: "", numero_cotizacion: "", monto: 0, condiciones_pago: "", tiempo_entrega: "", vigencia: "", observaciones: "" });
                                  } finally { setSavingCotDirecta(false); }
                                }}
                                disabled={savingCotDirecta || !cotDirectaForm.proveedor_id || !cotDirectaForm.monto}
                                className="text-xs px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                              >
                                {savingCotDirecta ? "…" : "Guardar"}
                              </button>
                              <button onClick={() => setShowCotDirectaForm(false)} className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowCotDirectaForm(true)} className="text-xs text-primary font-medium hover:underline">
                            + Registrar cotización
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!["completada", "cancelada"].includes(estado) && (
                  <div className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Acciones</div>
                    <div className="flex flex-wrap gap-2">
                      {estado === "borrador" && isAdmin && (
                        <>
                          <button onClick={() => openEditOrden(selectedOrden)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors">✏️ Editar</button>
                          <button onClick={() => requestAction("submit", "Enviar a aprobación", false)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">→ Enviar</button>
                        </>
                      )}
                      {estado === "pendiente_aprobacion" && canApprove && (
                        <>
                          <button onClick={() => requestAction("aprobar", "Aprobar orden", false)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">✓ Aprobar</button>
                          <button onClick={() => requestAction("rechazar", "Rechazar orden", true)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">✗ Rechazar</button>
                        </>
                      )}
                      {estado === "aprobada" && isAdmin && (
                        <button onClick={() => requestAction("iniciar", "Iniciar ejecución", false)} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">▶ Iniciar</button>
                      )}
                      {estado === "en_ejecucion" && isAdmin && (
                        <button onClick={() => requestAction("completar", "Completar orden", false)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">✓ Completar</button>
                      )}
                      {estado === "rechazada" && isAdmin && (
                        <>
                          <button onClick={() => openEditOrden(selectedOrden)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors">✏️ Editar</button>
                          <button onClick={() => requestAction("reabrir", "Reabrir para edición", false)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">↩ Reabrir</button>
                        </>
                      )}
                      {isAdmin && (
                        <button onClick={() => requestAction("cancelar", "Cancelar orden", true)} className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">✕ Cancelar</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Cotizaciones & RFQ ── */}
      {activeTab === "cotizaciones" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="font-semibold text-gray-700 text-sm">Solicitudes de Cotización</div>
            {loadingSols ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">Cargando…</div>
            ) : solicitudes.length === 0 ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">No hay solicitudes.</div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Título</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Cotiz.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {solicitudes.map((s) => (
                      <tr key={s.id} onClick={() => selectSolicitud(s)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selSol?.id === s.id ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.tipo === "RFP" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{s.tipo}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{s.titulo}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{s.total_cotizaciones}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.estado === "abierta" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {!selSol ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">Selecciona una solicitud</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800">{selSol.titulo}</div>
                    {selSol.descripcion && <div className="text-xs text-gray-400 mt-0.5">{selSol.descripcion}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {selSol.estado === "abierta" && (
                      <>
                        <button onClick={() => { setCotForm({ proveedor_id: "", numero_cotizacion: "", monto: 0, condiciones_pago: "", tiempo_entrega: "", vigencia: "", observaciones: "" }); setShowCotModal(true); }} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                          + Cotización
                        </button>
                        <button onClick={() => cerrarSolicitud(selSol.id)} className="px-3 py-1.5 text-xs border text-gray-600 rounded-lg hover:bg-gray-50">Cerrar</button>
                      </>
                    )}
                  </div>
                </div>
                {cotizaciones.length === 0 ? (
                  <div className="bg-white border rounded-xl py-8 text-center text-gray-400 text-sm">Sin cotizaciones registradas.</div>
                ) : (
                  <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Proveedor</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Monto</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cotizaciones.map((c) => (
                          <tr key={c.id} className={c.estado === "ganadora" ? "bg-green-50" : ""}>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.proveedor_nombre}</td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">{fmt(c.monto)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                c.estado === "ganadora" ? "bg-green-100 text-green-700" :
                                c.estado === "perdedora" ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-600"
                              }`}>{c.estado}</span>
                            </td>
                            <td className="px-3 py-2">
                              {c.estado === "recibida" && selSol.estado === "abierta" && (
                                <button onClick={() => marcarGanadora(c.id)} className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">★ Ganadora</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Asamblea ── */}
      {activeTab === "asamblea" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            Órdenes que requieren aprobación de Asamblea de Copropietarios. Activa esta opción desde el detalle de cada orden.
          </div>
          {loadingAsamblea ? (
            <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">Cargando…</div>
          ) : asambleaOrders.length === 0 ? (
            <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">Ninguna orden requiere aprobación de asamblea.</div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Orden</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Título</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Monto</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Asamblea</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asambleaOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.numero_orden}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{o.titulo}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">{fmt(o.monto_estimado)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          o.asamblea_estado === "aprobada" ? "bg-green-100 text-green-700" :
                          o.asamblea_estado === "rechazada" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                        }`}>{o.asamblea_estado ?? "pendiente"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(!o.asamblea_estado || o.asamblea_estado === "pendiente") && isAdmin && (
                          <button
                            onClick={() => { setAsambleaTarget(o); setAsambleaDecisionForm({ decision: "aprobada", acta_url: "", cotizacion_url: "", comentario: "" }); setShowAsambleaModal(true); }}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Decidir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Kanban ── */}
      {activeTab === "kanban" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">Proyectos y Actividades visualizados por estado</div>
            <button onClick={loadKanban} className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">↻ Actualizar</button>
          </div>
          {loadingKanban ? (
            <div className="py-12 text-center text-gray-400 text-sm">Cargando tablero…</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {KANBAN_COLS.map((col) => {
                const cards: any[] = kanbanData[col.key] ?? [];
                return (
                  <div key={col.key} className={`flex-shrink-0 w-64 border rounded-xl ${col.color} flex flex-col`}>
                    <div className="px-3 py-2 border-b border-inherit flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{col.label}</span>
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 font-semibold text-gray-500">{cards.length}</span>
                    </div>
                    <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                      {cards.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-6">Sin elementos</div>
                      ) : cards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => { setActiveTab("ordenes"); selectOrden(card); }}
                          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-mono text-xs text-gray-400">{card.numero_orden}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${card.clasificacion === "actividad" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {card.clasificacion === "actividad" ? "🟢 Actividad" : "🔷 Proyecto"}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 leading-tight mb-1 line-clamp-2">{card.titulo}</div>
                          {card.proveedor_nombre && (
                            <div className="text-xs text-gray-500 truncate">{card.proveedor_nombre}</div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs font-medium text-primary">{fmt(card.monto_estimado)}</span>
                            {card.fecha_necesidad && (
                              <span className="text-xs text-gray-400">{card.fecha_necesidad?.slice(0, 10)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Modals ══════════════════════════════════════════════════════════════ */}

      {/* Modal: Crear/Editar Orden */}
      {showOrdenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-900">{editingOrden ? "Editar Orden" : "Nueva Orden de Gestión"}</h3>
              <button onClick={() => setShowOrdenModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    value={oForm.titulo}
                    onChange={(e) => setOForm((f: any) => ({ ...f, titulo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej: Compra repuestos ascensor"
                  />
                </div>

                {/* Change 4: Actividad individual checkbox */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oEsIndividual}
                      onChange={(e) => {
                        setOEsIndividual(e.target.checked);
                        if (e.target.checked) setOClasificacion("actividad");
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Actividad individual (sin proyecto)</span>
                  </label>
                </div>

                {!oEsIndividual && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Clasificación</label>
                    <select value={oClasificacion} onChange={(e) => { setOClasificacion(e.target.value); setOProyectoId(""); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {CLASIFICACIONES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                )}

                {!oEsIndividual && oClasificacion === "actividad" && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Proyecto al que pertenece</label>
                    <select value={oProyectoId} onChange={(e) => setOProyectoId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Sin proyecto asociado</option>
                      {ordenes.filter((o: any) => o.clasificacion === "proyecto").map((p: any) => (
                        <option key={p.id} value={p.id}>{p.titulo}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={oForm.tipo_orden} onChange={(e) => setOForm((f: any) => ({ ...f, tipo_orden: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    {TIPOS_ORDEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor</label>
                  <select value={oForm.proveedor_id} onChange={(e) => setOForm((f: any) => ({ ...f, proveedor_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                {!oEsIndividual && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto Estimado (COP)</label>
                    <input
                      type="number" min="0"
                      value={oForm.monto_estimado}
                      onChange={(e) => setOForm((f: any) => ({ ...f, monto_estimado: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Necesidad</label>
                  <input
                    type="date"
                    value={oForm.fecha_necesidad}
                    onChange={(e) => setOForm((f: any) => ({ ...f, fecha_necesidad: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción / Justificación</label>
                  <textarea
                    value={oForm.descripcion}
                    onChange={(e) => setOForm((f: any) => ({ ...f, descripcion: e.target.value }))}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Describe el objeto de la compra y la justificación del gasto…"
                  />
                </div>

                {/* Change 9: Requiere consejo toggle in form */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oRequiereConsejo}
                      onChange={(e) => setORequiereConsejo(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Requiere aprobación del consejo</span>
                  </label>
                </div>
              </div>

              {/* Items */}
              {!oEsIndividual && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">Items de línea</label>
                    <button onClick={() => setOItems((its) => [...its, mkItem()])} className="text-xs text-primary hover:text-primary/80 font-medium">
                      + Agregar item
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Descripción</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-500 w-14">Cant.</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-500 w-14">Unidad</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 w-28">Precio Unit.</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 w-24">Subtotal</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {oItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1.5">
                              <input
                                value={item.descripcion}
                                onChange={(e) => setOItems((its) => its.map((it, i) => i === idx ? { ...it, descripcion: e.target.value } : it))}
                                className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Descripción del item"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number" min="0"
                                value={item.cantidad}
                                onChange={(e) => setOItems((its) => its.map((it, i) => i === idx ? { ...it, cantidad: parseFloat(e.target.value) || 0 } : it))}
                                className="w-full border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={item.unidad_medida}
                                onChange={(e) => setOItems((its) => its.map((it, i) => i === idx ? { ...it, unidad_medida: e.target.value } : it))}
                                className="w-full border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number" min="0"
                                value={item.precio_unitario}
                                onChange={(e) => setOItems((its) => its.map((it, i) => i === idx ? { ...it, precio_unitario: parseFloat(e.target.value) || 0 } : it))}
                                className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium text-gray-700 whitespace-nowrap">
                              {fmt(item.cantidad * item.precio_unitario)}
                            </td>
                            <td className="px-2 py-1.5">
                              {oItems.length > 1 && (
                                <button onClick={() => setOItems((its) => its.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-base leading-none">×</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total estimado:</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-primary">
                            {fmt(oItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowOrdenModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={saveOrden}
                disabled={savingO || !oForm.titulo.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {savingO ? "Guardando…" : "Guardar borrador"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Acción de estado */}
      {showActionModal && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-900">{pendingAction.label}</h3>
            </div>
            <div className="px-6 py-4">
              {pendingAction.needsComment ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {pendingAction.accion === "cancelar" ? "Motivo de cancelación *" : "Comentario / motivo de rechazo *"}
                  </label>
                  <textarea
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-600">¿Confirmas la acción: <strong>{pendingAction.label}</strong>?</p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowActionModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={executeAction}
                disabled={doingAction || (pendingAction.needsComment && !actionComment.trim())}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {doingAction ? "Procesando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Solicitud */}
      {showSolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Nueva Solicitud de Cotización</h3>
              <button onClick={() => setShowSolModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
                  <input value={solForm.titulo} onChange={(e) => setSolForm((f: any) => ({ ...f, titulo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={solForm.tipo} onChange={(e) => setSolForm((f: any) => ({ ...f, tipo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="RFQ">RFQ – Solicitud de Cotización</option>
                    <option value="RFP">RFP – Solicitud de Propuesta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha límite</label>
                  <input type="date" value={solForm.fecha_limite} onChange={(e) => setSolForm((f: any) => ({ ...f, fecha_limite: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={solForm.descripcion} onChange={(e) => setSolForm((f: any) => ({ ...f, descripcion: e.target.value }))} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Criterios de evaluación</label>
                <textarea value={solForm.criterios_evaluacion} onChange={(e) => setSolForm((f: any) => ({ ...f, criterios_evaluacion: e.target.value }))} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Precio, tiempo de entrega, garantía…" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowSolModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={saveSolicitud} disabled={savingSol || !solForm.titulo.trim()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {savingSol ? "Creando…" : "Crear Solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Cotización */}
      {showCotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Registrar Cotización</h3>
              <button onClick={() => setShowCotModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor *</label>
                  <select value={cotForm.proveedor_id} onChange={(e) => setCotForm((f: any) => ({ ...f, proveedor_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Seleccionar…</option>
                    {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">N° Cotización</label>
                  <input value={cotForm.numero_cotizacion} onChange={(e) => setCotForm((f: any) => ({ ...f, numero_cotizacion: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto *</label>
                  <input type="number" min="0" value={cotForm.monto} onChange={(e) => setCotForm((f: any) => ({ ...f, monto: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Condiciones de Pago</label>
                  <input value={cotForm.condiciones_pago} onChange={(e) => setCotForm((f: any) => ({ ...f, condiciones_pago: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="30 días…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tiempo de Entrega</label>
                  <input value={cotForm.tiempo_entrega} onChange={(e) => setCotForm((f: any) => ({ ...f, tiempo_entrega: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="5 días hábiles…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vigencia</label>
                  <input type="date" value={cotForm.vigencia} onChange={(e) => setCotForm((f: any) => ({ ...f, vigencia: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowCotModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={saveCotizacion} disabled={savingCot || !cotForm.proveedor_id || !cotForm.monto} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {savingCot ? "Guardando…" : "Registrar Cotización"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Decisión Asamblea */}
      {showAsambleaModal && asambleaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Registrar Decisión de Asamblea</h3>
              <button onClick={() => setShowAsambleaModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Orden: <span className="font-medium text-gray-700">{asambleaTarget.numero_orden} — {asambleaTarget.titulo}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Decisión</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={asambleaDecisionForm.decision === "aprobada"} onChange={() => setAsambleaDecisionForm((f) => ({ ...f, decision: "aprobada" }))} />
                    <span className="text-sm text-green-700 font-medium">Aprobada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={asambleaDecisionForm.decision === "rechazada"} onChange={() => setAsambleaDecisionForm((f) => ({ ...f, decision: "rechazada" }))} />
                    <span className="text-sm text-red-700 font-medium">Rechazada</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">URL Acta de Asamblea</label>
                <input value={asambleaDecisionForm.acta_url} onChange={(e) => setAsambleaDecisionForm((f) => ({ ...f, acta_url: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://drive.google.com/…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">URL Cotización Aprobada</label>
                <input value={asambleaDecisionForm.cotizacion_url} onChange={(e) => setAsambleaDecisionForm((f) => ({ ...f, cotizacion_url: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://drive.google.com/…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Comentario</label>
                <textarea value={asambleaDecisionForm.comentario} onChange={(e) => setAsambleaDecisionForm((f) => ({ ...f, comentario: e.target.value }))} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowAsambleaModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={async () => {
                  setSavingAsamblea(true);
                  try {
                    await api.procurement.ordenes.asamblea.decision(asambleaTarget.id, asambleaDecisionForm);
                    setShowAsambleaModal(false);
                    if (activeTab === "asamblea") loadAsamblea();
                    if (selectedOrden?.id === asambleaTarget.id) {
                      const updated = await api.procurement.ordenes.get(asambleaTarget.id);
                      setSelectedOrden(updated);
                    }
                  } finally { setSavingAsamblea(false); }
                }}
                disabled={savingAsamblea}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {savingAsamblea ? "Guardando…" : "Guardar Decisión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Decisión Consejo */}
      {showConsejoDecisionModal && consejoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Registrar Decisión del Consejo</h3>
              <button onClick={() => setShowConsejoDecisionModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Orden: <span className="font-medium text-gray-700">{consejoTarget.numero_orden} — {consejoTarget.titulo}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Decisión</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={consejoDecisionForm.decision === "aprobada"} onChange={() => setConsejoDecisionForm((f) => ({ ...f, decision: "aprobada" }))} />
                    <span className="text-sm text-green-700 font-medium">Aprobada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={consejoDecisionForm.decision === "rechazada"} onChange={() => setConsejoDecisionForm((f) => ({ ...f, decision: "rechazada" }))} />
                    <span className="text-sm text-red-700 font-medium">Rechazada</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Comentario</label>
                <textarea value={consejoDecisionForm.comentario} onChange={(e) => setConsejoDecisionForm((f) => ({ ...f, comentario: e.target.value }))} rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Observaciones del consejo…" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowConsejoDecisionModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={async () => {
                  setSavingConsejoDecision(true);
                  try {
                    await api.procurement.ordenes.consejoDecision(consejoTarget.id, consejoDecisionForm);
                    setShowConsejoDecisionModal(false);
                    if (selectedOrden?.id === consejoTarget.id) {
                      const updated = await api.procurement.ordenes.get(consejoTarget.id);
                      setSelectedOrden(updated);
                    }
                  } finally { setSavingConsejoDecision(false); }
                }}
                disabled={savingConsejoDecision}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {savingConsejoDecision ? "Guardando…" : "Guardar Decisión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
