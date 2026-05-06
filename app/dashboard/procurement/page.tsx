"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { api, proveedoresApi } from "@/lib/api";

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

function fmt(v: any) {
  if (v == null || v === "") return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(v));
}

type Tab = "ordenes" | "cotizaciones" | "flujos";
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

export default function ProcurementPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [eid, setEid] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ordenes");

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Ordenes tab
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);

  // Orden modal
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [editingOrden, setEditingOrden] = useState<any>(null);
  const [oForm, setOForm] = useState<any>({
    titulo: "", tipo_orden: "compra_bienes", proveedor_id: "",
    descripcion: "", monto_estimado: 0, fecha_necesidad: "",
  });
  const [oItems, setOItems] = useState<ItemForm[]>([mkItem()]);
  const [savingO, setSavingO] = useState(false);

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

  // Flujos tab
  const [flujos, setFlujos] = useState<any[]>([]);
  const [showFlujoModal, setShowFlujoModal] = useState(false);
  const [flujoForm, setFlujoForm] = useState<any>({
    nombre: "", tipo_orden: "", monto_minimo: 0, monto_maximo: "", approver_rol: "superadmin",
  });
  const [savingFlujo, setSavingFlujo] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);
    const edificioId = u.edificio_id;
    if (!edificioId) return;
    setEid(edificioId);
    loadInitial(edificioId, u.rol);
  }, []);

  async function loadInitial(edificioId: number, rol: string) {
    setLoadingOrdenes(true);
    const [statsR, ordenesR, pendR, provsR] = await Promise.allSettled([
      api.procurement.stats(edificioId),
      api.procurement.ordenes.list({ edificio_id: edificioId }),
      api.procurement.aprobaciones.pendientes(),
      proveedoresApi.list({ edificio_id: edificioId }),
    ]);
    if (statsR.status === "fulfilled") setStats(statsR.value);
    if (ordenesR.status === "fulfilled") setOrdenes(ordenesR.value);
    if (pendR.status === "fulfilled") setPendientes(pendR.value);
    if (provsR.status === "fulfilled") {
      const d = provsR.value;
      setProveedores(Array.isArray(d) ? d : (d?.proveedores ?? []));
    }
    setLoadingOrdenes(false);
    if (rol === "superadmin") {
      api.procurement.flujos.list(edificioId).then(setFlujos).catch(() => {});
    }
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
  }, [activeTab, eid]);

  // ── Orden modal ───────────────────────────────────────────────────────────

  function openCreateOrden() {
    setEditingOrden(null);
    setOForm({ titulo: "", tipo_orden: "compra_bienes", proveedor_id: "", descripcion: "", monto_estimado: 0, fecha_necesidad: "" });
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
        items: oItems.filter((i) => i.descripcion.trim()),
      };
      const result = editingOrden
        ? await api.procurement.ordenes.update(editingOrden.id, payload)
        : await api.procurement.ordenes.create(payload);
      setShowOrdenModal(false);
      setSelectedOrden(result);
      await loadOrdenes();
      if (eid) api.procurement.stats(eid).then(setStats).catch(() => {});
    } finally {
      setSavingO(false);
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
      if (eid) {
        api.procurement.stats(eid).then(setStats).catch(() => {});
        api.procurement.aprobaciones.pendientes().then(setPendientes).catch(() => {});
      }
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

  // ── Flujos ────────────────────────────────────────────────────────────────

  async function saveFlujo() {
    if (!eid) return;
    setSavingFlujo(true);
    try {
      await api.procurement.flujos.create({
        ...flujoForm,
        edificio_id: eid,
        monto_minimo: parseFloat(flujoForm.monto_minimo) || 0,
        monto_maximo: flujoForm.monto_maximo ? parseFloat(flujoForm.monto_maximo) : null,
        tipo_orden: flujoForm.tipo_orden || null,
      });
      setShowFlujoModal(false);
      api.procurement.flujos.list(eid).then(setFlujos).catch(() => {});
    } finally {
      setSavingFlujo(false);
    }
  }

  async function deleteFlujo(id: number) {
    if (!confirm("¿Eliminar esta regla de aprobación?")) return;
    await api.procurement.flujos.delete(id);
    if (eid) api.procurement.flujos.list(eid).then(setFlujos).catch(() => {});
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isAdmin = user?.rol === "administrador" || user?.rol === "superadmin" || user?.rol === "backoffice";
  const isSuperAdmin = user?.rol === "superadmin";
  const pendingAprobacion = selectedOrden?.aprobaciones?.find((a: any) => a.estado === "pendiente");
  const canApprove = pendingAprobacion &&
    (pendingAprobacion.approver_rol === user?.rol || isSuperAdmin);
  const estado = selectedOrden?.estado;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return <div className="text-center py-10 text-gray-400">Cargando…</div>;
  if (!eid) return (
    <div className="text-center py-10 text-gray-400">
      Selecciona un edificio para acceder al módulo de Procurement.
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Procurement y Gestión</h2>
          <p className="text-sm text-gray-500 mt-0.5">Órdenes de compra, cotizaciones y flujos de aprobación</p>
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
        {activeTab === "flujos" && isSuperAdmin && (
          <button onClick={() => { setFlujoForm({ nombre: "", tipo_orden: "", monto_minimo: 0, monto_maximo: "", approver_rol: "superadmin" }); setShowFlujoModal(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            + Nueva Regla
          </button>
        )}
      </div>

      {/* KPI cards */}
      {activeTab === "ordenes" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Borradores</div>
            <div className="text-2xl font-bold text-gray-900">{stats.borradores ?? 0}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Pendientes aprobación</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.pendientes ?? 0}</div>
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

      {/* Pending approvals banner */}
      {activeTab === "ordenes" && pendientes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-yellow-600 text-lg">⏳</span>
          <span className="text-sm font-medium text-yellow-800">
            {pendientes.length} orden{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""} de tu aprobación
          </span>
          <button
            onClick={() => { setFilterEstado("pendiente_aprobacion"); loadOrdenes({ estado: "pendiente_aprobacion" }); }}
            className="ml-2 text-sm text-yellow-600 underline hover:text-yellow-800"
          >
            Ver ahora →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["ordenes", "cotizaciones", ...(isSuperAdmin ? ["flujos"] : [])] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            ordenes: "📋 Órdenes",
            cotizaciones: "📊 Cotizaciones & RFQ",
            flujos: "⚙️ Flujos",
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
            {/* Filters */}
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

            {/* Table */}
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
                      <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                      <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
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
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{o.titulo}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-gray-500">{o.proveedor_nombre ?? "—"}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-right text-gray-700">{fmt(o.monto_estimado)}</td>
                        <td className="px-4 py-3"><Badge estado={o.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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

                {/* Aprobaciones */}
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

          {/* Solicitudes list */}
          <div className="space-y-3">
            <div className="font-semibold text-gray-700 text-sm">Solicitudes de Cotización</div>
            {loadingSols ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">Cargando…</div>
            ) : solicitudes.length === 0 ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">
                No hay solicitudes. Crea una nueva para comenzar.
              </div>
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
                      <tr
                        key={s.id}
                        onClick={() => selectSolicitud(s)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${selSol?.id === s.id ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.tipo === "RFP" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {s.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{s.titulo}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{s.total_cotizaciones}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.estado === "abierta" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {s.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cotizaciones detail */}
          <div className="space-y-3">
            {!selSol ? (
              <div className="bg-white border rounded-xl py-10 text-center text-gray-400 text-sm">
                Selecciona una solicitud para ver sus cotizaciones
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800">{selSol.titulo}</div>
                    {selSol.descripcion && <div className="text-xs text-gray-400 mt-0.5">{selSol.descripcion}</div>}
                    {selSol.criterios_evaluacion && (
                      <div className="text-xs text-gray-500 mt-1">Criterios: {selSol.criterios_evaluacion}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {selSol.estado === "abierta" && (
                      <>
                        <button onClick={() => { setCotForm({ proveedor_id: "", numero_cotizacion: "", monto: 0, condiciones_pago: "", tiempo_entrega: "", vigencia: "", observaciones: "" }); setShowCotModal(true); }} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                          + Cotización
                        </button>
                        <button onClick={() => cerrarSolicitud(selSol.id)} className="px-3 py-1.5 text-xs border text-gray-600 rounded-lg hover:bg-gray-50">
                          Cerrar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {cotizaciones.length === 0 ? (
                  <div className="bg-white border rounded-xl py-8 text-center text-gray-400 text-sm">
                    Sin cotizaciones registradas para esta solicitud.
                  </div>
                ) : (
                  <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Proveedor</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Monto</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Pago</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Entrega</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cotizaciones.map((c) => (
                          <tr key={c.id} className={c.estado === "ganadora" ? "bg-green-50" : ""}>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.proveedor_nombre}</td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">{fmt(c.monto)}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{c.condiciones_pago ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{c.tiempo_entrega ?? "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                c.estado === "ganadora" ? "bg-green-100 text-green-700" :
                                c.estado === "perdedora" ? "bg-red-100 text-red-500" :
                                "bg-gray-100 text-gray-600"
                              }`}>{c.estado}</span>
                            </td>
                            <td className="px-3 py-2">
                              {c.estado === "recibida" && selSol.estado === "abierta" && (
                                <button onClick={() => marcarGanadora(c.id)} className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap">
                                  ★ Ganadora
                                </button>
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

      {/* ── Tab: Flujos ── */}
      {activeTab === "flujos" && isSuperAdmin && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
            <div className="font-semibold text-blue-800 mb-1">Reglas por defecto del sistema</div>
            <div className="text-blue-700">
              Monto &lt; $1.000.000 COP → auto-aprobado por Administrador &nbsp;|&nbsp;
              Monto ≥ $1.000.000 COP → requiere aprobación de Superadmin
            </div>
            <div className="text-blue-500 text-xs mt-1">
              Las reglas personalizadas a continuación reemplazan este comportamiento cuando aplican.
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            {flujos.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                No hay reglas personalizadas. Se aplican las reglas por defecto.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo Orden</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rango Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aprueba</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {flujos.map((f) => (
                    <tr key={f.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{f.nombre}</td>
                      <td className="px-4 py-3 text-gray-500">{f.tipo_orden ?? "Todos"}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(f.monto_minimo)} – {f.monto_maximo ? fmt(f.monto_maximo) : "sin límite"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${f.approver_rol === "superadmin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {f.approver_rol}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteFlujo(f.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ Modals ══════════════════════════════════════════════════════════════ */}

      {/* Modal: Crear/Editar Orden */}
      {showOrdenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-900">{editingOrden ? "Editar Orden" : "Nueva Orden de Compra"}</h3>
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto Estimado (COP)</label>
                  <input
                    type="number" min="0"
                    value={oForm.monto_estimado}
                    onChange={(e) => setOForm((f: any) => ({ ...f, monto_estimado: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={oForm.descripcion}
                    onChange={(e) => setOForm((f: any) => ({ ...f, descripcion: e.target.value }))}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Items */}
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
                    placeholder={pendingAction.accion === "cancelar" ? "¿Por qué se cancela esta orden?" : "Motivo del rechazo…"}
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
                  placeholder="Precio, tiempo de entrega, garantía, soporte…" />
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vigencia</label>
                  <input type="date" value={cotForm.vigencia} onChange={(e) => setCotForm((f: any) => ({ ...f, vigencia: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Condiciones de Pago</label>
                  <input value={cotForm.condiciones_pago} onChange={(e) => setCotForm((f: any) => ({ ...f, condiciones_pago: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="30 días, anticipo 50%…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tiempo de Entrega</label>
                  <input value={cotForm.tiempo_entrega} onChange={(e) => setCotForm((f: any) => ({ ...f, tiempo_entrega: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="5 días hábiles…" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={cotForm.observaciones} onChange={(e) => setCotForm((f: any) => ({ ...f, observaciones: e.target.value }))} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
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

      {/* Modal: Nueva Regla de Flujo */}
      {showFlujoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Nueva Regla de Aprobación</h3>
              <button onClick={() => setShowFlujoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input value={flujoForm.nombre} onChange={(e) => setFlujoForm((f: any) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ej: Obras civiles grandes" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Orden</label>
                  <select value={flujoForm.tipo_orden} onChange={(e) => setFlujoForm((f: any) => ({ ...f, tipo_orden: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Todos los tipos</option>
                    {TIPOS_ORDEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rol que aprueba</label>
                  <select value={flujoForm.approver_rol} onChange={(e) => setFlujoForm((f: any) => ({ ...f, approver_rol: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="administrador">Administrador</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto mínimo (COP)</label>
                  <input type="number" min="0" value={flujoForm.monto_minimo} onChange={(e) => setFlujoForm((f: any) => ({ ...f, monto_minimo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto máximo (COP)</label>
                  <input type="number" min="0" value={flujoForm.monto_maximo} onChange={(e) => setFlujoForm((f: any) => ({ ...f, monto_maximo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Vacío = sin límite" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowFlujoModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={saveFlujo} disabled={savingFlujo || !flujoForm.nombre.trim()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {savingFlujo ? "Guardando…" : "Crear Regla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
