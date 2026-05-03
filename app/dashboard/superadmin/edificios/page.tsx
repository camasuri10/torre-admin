"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

interface Edificio {
  id: number;
  nombre: string;
  direccion: string;
  unidades: number;
  pisos: number;
  modulos_activos: number;
}

export default function EdificiosPage() {
  const router = useRouter();
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", direccion: "", unidades: 0, pisos: 1 });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [editEdificio, setEditEdificio] = useState<Edificio | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", direccion: "", pisos: 1 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    loadEdificios();
  }, [router]);

  async function loadEdificios() {
    setLoading(true);
    try {
      const data = await superadminApi.edificios.list();
      setEdificios(data.edificios);
    } catch { setError("Error al cargar edificios"); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await superadminApi.edificios.create(form);
      setShowForm(false);
      setForm({ nombre: "", direccion: "", unidades: 0, pisos: 1 });
      loadEdificios();
    } catch { setError("Error al crear el edificio"); }
    finally { setSaving(false); }
  }

  function openEdit(ed: Edificio) {
    setEditEdificio(ed);
    setEditForm({ nombre: ed.nombre, direccion: ed.direccion, pisos: ed.pisos });
    setEditError("");
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editEdificio) return;
    setEditSaving(true);
    setEditError("");
    try {
      await superadminApi.edificios.update(editEdificio.id, editForm);
      setEditEdificio(null);
      loadEdificios();
    } catch { setEditError("Error al guardar los cambios"); }
    finally { setEditSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const filteredEdificios = q
    ? edificios.filter((e) => e.nombre.toLowerCase().includes(q) || e.direccion.toLowerCase().includes(q))
    : edificios;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Edificios</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los edificios de la plataforma</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          + Nuevo edificio
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
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear nuevo edificio</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input
                value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required placeholder="Torres del Norte"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
              <input
                value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                required placeholder="Cra 15 #85-32, Bogotá"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unidades</label>
              <input
                type="number" min={0} value={form.unidades}
                onChange={(e) => setForm({ ...form, unidades: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
              <input
                type="number" min={1} value={form.pisos}
                onChange={(e) => setForm({ ...form, pisos: parseInt(e.target.value) || 1 })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {error && <p className="sm:col-span-2 text-red-600 text-xs">{error}</p>}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                {saving ? "Guardando…" : "Crear edificio"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edificios list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Cargando…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEdificios.length === 0 ? (
            <p className="col-span-3 text-center text-gray-400 text-sm py-8">Sin resultados para la búsqueda.</p>
          ) : null}
          {filteredEdificios.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg">🏢</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  {e.modulos_activos} módulos activos
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{e.nombre}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{e.direccion}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>🏠 {e.unidades} unidades</span>
                <span>🏗️ {e.pisos} pisos</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEdit(e)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-all"
                >
                  ✏️ Editar
                </button>
                <Link
                  href={`/dashboard/superadmin/edificios/${e.id}`}
                  className="flex-1 text-center py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary hover:text-white transition-all"
                >
                  Gestionar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit building modal */}
      {editEdificio && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Editar edificio</h3>
              <button onClick={() => setEditEdificio(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input
                  required value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <input
                  required value={editForm.direccion}
                  onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
                <input
                  type="number" min={1} value={editForm.pisos}
                  onChange={(e) => setEditForm({ ...editForm, pisos: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {editError && <p className="text-red-600 text-xs">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {editSaving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" onClick={() => setEditEdificio(null)}
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
