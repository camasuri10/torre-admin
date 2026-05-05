"use client";

import { useEffect, useState } from "react";
import { conjuntosApi, superadminApi } from "@/lib/api";

const EMPTY = { nombre: "", nit: "", telefono: "", direccion: "", ciudad: "", pais: "Colombia" };

export default function ConjuntosPage() {
  const [conjuntos, setConjuntos] = useState<any[]>([]);
  const [allEdificios, setAllEdificios] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [edificios, setEdificios] = useState<Record<number, any[]>>({});
  const [loadingEd, setLoadingEd] = useState<Record<number, boolean>>({});

  // Edit conjunto
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editForm, setEditForm]     = useState(EMPTY);
  const [savingEdit, setSavingEdit] = useState(false);

  // Assign edificio form
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [assignEdificio, setAssignEdificio] = useState("");
  const [savingAssign, setSavingAssign]     = useState(false);

  async function load() {
    try {
      const [c, e] = await Promise.all([
        conjuntosApi.list(),
        superadminApi.edificios.list(),
      ]);
      setConjuntos(c.conjuntos ?? []);
      setAllEdificios(e.edificios ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await conjuntosApi.create(form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: any, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(c.id);
    setEditForm({
      nombre: c.nombre ?? "",
      nit: c.nit ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      ciudad: c.ciudad ?? "",
      pais: c.pais ?? "Colombia",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await conjuntosApi.update(editingId, editForm);
      setEditingId(null);
      await load();
    } catch {
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!edificios[id]) {
      setLoadingEd((prev) => ({ ...prev, [id]: true }));
      try {
        const data = await conjuntosApi.edificios(id);
        setEdificios((prev) => ({ ...prev, [id]: data.edificios ?? [] }));
      } catch {
      } finally {
        setLoadingEd((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  async function handleAssign(e: React.FormEvent, conjunto_id: number) {
    e.preventDefault();
    if (!assignEdificio) return;
    setSavingAssign(true);
    try {
      await conjuntosApi.assignEdificio(conjunto_id, parseInt(assignEdificio));
      setShowAssign(null);
      setAssignEdificio("");
      // Refresh building list for this conjunto
      const data = await conjuntosApi.edificios(conjunto_id);
      setEdificios((prev) => ({ ...prev, [conjunto_id]: data.edificios ?? [] }));
      await load();
    } catch {
    } finally {
      setSavingAssign(false);
    }
  }

  async function handleRemoveEdificio(conjunto_id: number, edificio_id: number, nombre: string) {
    if (!confirm(`¿Quitar "${nombre}" de este conjunto?`)) return;
    try {
      await conjuntosApi.removeEdificio(conjunto_id, edificio_id);
      const data = await conjuntosApi.edificios(conjunto_id);
      setEdificios((prev) => ({ ...prev, [conjunto_id]: data.edificios ?? [] }));
      await load();
    } catch {
      alert("Error al quitar el edificio");
    }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  // Edificios not yet assigned to any conjunto
  const sinConjunto = allEdificios.filter((e) => !e.conjunto_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conjuntos Residenciales</h2>
          <p className="text-sm text-gray-500 mt-0.5">Agrupa edificios bajo un mismo conjunto (ej. Benedictine Park)</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
          {showForm ? "✕ Cancelar" : "+ Nuevo conjunto"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Nuevo conjunto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Benedictine Park" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
              <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Bogotá" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
              <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} placeholder="900.123.456-1" className={INPUT} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="601 234 5678" className={INPUT} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Cra 15 #85-32" className={INPUT} /></div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Guardando…" : "Crear conjunto"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">Cargando…</div>
      ) : conjuntos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          Sin conjuntos registrados. Crea el primero.
        </div>
      ) : (
        <div className="space-y-3">
          {conjuntos.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(c.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="font-semibold text-gray-900">🏘️ {c.nombre}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {c.ciudad}{c.direccion ? ` · ${c.direccion}` : ""}
                    {c.nit ? ` · NIT: ${c.nit}` : ""}
                    {c.telefono ? ` · ☎ ${c.telefono}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => startEdit(c, e)}
                    className="text-xs text-primary font-medium hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <span className="text-sm text-gray-500">{c.total_edificios ?? 0} edificio(s)</span>
                  <span className={`text-gray-400 text-sm transition-transform ${expanded === c.id ? "rotate-180" : ""}`}>▼</span>
                </div>
              </button>

              {editingId === c.id && (
                <form onSubmit={handleEdit} className="border-t border-blue-100 bg-blue-50 px-6 py-4 space-y-4">
                  <h3 className="font-semibold text-gray-900 text-sm">Editar conjunto</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                      <input required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={INPUT} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                      <input value={editForm.ciudad} onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })} placeholder="Bogotá" className={INPUT} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
                      <input value={editForm.nit} onChange={(e) => setEditForm({ ...editForm, nit: e.target.value })} placeholder="900.123.456-1" className={INPUT} /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                      <input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} placeholder="601 234 5678" className={INPUT} /></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                      <input value={editForm.direccion} onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })} placeholder="Cra 15 #85-32" className={INPUT} /></div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
                    <button type="submit" disabled={savingEdit} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60">
                      {savingEdit ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              )}

              {expanded === c.id && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 space-y-3">
                  {loadingEd[c.id] ? (
                    <div className="text-sm text-gray-400">Cargando edificios…</div>
                  ) : (edificios[c.id] ?? []).length === 0 ? (
                    <div className="text-sm text-gray-400">Sin edificios asignados</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(edificios[c.id] ?? []).map((e: any) => (
                        <div key={e.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm text-gray-900">🏢 {e.nombre}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              {e.total_torres ?? 0} torre(s) · {e.total_unidades ?? 0} unidades
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveEdificio(c.id, e.id, e.nombre)}
                            className="text-red-400 hover:text-red-600 text-xs ml-2"
                            title="Quitar del conjunto"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    {showAssign === c.id ? (
                      <form onSubmit={(e) => handleAssign(e, c.id)} className="flex items-end gap-2 mt-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Edificio</label>
                          <select required value={assignEdificio} onChange={(e) => setAssignEdificio(e.target.value)} className={INPUT}>
                            <option value="">Seleccionar edificio…</option>
                            {sinConjunto.map((e: any) => (
                              <option key={e.id} value={e.id}>{e.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" disabled={savingAssign} className="bg-primary text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap">
                          {savingAssign ? "…" : "Asignar"}
                        </button>
                        <button type="button" onClick={() => setShowAssign(null)} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-2">✕</button>
                      </form>
                    ) : (
                      <button onClick={() => setShowAssign(c.id)} className="text-sm text-primary font-medium hover:underline mt-1">
                        + Asignar edificio
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sinConjunto.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">Edificios sin conjunto asignado ({sinConjunto.length})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sinConjunto.map((e: any) => (
              <span key={e.id} className="text-xs bg-white border border-amber-200 text-amber-700 rounded px-2 py-1">{e.nombre}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
