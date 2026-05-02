"use client";

import { useEffect, useState } from "react";
import { conjuntosApi, superadminApi } from "@/lib/api";

const EMPTY = { nombre: "", direccion: "", ciudad: "", pais: "Colombia" };

export default function ConjuntosPage() {
  const [conjuntos, setConjuntos] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [torres, setTorres]       = useState<Record<number, any[]>>({});
  const [loadingTorres, setLoadingTorres] = useState<Record<number, boolean>>({});

  // Assign torre form
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [assignEdificio, setAssignEdificio] = useState("");
  const [assignTorre, setAssignTorre]       = useState("");
  const [savingAssign, setSavingAssign]     = useState(false);

  async function load() {
    try {
      const [c, e] = await Promise.all([
        conjuntosApi.list(),
        superadminApi.edificios.list(),
      ]);
      setConjuntos(c.conjuntos ?? []);
      setEdificios(e.edificios ?? []);
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

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!torres[id]) {
      setLoadingTorres((prev) => ({ ...prev, [id]: true }));
      try {
        const data = await conjuntosApi.torres(id);
        setTorres((prev) => ({ ...prev, [id]: data.torres ?? [] }));
      } catch {
      } finally {
        setLoadingTorres((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  async function handleAssign(e: React.FormEvent, conjunto_id: number) {
    e.preventDefault();
    setSavingAssign(true);
    try {
      await conjuntosApi.assignTorre(conjunto_id, parseInt(assignEdificio), assignTorre || undefined);
      setShowAssign(null);
      setAssignEdificio("");
      setAssignTorre("");
      const data = await conjuntosApi.torres(conjunto_id);
      setTorres((prev) => ({ ...prev, [conjunto_id]: data.torres ?? [] }));
      await load();
    } catch {
    } finally {
      setSavingAssign(false);
    }
  }

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  // Edificios sin conjunto asignado
  const sinConjunto = edificios.filter((e) => !e.conjunto_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conjuntos Residenciales</h2>
          <p className="text-sm text-gray-500 mt-0.5">Agrupa varias torres bajo un mismo conjunto (ej. Benedictine Park)</p>
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
                  <div className="text-sm text-gray-500 mt-0.5">{c.ciudad}{c.direccion ? ` · ${c.direccion}` : ""}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{c.total_torres ?? 0} torre(s)</span>
                  <span className={`text-gray-400 text-sm transition-transform ${expanded === c.id ? "rotate-180" : ""}`}>▼</span>
                </div>
              </button>

              {expanded === c.id && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 space-y-3">
                  {loadingTorres[c.id] ? (
                    <div className="text-sm text-gray-400">Cargando torres…</div>
                  ) : (torres[c.id] ?? []).length === 0 ? (
                    <div className="text-sm text-gray-400">Sin torres asignadas</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(torres[c.id] ?? []).map((t: any) => (
                        <div key={t.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm text-gray-900">Torre {t.numero_torre ?? t.id}</span>
                            <span className="ml-2 text-xs text-gray-500">{t.unidades} unidades</span>
                          </div>
                          <span className="text-xs text-gray-400">{t.pisos} pisos</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    {showAssign === c.id ? (
                      <form onSubmit={(e) => handleAssign(e, c.id)} className="flex items-end gap-2 mt-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Edificio/Torre</label>
                          <select required value={assignEdificio} onChange={(e) => setAssignEdificio(e.target.value)} className={INPUT}>
                            <option value="">Seleccionar edificio…</option>
                            {sinConjunto.map((e: any) => (
                              <option key={e.id} value={e.id}>{e.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-28">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Torre</label>
                          <input value={assignTorre} onChange={(e) => setAssignTorre(e.target.value)} placeholder="1, 2, A…" className={INPUT} />
                        </div>
                        <button type="submit" disabled={savingAssign} className="bg-primary text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60 whitespace-nowrap">
                          {savingAssign ? "…" : "Asignar"}
                        </button>
                        <button type="button" onClick={() => setShowAssign(null)} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-2">✕</button>
                      </form>
                    ) : (
                      <button onClick={() => setShowAssign(c.id)} className="text-sm text-primary font-medium hover:underline mt-1">
                        + Asignar torre
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
