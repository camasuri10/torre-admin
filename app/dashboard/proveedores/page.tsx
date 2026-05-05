"use client";

import { useCallback, useEffect, useState } from "react";
import { proveedoresApi, superadminApi, conjuntosApi } from "@/lib/api";
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
  edificio_id: "",
  conjunto_id: "",
};

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
        edificio_id: contratoForm.edificio_id ? parseInt(contratoForm.edificio_id) : undefined,
        conjunto_id: contratoForm.conjunto_id ? parseInt(contratoForm.conjunto_id) : undefined,
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
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                      {(contratos[p.id] ?? []).map((c: any) => (
                        <div key={c.id} className="bg-white rounded-lg border border-gray-100 p-3 flex items-start justify-between gap-2">
                          <div className="text-xs text-gray-700 space-y-0.5">
                            <div className="font-medium text-gray-900">
                              {TIPO_SERVICIO_LABELS[c.tipo_servicio] ?? c.tipo_servicio}
                              {(c.edificio_nombre || c.conjunto_nombre) && (
                                <span className="ml-2 font-normal text-gray-500">— {c.edificio_nombre ?? c.conjunto_nombre}</span>
                              )}
                            </div>
                            {c.descripcion && <div className="text-gray-500">{c.descripcion}</div>}
                            {(c.fecha_inicio || c.fecha_fin) && (
                              <div className="text-gray-400">
                                {c.fecha_inicio ?? "?"} → {c.fecha_fin ?? "sin vencimiento"}
                              </div>
                            )}
                          </div>
                          {canManage && (
                            <button onClick={() => handleDeleteContrato(p.id, c.id)}
                              className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
                          )}
                        </div>
                      ))}
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contacto</label>
                  <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                    placeholder="Nombre del contacto" className={INPUT} />
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
