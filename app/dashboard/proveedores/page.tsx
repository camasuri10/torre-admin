"use client";

import { useCallback, useEffect, useState } from "react";
import { api, proveedoresApi, superadminApi, conjuntosApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

const EMPTY_FORM = {
  nombre: "", especialidad: "", contacto: "", telefono: "", email: "", nit: "",
};

const EMPTY_CONTRATO = {
  tipo_servicio: "mantenimiento",
  descripcion: "",
  fecha_inicio: "",
  fecha_fin: "",
  condiciones: "",
  archivo_url: "",
  valor: "",
  moneda: "COP",
  edificio_id: "",
  conjunto_id: "",
  fecha_auditoria: "",
  num_cotizaciones_requeridas: "1",
};

const EMPTY_EMPLEADO = { nombre: "", cedula: "", cargo: "", fecha_ingreso: "" };
const EMPTY_DOC = { tipo: "salud", url_documento: "", fecha_vencimiento: "", descripcion: "" };
const EMPTY_TAREA = { titulo: "", descripcion: "", fecha_programada: "", tipo: "personalizado" };
const EMPTY_PAGO = { tipo_pago: "anticipo", monto: "", fecha_pago: "", descripcion: "", url_comprobante: "" };

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

const TIPO_SERVICIO_LABELS: Record<string, string> = {
  seguridad: "Seguridad",
  aseo: "Aseo",
  jardineria: "Jardinería",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};

const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

export default function ProveedoresPage() {
  const user = getUser();
  const isSuperAdmin = user?.rol === "superadmin";
  const isAdmin = user?.rol === "administrador";
  const canManage = isSuperAdmin || isAdmin;
  const edificioId = user?.edificio_id;

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [edificios, setEdificios]     = useState<any[]>([]);
  const [conjuntos, setConjuntos]     = useState<any[]>([]);
  const [filtroEdificio, setFiltroEdificio] = useState<number>(edificioId ?? 0);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editando, setEditando]       = useState<any | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  // Asociaciones y contratos per-proveedor
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  // Asociaciones edificio/conjunto
  const [asociaciones, setAsociaciones]   = useState<Record<number, any[]>>({});
  const [asociacionesLoading, setAsociacionesLoading] = useState<Record<number, boolean>>({});
  const [showAddAsoc, setShowAddAsoc]     = useState<number | null>(null);
  const [asocEdificio, setAsocEdificio]   = useState("");
  const [asocConjunto, setAsocConjunto]   = useState("");
  const [asocSaving, setAsocSaving]       = useState(false);
  // Contratos
  const [contratos, setContratos]         = useState<Record<number, any[]>>({});
  const [contratosLoading, setContratosLoading] = useState<Record<number, boolean>>({});
  const [showAddContrato, setShowAddContrato] = useState<number | null>(null);
  const [contratoForm, setContratoForm]   = useState(EMPTY_CONTRATO);
  const [contratoSaving, setContratoSaving] = useState(false);
  const [contratoError, setContratoError] = useState("");

  // Empleados
  const [expandedEmpleadosId, setExpandedEmpleadosId] = useState<number | null>(null);
  const [empleados, setEmpleados]         = useState<Record<number, any[]>>({});
  const [empleadosLoading, setEmpleadosLoading] = useState<Record<number, boolean>>({});
  const [showEmpleadoModal, setShowEmpleadoModal] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<any | null>(null);
  const [empleadoTargetProv, setEmpleadoTargetProv] = useState<number | null>(null);
  const [empleadoForm, setEmpleadoForm]   = useState(EMPTY_EMPLEADO);
  const [empleadoSaving, setEmpleadoSaving] = useState(false);

  // Documentos de empleado
  const [expandedDocEmpleadoId, setExpandedDocEmpleadoId] = useState<number | null>(null);
  const [documentos, setDocumentos]       = useState<Record<number, any[]>>({});
  const [documentosLoading, setDocumentosLoading] = useState<Record<number, boolean>>({});
  const [showDocModal, setShowDocModal]   = useState(false);
  const [docTargetEmpleadoId, setDocTargetEmpleadoId] = useState<number | null>(null);
  const [docForm, setDocForm]             = useState(EMPTY_DOC);
  const [docSaving, setDocSaving]         = useState(false);

  // Gestión de contrato (modal)
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [gestionContrato, setGestionContrato] = useState<any | null>(null);
  const [gestionTab, setGestionTab]       = useState<"timeline" | "pagos" | "pdf">("timeline");
  const [gestionTareas, setGestionTareas] = useState<any[]>([]);
  const [gestionPagos, setGestionPagos]   = useState<any[]>([]);
  const [gestionLoading, setGestionLoading] = useState(false);
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [tareaForm, setTareaForm]         = useState(EMPTY_TAREA);
  const [tareaSaving, setTareaSaving]     = useState(false);
  const [editingTarea, setEditingTarea]   = useState<any | null>(null);
  const [showPagoForm, setShowPagoForm]   = useState(false);
  const [pagoForm, setPagoForm]           = useState(EMPTY_PAGO);
  const [pagoSaving, setPagoSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filtroEdificio) params.edificio_id = filtroEdificio;
      const p = await proveedoresApi.list(params);
      setProveedores(Array.isArray(p) ? p : (p?.proveedores ?? []));
    } catch { } finally { setLoading(false); }
  }, [filtroEdificio]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isSuperAdmin) {
      superadminApi.edificios.list().then((r: any) => setEdificios(r?.edificios ?? [])).catch(() => {});
      conjuntosApi.list().then((r: any) => setConjuntos(r?.conjuntos ?? [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  // ── Proveedor CRUD ────────────────────────────────────────────────────────────
  const openCreate = () => { setEditando(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p: any) => {
    setEditando(p);
    setForm({ nombre: p.nombre ?? "", especialidad: p.especialidad ?? "", contacto: p.contacto ?? "", telefono: p.telefono ?? "", email: p.email ?? "", nit: p.nit ?? "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editando) {
        await proveedoresApi.update(editando.id, form);
      } else {
        await proveedoresApi.create(form);
      }
      setShowForm(false); setEditando(null); setForm(EMPTY_FORM);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este proveedor?")) return;
    await proveedoresApi.delete(id);
    load();
  };

  // ── Asociaciones ──────────────────────────────────────────────────────────────
  async function loadAsociaciones(proveedorId: number) {
    setAsociacionesLoading((prev) => ({ ...prev, [proveedorId]: true }));
    try {
      const data = await proveedoresApi.edificios.list(proveedorId);
      setAsociaciones((prev) => ({ ...prev, [proveedorId]: data?.asociaciones ?? [] }));
    } catch { } finally { setAsociacionesLoading((prev) => ({ ...prev, [proveedorId]: false })); }
  }

  async function handleAddAsoc(e: React.FormEvent, proveedorId: number) {
    e.preventDefault();
    // Admin: auto-use their edificio
    const effEdificio = asocEdificio || (isAdmin && edificioId ? String(edificioId) : "");
    if (!effEdificio && !asocConjunto) return;
    setAsocSaving(true);
    try {
      await proveedoresApi.edificios.add(proveedorId, {
        edificio_id: effEdificio ? parseInt(effEdificio) : undefined,
        conjunto_id: asocConjunto ? parseInt(asocConjunto) : undefined,
      });
      setShowAddAsoc(null);
      setAsocEdificio(""); setAsocConjunto("");
      await loadAsociaciones(proveedorId);
    } catch { } finally { setAsocSaving(false); }
  }

  async function handleRemoveAsoc(proveedorId: number, peId: number) {
    if (!confirm("¿Quitar esta asociación?")) return;
    try {
      await proveedoresApi.edificios.remove(proveedorId, peId);
      await loadAsociaciones(proveedorId);
    } catch { alert("Error al quitar la asociación"); }
  }

  // ── Contratos ─────────────────────────────────────────────────────────────────
  async function toggleContratos(proveedorId: number) {
    if (expandedId === proveedorId) { setExpandedId(null); return; }
    setExpandedId(proveedorId);
    if (!asociaciones[proveedorId]) loadAsociaciones(proveedorId);
    if (contratos[proveedorId]) return;
    setContratosLoading((prev) => ({ ...prev, [proveedorId]: true }));
    try {
      const data = await proveedoresApi.contratos.list(proveedorId);
      setContratos((prev) => ({ ...prev, [proveedorId]: data?.contratos ?? [] }));
    } catch { } finally { setContratosLoading((prev) => ({ ...prev, [proveedorId]: false })); }
  }

  function openAddContrato(proveedorId: number) {
    // For admin, pre-fill with their building if it's associated; else leave empty
    const asocs = asociaciones[proveedorId] ?? [];
    const myAsoc = isAdmin && edificioId
      ? asocs.find((a: any) => a.edificio_id === edificioId)
      : null;
    const defaultEdificio = myAsoc ? String(edificioId) : (isSuperAdmin ? "" : String(edificioId ?? ""));
    setContratoForm({ ...EMPTY_CONTRATO, edificio_id: defaultEdificio });
    setContratoError("");
    setShowAddContrato(proveedorId);
  }

  async function handleCreateContrato(e: React.FormEvent, proveedorId: number) {
    e.preventDefault();
    if (!contratoForm.edificio_id && !contratoForm.conjunto_id) {
      setContratoError("Selecciona un edificio o conjunto");
      return;
    }
    setContratoSaving(true); setContratoError("");
    try {
      await proveedoresApi.contratos.create(proveedorId, {
        tipo_servicio: contratoForm.tipo_servicio,
        descripcion: contratoForm.descripcion || undefined,
        fecha_inicio: contratoForm.fecha_inicio || undefined,
        fecha_fin: contratoForm.fecha_fin || undefined,
        condiciones: contratoForm.condiciones || undefined,
        archivo_url: contratoForm.archivo_url || undefined,
        valor: contratoForm.valor ? parseFloat(contratoForm.valor) : undefined,
        moneda: contratoForm.moneda || "COP",
        edificio_id: contratoForm.edificio_id ? parseInt(contratoForm.edificio_id) : undefined,
        conjunto_id: contratoForm.conjunto_id ? parseInt(contratoForm.conjunto_id) : undefined,
        fecha_auditoria: contratoForm.fecha_auditoria || undefined,
        num_cotizaciones_requeridas: parseInt(contratoForm.num_cotizaciones_requeridas) || 1,
      });
      setShowAddContrato(null);
      setContratoForm(EMPTY_CONTRATO);
      // Refresh contracts for this proveedor
      const data = await proveedoresApi.contratos.list(proveedorId);
      setContratos((prev) => ({ ...prev, [proveedorId]: data?.contratos ?? [] }));
    } catch { setContratoError("Error al crear el contrato"); }
    finally { setContratoSaving(false); }
  }

  async function handleDeleteContrato(proveedorId: number, contratoId: number) {
    if (!confirm("¿Eliminar este contrato?")) return;
    try {
      await proveedoresApi.contratos.delete(contratoId);
      const data = await proveedoresApi.contratos.list(proveedorId);
      setContratos((prev) => ({ ...prev, [proveedorId]: data?.contratos ?? [] }));
    } catch { alert("Error al eliminar el contrato"); }
  }

  // ── Empleados ─────────────────────────────────────────────────────────────────
  async function loadEmpleados(provId: number) {
    setEmpleadosLoading((p) => ({ ...p, [provId]: true }));
    try {
      const data = await proveedoresApi.empleados.list(provId);
      setEmpleados((p) => ({ ...p, [provId]: Array.isArray(data) ? data : [] }));
    } finally { setEmpleadosLoading((p) => ({ ...p, [provId]: false })); }
  }

  function openEmpleadoModal(provId: number, emp?: any) {
    setEmpleadoTargetProv(provId);
    setEditingEmpleado(emp ?? null);
    setEmpleadoForm(emp ? { nombre: emp.nombre ?? "", cedula: emp.cedula ?? "", cargo: emp.cargo ?? "", fecha_ingreso: emp.fecha_ingreso ?? "" } : EMPTY_EMPLEADO);
    setShowEmpleadoModal(true);
  }

  async function handleSaveEmpleado() {
    if (!empleadoTargetProv) return;
    setEmpleadoSaving(true);
    try {
      if (editingEmpleado) {
        await proveedoresApi.empleados.update(editingEmpleado.id, empleadoForm);
      } else {
        await proveedoresApi.empleados.create(empleadoTargetProv, empleadoForm);
      }
      setShowEmpleadoModal(false);
      loadEmpleados(empleadoTargetProv);
    } finally { setEmpleadoSaving(false); }
  }

  async function handleDeleteEmpleado(provId: number, empId: number) {
    if (!confirm("¿Desactivar este empleado?")) return;
    await proveedoresApi.empleados.delete(empId);
    loadEmpleados(provId);
  }

  // ── Documentos de empleado ────────────────────────────────────────────────────
  async function loadDocumentos(empId: number) {
    setDocumentosLoading((p) => ({ ...p, [empId]: true }));
    try {
      const data = await proveedoresApi.empleados.documentos.list(empId);
      setDocumentos((p) => ({ ...p, [empId]: Array.isArray(data) ? data : [] }));
    } finally { setDocumentosLoading((p) => ({ ...p, [empId]: false })); }
  }

  function openDocModal(empId: number) {
    setDocTargetEmpleadoId(empId);
    setDocForm(EMPTY_DOC);
    setShowDocModal(true);
  }

  async function handleSaveDocumento() {
    if (!docTargetEmpleadoId) return;
    setDocSaving(true);
    try {
      await proveedoresApi.empleados.documentos.create(docTargetEmpleadoId, { ...docForm, fecha_vencimiento: docForm.fecha_vencimiento || undefined });
      setShowDocModal(false);
      loadDocumentos(docTargetEmpleadoId);
    } finally { setDocSaving(false); }
  }

  async function handleDeleteDocumento(empId: number, docId: number) {
    if (!confirm("¿Eliminar este documento?")) return;
    await proveedoresApi.empleados.documentos.delete(docId);
    loadDocumentos(empId);
  }

  // ── Gestión de Contrato ───────────────────────────────────────────────────────
  async function openGestion(contrato: any) {
    setGestionContrato(contrato);
    setGestionTab("timeline");
    setShowTareaForm(false); setShowPagoForm(false);
    setShowGestionModal(true);
    setGestionLoading(true);
    try {
      const [t, pg] = await Promise.all([
        api.contratos.tareas.list(contrato.id),
        api.contratos.pagos.list(contrato.id),
      ]);
      setGestionTareas(Array.isArray(t) ? t : []);
      setGestionPagos(Array.isArray(pg) ? pg : []);
    } finally { setGestionLoading(false); }
  }

  async function handleSaveTarea() {
    if (!gestionContrato) return;
    setTareaSaving(true);
    try {
      if (editingTarea) {
        await api.contratos.tareas.update(editingTarea.id, tareaForm);
      } else {
        await api.contratos.tareas.create(gestionContrato.id, tareaForm);
      }
      const data = await api.contratos.tareas.list(gestionContrato.id);
      setGestionTareas(Array.isArray(data) ? data : []);
      setShowTareaForm(false); setEditingTarea(null); setTareaForm(EMPTY_TAREA);
    } finally { setTareaSaving(false); }
  }

  async function handleSeedTareas() {
    if (!gestionContrato) return;
    if (!confirm("¿Cargar hitos predefinidos según el tipo de servicio?")) return;
    await api.contratos.tareas.seedPredefinidos(gestionContrato.id);
    const data = await api.contratos.tareas.list(gestionContrato.id);
    setGestionTareas(Array.isArray(data) ? data : []);
  }

  async function handleUpdateTareaEstado(tareaId: number, estado: string) {
    await api.contratos.tareas.update(tareaId, { estado });
    const data = await api.contratos.tareas.list(gestionContrato!.id);
    setGestionTareas(Array.isArray(data) ? data : []);
  }

  async function handleDeleteTarea(tareaId: number) {
    if (!confirm("¿Eliminar este hito?")) return;
    await api.contratos.tareas.delete(tareaId);
    const data = await api.contratos.tareas.list(gestionContrato!.id);
    setGestionTareas(Array.isArray(data) ? data : []);
  }

  async function handleSavePago() {
    if (!gestionContrato) return;
    setPagoSaving(true);
    try {
      await api.contratos.pagos.create(gestionContrato.id, { ...pagoForm, monto: parseFloat(pagoForm.monto) || 0 });
      const data = await api.contratos.pagos.list(gestionContrato.id);
      setGestionPagos(Array.isArray(data) ? data : []);
      setShowPagoForm(false); setPagoForm(EMPTY_PAGO);
    } finally { setPagoSaving(false); }
  }

  async function handleDeletePago(pagoId: number) {
    if (!confirm("¿Eliminar este pago?")) return;
    await api.contratos.pagos.delete(pagoId);
    const data = await api.contratos.pagos.list(gestionContrato!.id);
    setGestionPagos(Array.isArray(data) ? data : []);
  }

  function handleDownloadPDF() {
    if (!gestionContrato) return;
    api.contratos.pdf(gestionContrato.id);
  }

  const TAREA_ESTADO_COLOR: Record<string, string> = {
    pendiente: "bg-gray-100 text-gray-600",
    en_progreso: "bg-blue-100 text-blue-700",
    completada: "bg-green-100 text-green-700",
    vencida: "bg-red-100 text-red-600",
  };
  const DOC_TIPO_LABEL: Record<string, string> = { salud: "Salud", pension: "Pensión", arl: "ARL", otro: "Otro" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Proveedores</h2>
          <p className="text-sm text-gray-500 mt-0.5">Empresas y contactos de mantenimiento y servicios</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
            + Nuevo proveedor
          </button>
        )}
      </div>

      {/* Filtro edificio (solo SA) */}
      {isSuperAdmin && edificios.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">Edificio:</label>
          <select value={filtroEdificio} onChange={(e) => setFiltroEdificio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value={0}>Todos los edificios</option>
            {edificios.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      ) : proveedores.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🏭</div>
          <p className="text-gray-500 font-medium">Sin proveedores registrados</p>
          <p className="text-sm text-gray-400 mt-1">Agrega proveedores para asignarlos a solicitudes de mantenimiento</p>
          {canManage && (
            <button onClick={openCreate} className="mt-4 bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary/90">
              + Agregar primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {proveedores.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Proveedor header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                      {p.especialidad && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">{p.especialidad}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                      {p.contacto && <span>👤 {p.contacto}</span>}
                      {p.telefono && <span>📞 {p.telefono}</span>}
                      {p.email && <span>📧 {p.email}</span>}
                      {p.nit && <span>🪪 {p.nit}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => {
                        const next = expandedEmpleadosId === p.id ? null : p.id;
                        setExpandedEmpleadosId(next);
                        if (next && !empleados[next]) loadEmpleados(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        expandedEmpleadosId === p.id ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      👷 Empleados
                    </button>
                    <button onClick={() => toggleContratos(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        expandedId === p.id ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      📄 Contratos
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" title="Editar">✏️</button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Desactivar">🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Empleados panel */}
              {expandedEmpleadosId === p.id && (
                <div className="border-t border-purple-100 bg-purple-50/30 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-700">Empleados / Personal</p>
                    {canManage && (
                      <button onClick={() => openEmpleadoModal(p.id)} className="text-xs text-purple-600 font-medium hover:underline">
                        + Agregar empleado
                      </button>
                    )}
                  </div>
                  {empleadosLoading[p.id] ? (
                    <p className="text-xs text-gray-400">Cargando…</p>
                  ) : (empleados[p.id] ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">Sin empleados registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {(empleados[p.id] ?? []).map((emp: any) => (
                        <div key={emp.id} className="bg-white rounded-lg border border-gray-100 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs space-y-0.5">
                              <div className="font-medium text-gray-900">{emp.nombre}
                                {!emp.activo && <span className="ml-2 text-gray-400 font-normal">(inactivo)</span>}
                              </div>
                              <div className="text-gray-500 flex flex-wrap gap-x-3">
                                {emp.cedula && <span>CC: {emp.cedula}</span>}
                                {emp.cargo && <span>Cargo: {emp.cargo}</span>}
                                {emp.fecha_ingreso && <span>Ingreso: {emp.fecha_ingreso?.slice(0, 10)}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setExpandedDocEmpleadoId(expandedDocEmpleadoId === emp.id ? null : emp.id); if (expandedDocEmpleadoId !== emp.id && !documentos[emp.id]) loadDocumentos(emp.id); }}
                                className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                              >
                                📎 Docs
                              </button>
                              {canManage && (
                                <>
                                  <button onClick={() => openEmpleadoModal(p.id, emp)} className="text-gray-400 hover:text-primary text-xs px-1">✏️</button>
                                  <button onClick={() => handleDeleteEmpleado(p.id, emp.id)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Docs sub-panel */}
                          {expandedDocEmpleadoId === emp.id && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600">Documentos</span>
                                {canManage && (
                                  <button onClick={() => openDocModal(emp.id)} className="text-xs text-blue-600 hover:underline">+ Agregar</button>
                                )}
                              </div>
                              {documentosLoading[emp.id] ? (
                                <p className="text-xs text-gray-400">Cargando…</p>
                              ) : (documentos[emp.id] ?? []).length === 0 ? (
                                <p className="text-xs text-gray-400">Sin documentos.</p>
                              ) : (
                                <div className="space-y-1">
                                  {(documentos[emp.id] ?? []).map((doc: any) => {
                                    const dias = daysUntil(doc.fecha_vencimiento);
                                    const venceProx = dias !== null && dias <= 30 && dias >= 0;
                                    const vencido = dias !== null && dias < 0;
                                    return (
                                      <div key={doc.id} className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                            vencido ? "bg-red-100 text-red-700" : venceProx ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                                          }`}>{DOC_TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>
                                          <a href={doc.url_documento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[140px]">
                                            {doc.descripcion || "Ver documento"}
                                          </a>
                                          {doc.fecha_vencimiento && (
                                            <span className={`text-xs ${vencido ? "text-red-600" : venceProx ? "text-yellow-600" : "text-gray-400"}`}>
                                              {vencido ? "Vencido" : `Vence: ${doc.fecha_vencimiento?.slice(0, 10)} (${dias}d)`}
                                            </span>
                                          )}
                                        </div>
                                        {canManage && (
                                          <button onClick={() => handleDeleteDocumento(emp.id, doc.id)} className="text-gray-400 hover:text-red-500 text-xs shrink-0">✕</button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Expanded panel: asociaciones + contratos */}
              {expandedId === p.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">

                  {/* Asociaciones */}
                  {canManage && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Edificios/Conjuntos asociados</p>
                      {asociacionesLoading[p.id] ? (
                        <p className="text-xs text-gray-400">Cargando…</p>
                      ) : (asociaciones[p.id] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400">Sin asociaciones. Agrega un edificio o conjunto para crear contratos.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(asociaciones[p.id] ?? []).map((a: any) => (
                            <div key={a.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700">
                              <span>{a.edificio_nombre ?? a.conjunto_nombre}</span>
                              {canManage && (
                                <button onClick={() => handleRemoveAsoc(p.id, a.id)}
                                  className="text-red-400 hover:text-red-600 ml-1">✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {showAddAsoc === p.id ? (
                        <form onSubmit={(e) => handleAddAsoc(e, p.id)} className="flex flex-wrap items-end gap-2 mt-1">
                          {isSuperAdmin ? (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Edificio</label>
                                <select value={asocEdificio}
                                  onChange={(e) => { setAsocEdificio(e.target.value); setAsocConjunto(""); }}
                                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                                  <option value="">— elegir</option>
                                  {edificios.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">o Conjunto</label>
                                <select value={asocConjunto}
                                  onChange={(e) => { setAsocConjunto(e.target.value); setAsocEdificio(""); }}
                                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                                  <option value="">— elegir</option>
                                  {conjuntos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500">Tu edificio: <strong>Edificio #{edificioId}</strong></p>
                          )}
                          <button type="submit" disabled={asocSaving || (isSuperAdmin && !asocEdificio && !asocConjunto)}
                            className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60">
                            {asocSaving ? "…" : "Asociar"}
                          </button>
                          <button type="button" onClick={() => { setShowAddAsoc(null); setAsocEdificio(""); setAsocConjunto(""); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">✕</button>
                        </form>
                      ) : (
                        <button onClick={() => setShowAddAsoc(p.id)}
                          className="text-xs text-primary font-medium hover:underline">
                          + Asociar edificio/conjunto
                        </button>
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Contratos</p>
                  {contratosLoading[p.id] ? (
                    <p className="text-xs text-gray-400 text-center py-2">Cargando contratos…</p>
                  ) : (contratos[p.id] ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin contratos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {(contratos[p.id] ?? []).map((c: any) => {
                        const diasFin = daysUntil(c.fecha_fin);
                        const diasAuditoria = daysUntil(c.fecha_auditoria);
                        const alertColor =
                          diasFin !== null && diasFin >= 0 && diasFin < 15 ? "border-red-300 bg-red-50" :
                          diasFin !== null && diasFin >= 0 && diasFin < 30 ? "border-yellow-300 bg-yellow-50" :
                          "border-gray-100";
                        return (
                          <div key={c.id} className={`bg-white rounded-lg border p-3 ${alertColor}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs text-gray-700 space-y-0.5 flex-1 min-w-0">
                                <div className="font-medium text-gray-900 flex items-center flex-wrap gap-1">
                                  {TIPO_SERVICIO_LABELS[c.tipo_servicio] ?? c.tipo_servicio}
                                  {(c.edificio_nombre || c.conjunto_nombre) && (
                                    <span className="font-normal text-gray-500">— {c.edificio_nombre ?? c.conjunto_nombre}</span>
                                  )}
                                  {diasFin !== null && diasFin >= 0 && diasFin < 15 && <span className="text-red-600 font-semibold">⚠️ Vence en {diasFin}d</span>}
                                  {diasFin !== null && diasFin >= 0 && diasFin >= 15 && diasFin < 30 && <span className="text-yellow-600">⚡ Vence en {diasFin}d</span>}
                                  {diasAuditoria !== null && diasAuditoria >= 0 && diasAuditoria < 15 && <span className="text-orange-600">🔔 Auditoría en {diasAuditoria}d</span>}
                                </div>
                                {c.descripcion && <div className="text-gray-500">{c.descripcion}</div>}
                                {(c.fecha_inicio || c.fecha_fin) && (
                                  <div className="text-gray-400">{c.fecha_inicio ?? "?"} → {c.fecha_fin ?? "sin vencimiento"}</div>
                                )}
                                {c.archivo_url && (
                                  <a href={c.archivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                                    📎 Ver documento
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openGestion(c)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium whitespace-nowrap">
                                  ⚙️ Gestión
                                </button>
                                {canManage && (
                                  <button onClick={() => handleDeleteContrato(p.id, c.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add contrato */}
                  {canManage && showAddContrato !== p.id && (
                    <button onClick={() => openAddContrato(p.id)}
                      className="text-xs text-primary font-medium hover:underline">
                      + Agregar contrato
                    </button>
                  )}

                  {canManage && showAddContrato === p.id && (
                    <form onSubmit={(e) => handleCreateContrato(e, p.id)} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-700">Nuevo contrato</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de servicio</label>
                          <select value={contratoForm.tipo_servicio} onChange={(e) => setContratoForm({ ...contratoForm, tipo_servicio: e.target.value })}
                            className={INPUT}>
                            {Object.entries(TIPO_SERVICIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>

                        {/* Edificio / conjunto — filtered to pre-associated ones for admin */}
                        {isSuperAdmin ? (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Edificio</label>
                              <select value={contratoForm.edificio_id}
                                onChange={(e) => setContratoForm({ ...contratoForm, edificio_id: e.target.value, conjunto_id: "" })}
                                className={INPUT}>
                                <option value="">— ninguno</option>
                                {(asociaciones[p.id] ?? []).filter((a: any) => a.edificio_id).map((a: any) => (
                                  <option key={a.edificio_id} value={a.edificio_id}>{a.edificio_nombre}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Conjunto (alternativo)</label>
                              <select value={contratoForm.conjunto_id}
                                onChange={(e) => setContratoForm({ ...contratoForm, conjunto_id: e.target.value, edificio_id: "" })}
                                className={INPUT}>
                                <option value="">— ninguno</option>
                                {(asociaciones[p.id] ?? []).filter((a: any) => a.conjunto_id).map((a: any) => (
                                  <option key={a.conjunto_id} value={a.conjunto_id}>{a.conjunto_nombre}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Edificio</label>
                            <input disabled value={`Edificio #${edificioId}`} className={`${INPUT} bg-gray-50`} />
                          </div>
                        )}

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                          <input value={contratoForm.descripcion} onChange={(e) => setContratoForm({ ...contratoForm, descripcion: e.target.value })}
                            placeholder="Descripción del servicio contratado" className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
                          <input type="date" value={contratoForm.fecha_inicio} onChange={(e) => setContratoForm({ ...contratoForm, fecha_inicio: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
                          <input type="date" value={contratoForm.fecha_fin} onChange={(e) => setContratoForm({ ...contratoForm, fecha_fin: e.target.value })} className={INPUT} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Condiciones / notas</label>
                          <textarea value={contratoForm.condiciones} onChange={(e) => setContratoForm({ ...contratoForm, condiciones: e.target.value })}
                            rows={2} placeholder="Condiciones del contrato…" className={INPUT} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">URL del documento / contrato</label>
                          <input type="url" value={contratoForm.archivo_url}
                            onChange={(e) => setContratoForm({ ...contratoForm, archivo_url: e.target.value })}
                            placeholder="https://drive.google.com/… o enlace al contrato" className={INPUT} />
                          <p className="text-xs text-gray-400 mt-0.5">Pega el enlace al contrato en Google Drive, Dropbox u otro servicio.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Valor del contrato</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={contratoForm.valor}
                            onChange={(e) => setContratoForm({ ...contratoForm, valor: e.target.value })}
                            placeholder="Ej: 5000000"
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                          <select
                            value={contratoForm.moneda}
                            onChange={(e) => setContratoForm({ ...contratoForm, moneda: e.target.value })}
                            className={INPUT}
                          >
                            <option value="COP">COP — Peso Colombiano</option>
                            <option value="USD">USD — Dólar</option>
                            <option value="EUR">EUR — Euro</option>
                            <option value="CRC">CRC — Colón Costarricense</option>
                            <option value="PEN">PEN — Sol Peruano</option>
                            <option value="MXN">MXN — Peso Mexicano</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de auditoría</label>
                          <input type="date" value={contratoForm.fecha_auditoria} onChange={(e) => setContratoForm({ ...contratoForm, fecha_auditoria: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">N° cotizaciones requeridas</label>
                          <select value={contratoForm.num_cotizaciones_requeridas} onChange={(e) => setContratoForm({ ...contratoForm, num_cotizaciones_requeridas: e.target.value })} className={INPUT}>
                            <option value="1">1 cotización</option>
                            <option value="3">3 cotizaciones</option>
                          </select>
                        </div>
                      </div>
                      {contratoError && <p className="text-red-600 text-xs">{contratoError}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={contratoSaving}
                          className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
                          {contratoSaving ? "Guardando…" : "Guardar contrato"}
                        </button>
                        <button type="button" onClick={() => setShowAddContrato(null)}
                          className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Empleado */}
      {showEmpleadoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{editingEmpleado ? "Editar empleado" : "Agregar empleado"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input value={empleadoForm.nombre} onChange={(e) => setEmpleadoForm({ ...empleadoForm, nombre: e.target.value })}
                  className={INPUT} placeholder="Nombre completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cédula</label>
                  <input value={empleadoForm.cedula} onChange={(e) => setEmpleadoForm({ ...empleadoForm, cedula: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
                  <input value={empleadoForm.cargo} onChange={(e) => setEmpleadoForm({ ...empleadoForm, cargo: e.target.value })} className={INPUT} placeholder="Ej: Vigilante" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de ingreso</label>
                  <input type="date" value={empleadoForm.fecha_ingreso} onChange={(e) => setEmpleadoForm({ ...empleadoForm, fecha_ingreso: e.target.value })} className={INPUT} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowEmpleadoModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveEmpleado} disabled={empleadoSaving || !empleadoForm.nombre.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                {empleadoSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Documento de empleado */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Agregar documento</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={docForm.tipo} onChange={(e) => setDocForm({ ...docForm, tipo: e.target.value })} className={INPUT}>
                  <option value="salud">Salud</option>
                  <option value="pension">Pensión</option>
                  <option value="arl">ARL</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL del documento *</label>
                <input value={docForm.url_documento} onChange={(e) => setDocForm({ ...docForm, url_documento: e.target.value })}
                  className={INPUT} placeholder="https://drive.google.com/…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
                <input type="date" value={docForm.fecha_vencimiento} onChange={(e) => setDocForm({ ...docForm, fecha_vencimiento: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input value={docForm.descripcion} onChange={(e) => setDocForm({ ...docForm, descripcion: e.target.value })}
                  className={INPUT} placeholder="Ej: Planilla julio 2026" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowDocModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveDocumento} disabled={docSaving || !docForm.url_documento.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                {docSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gestión de Contrato */}
      {showGestionModal && gestionContrato && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">Gestión de Contrato</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {TIPO_SERVICIO_LABELS[gestionContrato.tipo_servicio] ?? gestionContrato.tipo_servicio}
                  {(gestionContrato.edificio_nombre || gestionContrato.conjunto_nombre) ? ` — ${gestionContrato.edificio_nombre ?? gestionContrato.conjunto_nombre}` : ""}
                </p>
              </div>
              <button onClick={() => setShowGestionModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-6 shrink-0">
              {(["timeline", "pagos", "pdf"] as const).map((t) => (
                <button key={t} onClick={() => setGestionTab(t)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${gestionTab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {t === "timeline" ? "📅 Timeline" : t === "pagos" ? "💰 Pagos" : "📄 Descargar PDF"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {gestionLoading ? (
                <div className="py-12 text-center text-gray-400">Cargando…</div>
              ) : (
                <>
                  {/* Timeline tab */}
                  {gestionTab === "timeline" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{gestionTareas.length} hito{gestionTareas.length !== 1 ? "s" : ""}</span>
                        <div className="flex gap-2">
                          <button onClick={handleSeedTareas} className="text-xs text-gray-500 border px-3 py-1 rounded-lg hover:bg-gray-50">⟳ Hitos predefinidos</button>
                          <button onClick={() => { setEditingTarea(null); setTareaForm(EMPTY_TAREA); setShowTareaForm(true); }} className="text-xs text-primary font-medium border border-primary px-3 py-1 rounded-lg hover:bg-primary/5">+ Agregar hito</button>
                        </div>
                      </div>
                      {showTareaForm && (
                        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-700">{editingTarea ? "Editar hito" : "Nuevo hito"}</p>
                          <input value={tareaForm.titulo} onChange={(e) => setTareaForm({ ...tareaForm, titulo: e.target.value })}
                            className={INPUT} placeholder="Título del hito *" />
                          <input value={tareaForm.descripcion} onChange={(e) => setTareaForm({ ...tareaForm, descripcion: e.target.value })}
                            className={INPUT} placeholder="Descripción (opcional)" />
                          <input type="date" value={tareaForm.fecha_programada} onChange={(e) => setTareaForm({ ...tareaForm, fecha_programada: e.target.value })} className={INPUT} />
                          <div className="flex gap-2">
                            <button onClick={handleSaveTarea} disabled={tareaSaving || !tareaForm.titulo.trim()}
                              className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-60">{tareaSaving ? "…" : "Guardar"}</button>
                            <button onClick={() => { setShowTareaForm(false); setEditingTarea(null); }} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                          </div>
                        </div>
                      )}
                      {gestionTareas.length === 0 && !showTareaForm ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Sin hitos. Agrega uno o carga los predefinidos.</div>
                      ) : (
                        <div className="space-y-2">
                          {gestionTareas.map((t: any) => (
                            <div key={t.id} className="bg-white border rounded-lg p-3 flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TAREA_ESTADO_COLOR[t.estado] ?? "bg-gray-100 text-gray-600"}`}>{t.estado}</span>
                                  <span className="text-sm font-medium text-gray-900">{t.titulo}</span>
                                </div>
                                {t.descripcion && <div className="text-xs text-gray-500 mt-0.5">{t.descripcion}</div>}
                                {t.fecha_programada && <div className="text-xs text-gray-400 mt-0.5">Fecha: {t.fecha_programada?.slice(0, 10)}</div>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <select value={t.estado} onChange={(e) => handleUpdateTareaEstado(t.id, e.target.value)}
                                  className="text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary">
                                  <option value="pendiente">Pendiente</option>
                                  <option value="en_progreso">En progreso</option>
                                  <option value="completada">Completada</option>
                                  <option value="vencida">Vencida</option>
                                </select>
                                <button onClick={() => handleDeleteTarea(t.id)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pagos tab */}
                  {gestionTab === "pagos" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{gestionPagos.length} pago{gestionPagos.length !== 1 ? "s" : ""} registrado{gestionPagos.length !== 1 ? "s" : ""}</span>
                        <button onClick={() => { setPagoForm(EMPTY_PAGO); setShowPagoForm(true); }} className="text-xs text-primary font-medium border border-primary px-3 py-1 rounded-lg hover:bg-primary/5">+ Registrar pago</button>
                      </div>
                      {showPagoForm && (
                        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-700">Nuevo pago</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                              <select value={pagoForm.tipo_pago} onChange={(e) => setPagoForm({ ...pagoForm, tipo_pago: e.target.value })} className={INPUT}>
                                <option value="anticipo">Anticipo</option>
                                <option value="finiquito">Finiquito</option>
                                <option value="parcial">Parcial</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                              <input type="number" min="0" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} className={INPUT} placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha pago *</label>
                              <input type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })} className={INPUT} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">URL comprobante</label>
                              <input value={pagoForm.url_comprobante} onChange={(e) => setPagoForm({ ...pagoForm, url_comprobante: e.target.value })} className={INPUT} placeholder="https://…" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                              <input value={pagoForm.descripcion} onChange={(e) => setPagoForm({ ...pagoForm, descripcion: e.target.value })} className={INPUT} placeholder="Notas del pago…" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSavePago} disabled={pagoSaving || !pagoForm.monto || !pagoForm.fecha_pago}
                              className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-60">{pagoSaving ? "…" : "Registrar"}</button>
                            <button onClick={() => setShowPagoForm(false)} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                          </div>
                        </div>
                      )}
                      {gestionPagos.length === 0 && !showPagoForm ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Sin pagos registrados.</div>
                      ) : (
                        <div className="space-y-2">
                          {gestionPagos.map((pg: any) => (
                            <div key={pg.id} className="bg-white border rounded-lg p-3 flex items-start justify-between gap-2">
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                    pg.tipo_pago === "anticipo" ? "bg-blue-100 text-blue-700" :
                                    pg.tipo_pago === "finiquito" ? "bg-green-100 text-green-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>{pg.tipo_pago}</span>
                                  <span className="text-primary font-bold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(pg.monto))}</span>
                                </div>
                                <div className="text-gray-400">{pg.fecha_pago?.slice(0, 10)}</div>
                                {pg.descripcion && <div className="text-gray-500">{pg.descripcion}</div>}
                                {pg.url_comprobante && (
                                  <a href={pg.url_comprobante} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📎 Comprobante</a>
                                )}
                              </div>
                              <button onClick={() => handleDeletePago(pg.id)} className="text-gray-400 hover:text-red-500 text-xs shrink-0">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDF tab */}
                  {gestionTab === "pdf" && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="text-5xl">📄</div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800 mb-1">Contrato en PDF</div>
                        <div className="text-sm text-gray-500 max-w-xs">Genera y descarga el contrato de servicio en formato PDF con todos los datos del proveedor y del edificio.</div>
                      </div>
                      <button
                        onClick={handleDownloadPDF}
                        className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                      >
                        ↓ Descargar PDF
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar proveedor */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{editando ? "Editar proveedor" : "Nuevo proveedor"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Mantenimientos García SAS" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Especialidad</label>
                <input value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                  placeholder="Ej: Plomería, Electricidad, Ascensores…" className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de contacto</label>
                  <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                    placeholder="Ej: Carlos Martínez" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="300 000 0000" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="proveedor@email.com" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
                  <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })}
                    placeholder="900.000.000-0" className={INPUT} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditando(null); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Guardando…" : editando ? "Actualizar" : "Crear proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
