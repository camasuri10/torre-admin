"use client";

import { useCallback, useEffect, useState } from "react";
import { api, vehiculosApi, mascotasApi } from "@/lib/api";
import { getUser, getEdificiosDisponibles } from "@/lib/auth";

const EMPTY_RESIDENTE = { nombre: "", cedula: "", email: "", telefono: "", rol: "propietario", password: "", unidad_id: "" as number | "", tipo_ocupacion: "propietario" };
const EMPTY_VEHICULO = { placa: "", marca: "", modelo: "", color: "", tipo: "carro" };
const EMPTY_MASCOTA = { nombre: "", especie: "perro", raza: "", color: "" };

type Tab = "info" | "vehiculos" | "mascotas";

export default function ResidentesPage() {
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;
  const edificioNombre = getEdificiosDisponibles().find((e) => e.id === edificioId)?.nombre ?? `Edificio ${edificioId}`;

  const [residentes, setResidentes] = useState<any[]>([]);
  const [unidades, setUnidades]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState("");
  const [form, setForm]             = useState(EMPTY_RESIDENTE);

  // Detalle panel
  const [selected, setSelected]       = useState<any | null>(null);
  const [detailTab, setDetailTab]     = useState<Tab>("info");
  const [detailData, setDetailData]   = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Vehiculo form
  const [showVForm, setShowVForm]   = useState(false);
  const [vForm, setVForm]           = useState(EMPTY_VEHICULO);
  const [savingV, setSavingV]       = useState(false);

  // Mascota form
  const [showMForm, setShowMForm]   = useState(false);
  const [mForm, setMForm]           = useState(EMPTY_MASCOTA);
  const [savingM, setSavingM]       = useState(false);

  // Edit vehicle inline
  const [editVehiculo, setEditVehiculo]   = useState<any | null>(null);
  const [savingEditV, setSavingEditV]     = useState(false);

  // Edit pet inline
  const [editMascota, setEditMascota]     = useState<any | null>(null);
  const [savingEditM, setSavingEditM]     = useState(false);

  // Assign additional unit
  const [showAssignUnit, setShowAssignUnit] = useState(false);
  const [assignUnitForm, setAssignUnitForm] = useState({ unidad_id: "" as number | "", tipo: "propietario" });
  const [savingAssignUnit, setSavingAssignUnit] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.usuarios.list({ edificio_id: edificioId });
      setResidentes(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [edificioId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.edificios.unidades(edificioId)
      .then((u: any[]) => setUnidades(Array.isArray(u) ? u : []))
      .catch(() => {});
  }, [edificioId]);

  async function openDetail(r: any) {
    setSelected(r);
    setDetailTab("info");
    setDetailData(null);
    setDetailLoading(true);
    setEditVehiculo(null);
    setEditMascota(null);
    setShowAssignUnit(false);
    setAssignUnitForm({ unidad_id: "", tipo: "propietario" });
    try {
      const full = await api.usuarios.get(r.id);
      setDetailData(full);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { unidad_id, tipo_ocupacion, ...userData } = form;
      // edificio_id se pasa siempre → backend inserta en usuario_edificios automáticamente
      const newUser = await api.usuarios.create({ ...userData, edificio_id: edificioId });
      if (unidad_id) {
        const today = new Date().toISOString().slice(0, 10);
        await api.usuarios.asignarUnidad({
          unidad_id: Number(unidad_id),
          usuario_id: newUser.id,
          tipo: tipo_ocupacion,
          fecha_inicio: today,
        });
      }
      setForm(EMPTY_RESIDENTE);
      setShowForm(false);
      await load();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVehiculo(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingV(true);
    try {
      await vehiculosApi.create({ ...vForm, usuario_id: selected.id });
      setVForm(EMPTY_VEHICULO);
      setShowVForm(false);
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch {
    } finally {
      setSavingV(false);
    }
  }

  async function handleDeleteVehiculo(id: number) {
    await vehiculosApi.delete(id);
    const full = await api.usuarios.get(selected.id);
    setDetailData(full);
  }

  async function handleAddMascota(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingM(true);
    try {
      await mascotasApi.create({ ...mForm, usuario_id: selected.id });
      setMForm(EMPTY_MASCOTA);
      setShowMForm(false);
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch {
    } finally {
      setSavingM(false);
    }
  }

  async function handleDeleteMascota(id: number) {
    await mascotasApi.delete(id);
    const full = await api.usuarios.get(selected.id);
    setDetailData(full);
  }

  async function handleEditVehiculo(e: React.FormEvent) {
    e.preventDefault();
    if (!editVehiculo || !selected) return;
    setSavingEditV(true);
    try {
      const { id, ...data } = editVehiculo;
      await vehiculosApi.update(id, data);
      setEditVehiculo(null);
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch {
    } finally { setSavingEditV(false); }
  }

  async function handleEditMascota(e: React.FormEvent) {
    e.preventDefault();
    if (!editMascota || !selected) return;
    setSavingEditM(true);
    try {
      const { id, ...data } = editMascota;
      await mascotasApi.update(id, data);
      setEditMascota(null);
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch {
    } finally { setSavingEditM(false); }
  }

  async function handleRemoveOcupacion(ocup_id: number) {
    if (!confirm("¿Quitar esta unidad del residente?") || !selected) return;
    try {
      await api.usuarios.removeOcupacion(ocup_id);
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch { alert("Error al quitar la unidad"); }
  }

  async function handleAssignAdditionalUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !assignUnitForm.unidad_id) return;
    setSavingAssignUnit(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.usuarios.asignarUnidad({
        unidad_id: Number(assignUnitForm.unidad_id),
        usuario_id: selected.id,
        tipo: assignUnitForm.tipo,
        fecha_inicio: today,
      });
      setShowAssignUnit(false);
      setAssignUnitForm({ unidad_id: "", tipo: "propietario" });
      const full = await api.usuarios.get(selected.id);
      setDetailData(full);
    } catch {
    } finally { setSavingAssignUnit(false); }
  }

  const propietarios = residentes.filter((r) => r.tipo_ocupacion === "propietario" || r.rol === "propietario").length;
  const inquilinos   = residentes.filter((r) => r.tipo_ocupacion === "inquilino"   || r.rol === "inquilino").length;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? residentes.filter((r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.cedula ?? "").toLowerCase().includes(q) ||
        (r.unidad_numero ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      )
    : residentes;

  const initials = (n: string) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total residentes", value: residentes.length, color: "text-primary",    bg: "bg-blue-50" },
          { label: "Propietarios",     value: propietarios,       color: "text-indigo-700", bg: "bg-indigo-50" },
          { label: "Inquilinos",       value: inquilinos,          color: "text-purple-700", bg: "bg-purple-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Nuevo residente</h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              🏢 {edificioNombre}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Juan Rodríguez" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Cédula</label>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="79.111.222" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@email.com" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="310 000 0000" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value, unidad_id: "" })} className={INPUT}>
                <option value="propietario">Propietario</option>
                <option value="inquilino">Inquilino</option>
                <option value="portero">Portero</option>
                <option value="administrador">Administrador</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Contraseña temporal</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className={INPUT} /></div>
            {(form.rol === "propietario" || form.rol === "inquilino") && (
              <>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Unidad (apartamento)</label>
                  <select value={form.unidad_id} onChange={(e) => setForm({ ...form, unidad_id: e.target.value ? Number(e.target.value) : "" })} className={INPUT}>
                    <option value="">Asignar después</option>
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.numero}{u.piso ? ` — Piso ${u.piso}` : ""}</option>
                    ))}
                  </select></div>
                {form.unidad_id !== "" && (
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo de ocupación</label>
                    <select value={form.tipo_ocupacion} onChange={(e) => setForm({ ...form, tipo_ocupacion: e.target.value })} className={INPUT}>
                      <option value="propietario">Propietario</option>
                      <option value="inquilino">Inquilino</option>
                    </select></div>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-gray-400">El residente quedará asociado automáticamente a este edificio.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Guardando…" : "Crear residente"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Listado de residentes</h2>
            <button onClick={() => setShowForm((v) => !v)} className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {showForm ? "✕ Cancelar" : "+ Nuevo residente"}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula, unidad…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Nombre", "Cédula", "Tipo", "Unidad", "Edificio", "Teléfono", "Email"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Sin resultados.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} onClick={() => openDetail(r)} className="hover:bg-blue-50/40 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">{initials(r.nombre)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.nombre}</div>
                        <div className="text-xs text-gray-400">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.cedula ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      (r.tipo_ocupacion ?? r.rol) === "propietario" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>{r.tipo_ocupacion ?? r.rol}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{r.unidad_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.edificio_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">{q ? `${filtered.length} de ${residentes.length}` : residentes.length} residentes</span>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold">{initials(selected.nombre)}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{selected.nombre}</div>
                  <div className="text-sm text-gray-500">{selected.unidad_numero ?? "Sin unidad"}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl p-1">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {(["info", "vehiculos", "mascotas"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    detailTab === t ? "border-b-2 border-primary text-primary" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t === "info" ? "📋 Info" : t === "vehiculos" ? "🚗 Vehículos" : "🐾 Mascotas"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              {detailLoading ? (
                <div className="text-center text-gray-400 py-10">Cargando…</div>
              ) : !detailData ? (
                <div className="text-center text-gray-400 py-10">Error al cargar</div>
              ) : detailTab === "info" ? (
                <dl className="space-y-4">
                  {[
                    ["Nombre", detailData.nombre],
                    ["Cédula", detailData.cedula ?? "—"],
                    ["Email", detailData.email ?? "—"],
                    ["Teléfono", detailData.telefono ?? "—"],
                    ["Rol", detailData.rol],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{val}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Unidades</dt>
                    <div className="space-y-1.5">
                      {(detailData.ocupaciones ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400">Sin unidades asignadas</p>
                      ) : (detailData.ocupaciones ?? []).map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-900">{o.unidad_numero}</span>
                            {o.edificio_nombre && <span className="text-xs text-gray-500">{o.edificio_nombre}</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${o.tipo === "propietario" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{o.tipo}</span>
                          </div>
                          <button onClick={() => handleRemoveOcupacion(o.id)} className="text-red-400 hover:text-red-600 text-xs ml-2 flex-shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                    {showAssignUnit ? (
                      <form onSubmit={handleAssignAdditionalUnit} className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                            <select required value={assignUnitForm.unidad_id} onChange={(e) => setAssignUnitForm({ ...assignUnitForm, unidad_id: e.target.value ? Number(e.target.value) : "" })} className={INPUT}>
                              <option value="">Seleccionar…</option>
                              {unidades.map((u: any) => <option key={u.id} value={u.id}>{u.numero}{u.piso ? ` — Piso ${u.piso}` : ""}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                            <select value={assignUnitForm.tipo} onChange={(e) => setAssignUnitForm({ ...assignUnitForm, tipo: e.target.value })} className={INPUT}>
                              <option value="propietario">Propietario</option>
                              <option value="inquilino">Inquilino</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowAssignUnit(false)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                          <button type="submit" disabled={savingAssignUnit} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60">
                            {savingAssignUnit ? "…" : "Asignar"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setShowAssignUnit(true)} className="mt-2 text-sm text-primary font-medium hover:underline">+ Asignar unidad</button>
                    )}
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notificaciones</dt>
                    <div className="space-y-1 text-sm">
                      <div className={`flex items-center gap-2 ${detailData.notif_sistema ? "text-green-700" : "text-gray-400"}`}>
                        <span>{detailData.notif_sistema ? "✓" : "✗"}</span> Sistema
                      </div>
                      <div className={`flex items-center gap-2 ${detailData.notif_email ? "text-green-700" : "text-gray-400"}`}>
                        <span>{detailData.notif_email ? "✓" : "✗"}</span> Email
                      </div>
                      <div className={`flex items-center gap-2 ${detailData.notif_whatsapp ? "text-green-700" : "text-gray-400"}`}>
                        <span>{detailData.notif_whatsapp ? "✓" : "✗"}</span> WhatsApp
                      </div>
                    </div>
                  </div>
                </dl>
              ) : detailTab === "vehiculos" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{detailData.vehiculos?.length ?? 0} vehículo(s)</span>
                    <button onClick={() => setShowVForm((v) => !v)} className="text-sm text-primary font-medium hover:underline">
                      {showVForm ? "Cancelar" : "+ Agregar"}
                    </button>
                  </div>
                  {showVForm && (
                    <form onSubmit={handleAddVehiculo} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Placa *</label>
                          <input required value={vForm.placa} onChange={(e) => setVForm({ ...vForm, placa: e.target.value.toUpperCase() })} placeholder="ABC123" className={INPUT} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                          <select value={vForm.tipo} onChange={(e) => setVForm({ ...vForm, tipo: e.target.value })} className={INPUT}>
                            <option value="carro">Carro</option>
                            <option value="moto">Moto</option>
                            <option value="bicicleta">Bicicleta</option>
                            <option value="otro">Otro</option>
                          </select></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                          <input value={vForm.marca} onChange={(e) => setVForm({ ...vForm, marca: e.target.value })} placeholder="Toyota" className={INPUT} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
                          <input value={vForm.modelo} onChange={(e) => setVForm({ ...vForm, modelo: e.target.value })} placeholder="Corolla 2022" className={INPUT} /></div>
                        <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                          <input value={vForm.color} onChange={(e) => setVForm({ ...vForm, color: e.target.value })} placeholder="Blanco" className={INPUT} /></div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowVForm(false)} className="text-xs text-gray-500 px-3 py-1.5">Cancelar</button>
                        <button type="submit" disabled={savingV} className="bg-primary text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-60">
                          {savingV ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="space-y-2">
                    {(detailData.vehiculos ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Sin vehículos registrados</p>
                    ) : (detailData.vehiculos ?? []).map((v: any) => (
                      editVehiculo?.id === v.id ? (
                        <form key={v.id} onSubmit={handleEditVehiculo} className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Placa</label>
                              <input required value={editVehiculo.placa} onChange={(e) => setEditVehiculo({ ...editVehiculo, placa: e.target.value.toUpperCase() })} className={INPUT} /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Tipo</label>
                              <select value={editVehiculo.tipo} onChange={(e) => setEditVehiculo({ ...editVehiculo, tipo: e.target.value })} className={INPUT}>
                                <option value="carro">Carro</option>
                                <option value="moto">Moto</option>
                                <option value="bicicleta">Bicicleta</option>
                                <option value="otro">Otro</option>
                              </select></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Marca</label>
                              <input value={editVehiculo.marca ?? ""} onChange={(e) => setEditVehiculo({ ...editVehiculo, marca: e.target.value })} className={INPUT} /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Modelo</label>
                              <input value={editVehiculo.modelo ?? ""} onChange={(e) => setEditVehiculo({ ...editVehiculo, modelo: e.target.value })} className={INPUT} /></div>
                            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-0.5">Color</label>
                              <input value={editVehiculo.color ?? ""} onChange={(e) => setEditVehiculo({ ...editVehiculo, color: e.target.value })} className={INPUT} /></div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditVehiculo(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                            <button type="submit" disabled={savingEditV} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60">
                              {savingEditV ? "…" : "Guardar"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <div>
                            <span className="font-mono font-semibold text-gray-900 text-sm">{v.placa}</span>
                            <span className="ml-2 text-xs text-gray-500">{v.marca} {v.modelo}</span>
                            {v.color && <span className="ml-2 text-xs text-gray-400">· {v.color}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 capitalize">{v.tipo}</span>
                            <button onClick={() => setEditVehiculo({ id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, color: v.color, tipo: v.tipo })} className="text-blue-400 hover:text-blue-600 text-xs px-2" title="Editar">✎</button>
                            <button onClick={() => handleDeleteVehiculo(v.id)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{detailData.mascotas?.length ?? 0} mascota(s)</span>
                    <button onClick={() => setShowMForm((v) => !v)} className="text-sm text-primary font-medium hover:underline">
                      {showMForm ? "Cancelar" : "+ Agregar"}
                    </button>
                  </div>
                  {showMForm && (
                    <form onSubmit={handleAddMascota} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                          <input required value={mForm.nombre} onChange={(e) => setMForm({ ...mForm, nombre: e.target.value })} placeholder="Firulais" className={INPUT} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Especie</label>
                          <select value={mForm.especie} onChange={(e) => setMForm({ ...mForm, especie: e.target.value })} className={INPUT}>
                            <option value="perro">Perro</option>
                            <option value="gato">Gato</option>
                            <option value="ave">Ave</option>
                            <option value="otro">Otro</option>
                          </select></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Raza</label>
                          <input value={mForm.raza} onChange={(e) => setMForm({ ...mForm, raza: e.target.value })} placeholder="Labrador" className={INPUT} /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                          <input value={mForm.color} onChange={(e) => setMForm({ ...mForm, color: e.target.value })} placeholder="Dorado" className={INPUT} /></div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowMForm(false)} className="text-xs text-gray-500 px-3 py-1.5">Cancelar</button>
                        <button type="submit" disabled={savingM} className="bg-primary text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-60">
                          {savingM ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="space-y-2">
                    {(detailData.mascotas ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Sin mascotas registradas</p>
                    ) : (detailData.mascotas ?? []).map((m: any) => (
                      editMascota?.id === m.id ? (
                        <form key={m.id} onSubmit={handleEditMascota} className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Nombre</label>
                              <input required value={editMascota.nombre} onChange={(e) => setEditMascota({ ...editMascota, nombre: e.target.value })} className={INPUT} /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Especie</label>
                              <select value={editMascota.especie} onChange={(e) => setEditMascota({ ...editMascota, especie: e.target.value })} className={INPUT}>
                                <option value="perro">Perro</option>
                                <option value="gato">Gato</option>
                                <option value="ave">Ave</option>
                                <option value="otro">Otro</option>
                              </select></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Raza</label>
                              <input value={editMascota.raza ?? ""} onChange={(e) => setEditMascota({ ...editMascota, raza: e.target.value })} className={INPUT} /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Color</label>
                              <input value={editMascota.color ?? ""} onChange={(e) => setEditMascota({ ...editMascota, color: e.target.value })} className={INPUT} /></div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditMascota(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                            <button type="submit" disabled={savingEditM} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60">
                              {savingEditM ? "…" : "Guardar"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <div>
                            <span className="font-medium text-gray-900 text-sm">{m.nombre}</span>
                            <span className="ml-2 text-xs text-gray-500 capitalize">{m.especie}</span>
                            {m.raza && <span className="ml-1 text-xs text-gray-400">· {m.raza}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditMascota({ id: m.id, nombre: m.nombre, especie: m.especie, raza: m.raza, color: m.color })} className="text-blue-400 hover:text-blue-600 text-xs px-2" title="Editar">✎</button>
                            <button onClick={() => handleDeleteMascota(m.id)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
