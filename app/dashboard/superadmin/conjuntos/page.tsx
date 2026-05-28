"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

interface Conjunto {
  id: number;
  nombre: string;
  direccion: string;
  total_unidades: number;
  total_torres: number;
  pisos: number;
  modulos_activos: number;
  admin_nombre: string | null;
  nit: string | null;
  telefono: string | null;
}

const emptyForm = { nombre: "", direccion: "", pisos: 1, nit: "", telefono: "" };

export default function ConjuntosPage() {
  const router = useRouter();
  const [conjuntos, setConjuntos]   = useState<Conjunto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");

  const [editConjunto, setEditConjunto] = useState<Conjunto | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", direccion: "", pisos: 1, nit: "", telefono: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    loadConjuntos();
  }, [router]);

  async function loadConjuntos() {
    setLoading(true);
    try {
      const data = await superadminApi.conjuntos.list();
      setConjuntos(data.conjuntos);
    } catch { setError("Error al cargar conjuntos"); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await superadminApi.conjuntos.create({
        nombre: form.nombre,
        direccion: form.direccion,
        pisos: form.pisos,
        nit: form.nit || undefined,
        telefono: form.telefono || undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      loadConjuntos();
    } catch { setError("Error al crear el conjunto"); }
    finally { setSaving(false); }
  }

  function openEdit(ed: Conjunto) {
    setEditConjunto(ed);
    setEditForm({
      nombre: ed.nombre,
      direccion: ed.direccion,
      pisos: ed.pisos,
      nit: ed.nit ?? "",
      telefono: ed.telefono ?? "",
    });
    setEditError("");
  }

  async function handleInactivar(e: Conjunto) {
    if (!confirm(`¿Inactivar el conjunto "${e.nombre}"?\n\nEl conjunto dejará de aparecer en la plataforma pero sus datos se conservan.`)) return;
    setDeletingId(e.id);
    try {
      await superadminApi.conjuntos.delete(e.id);
      loadConjuntos();
    } catch { setError("Error al inactivar el conjunto"); }
    finally { setDeletingId(null); }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editConjunto) return;
    setEditSaving(true);
    setEditError("");
    try {
      await superadminApi.conjuntos.update(editConjunto.id, {
        nombre: editForm.nombre,
        direccion: editForm.direccion,
        pisos: editForm.pisos,
        nit: editForm.nit || undefined,
        telefono: editForm.telefono || undefined,
      });
      setEditConjunto(null);
      loadConjuntos();
    } catch { setEditError("Error al guardar los cambios"); }
    finally { setEditSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const filteredConjuntos = q
    ? conjuntos.filter((e) => e.nombre.toLowerCase().includes(q) || e.direccion.toLowerCase().includes(q))
    : conjuntos;

  const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Conjuntos</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los conjuntos de la plataforma</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          + Nuevo conjunto
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o dirección…"
          className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear nuevo conjunto</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Torres del Norte" className={INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección *</label>
              <input required value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Cra 15 #85-32, Bogotá" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
              <input type="number" min={1} value={form.pisos}
                onChange={(e) => setForm({ ...form, pisos: parseInt(e.target.value) || 1 })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
              <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })}
                placeholder="900.000.000-0" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="601 000 0000" className={INPUT} />
            </div>
            {error && <p className="sm:col-span-2 text-red-600 text-xs">{error}</p>}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                {saving ? "Guardando…" : "Crear conjunto"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Conjuntos list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Cargando…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredConjuntos.length === 0 ? (
            <p className="col-span-3 text-center text-gray-400 text-sm py-8">Sin resultados para la búsqueda.</p>
          ) : null}
          {filteredConjuntos.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg">🏘️</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  {e.modulos_activos} módulos activos
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{e.nombre}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{e.direccion}</p>
              <div className="mt-2 space-y-0.5">
                {e.admin_nombre && (
                  <p className="text-xs text-green-600">👤 {e.admin_nombre}</p>
                )}
                {e.nit && (
                  <p className="text-xs text-gray-400">NIT: {e.nit}</p>
                )}
                {e.telefono && (
                  <p className="text-xs text-gray-400">📞 {e.telefono}</p>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                {e.total_torres > 0 && <span>🏗️ {e.total_torres} torre{e.total_torres !== 1 ? "s" : ""}</span>}
                <span>🏠 {e.total_unidades ?? 0} unidades</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEdit(e)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-all"
                >
                  ✏️ Editar
                </button>
                <Link
                  href={`/dashboard/superadmin/conjuntos/${e.id}`}
                  className="flex-1 text-center py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary hover:text-white transition-all"
                >
                  Gestionar
                </Link>
                <button
                  onClick={() => handleInactivar(e)}
                  disabled={deletingId === e.id}
                  className="py-2 px-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all disabled:opacity-50"
                  title="Inactivar conjunto"
                >
                  {deletingId === e.id ? "…" : "🗑️"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit building modal */}
      {editConjunto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Editar conjunto</h3>
              <button onClick={() => setEditConjunto(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input required value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección *</label>
                <input required value={editForm.direccion}
                  onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
                  <input type="number" min={1} value={editForm.pisos}
                    onChange={(e) => setEditForm({ ...editForm, pisos: parseInt(e.target.value) || 1 })} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
                  <input value={editForm.nit}
                    onChange={(e) => setEditForm({ ...editForm, nit: e.target.value })}
                    placeholder="900.000.000-0" className={INPUT} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  placeholder="601 000 0000" className={INPUT} />
              </div>
              {editError && <p className="text-red-600 text-xs">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {editSaving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" onClick={() => setEditConjunto(null)}
                  className="flex-1 border border-gray-200 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
