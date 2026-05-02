"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

interface Admin {
  id: number;
  nombre: string;
  email: string;
  cedula: string | null;
  telefono: string | null;
  activo: boolean;
  edificios: { id: number; nombre: string }[];
}

interface Edificio {
  id: number;
  nombre: string;
}

export default function AdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editEdificios, setEditEdificios] = useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "", email: "", password: "", cedula: "", telefono: "",
    edificio_ids: [] as number[],
  });

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [adminsData, edData] = await Promise.all([
        superadminApi.admins.list(),
        superadminApi.edificios.list(),
      ]);
      setAdmins(adminsData.admins);
      setEdificios(edData.edificios);
    } catch { setError("Error al cargar datos"); }
    finally { setLoading(false); }
  }

  function toggleEdificio(id: number) {
    setForm((prev) => ({
      ...prev,
      edificio_ids: prev.edificio_ids.includes(id)
        ? prev.edificio_ids.filter((e) => e !== id)
        : [...prev.edificio_ids, id],
    }));
  }

  function toggleEditEdificio(id: number) {
    setEditEdificios((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function openEdit(admin: Admin) {
    setEditingAdmin(admin);
    setEditEdificios(admin.edificios.map((e) => e.id));
    setError("");
  }

  async function handleEditSave() {
    if (!editingAdmin) return;
    setEditSaving(true);
    setError("");
    try {
      await superadminApi.admins.updateEdificios(editingAdmin.id, editEdificios);
      setEditingAdmin(null);
      loadData();
    } catch { setError("Error al guardar los cambios."); }
    finally { setEditSaving(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.edificio_ids.length) { setError("Selecciona al menos un edificio"); return; }
    setSaving(true);
    setError("");
    try {
      await superadminApi.admins.create({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        cedula: form.cedula || undefined,
        telefono: form.telefono || undefined,
        edificio_ids: form.edificio_ids,
      });
      setShowForm(false);
      setForm({ nombre: "", email: "", password: "", cedula: "", telefono: "", edificio_ids: [] });
      loadData();
    } catch { setError("Error al crear el administrador. Verifica que el email no esté registrado."); }
    finally { setSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const filteredAdmins = q
    ? admins.filter((a) =>
        a.nombre.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      )
    : admins;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Administradores</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los administradores y sus edificios asignados</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          + Nuevo administrador
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Crear administrador</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Rodríguez"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@edificio.co"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cédula (opcional)</label>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="79.123.456"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono (opcional)</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="310 000 0000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Edificios asignados</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {edificios.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 cursor-pointer hover:border-primary/30 hover:bg-blue-50/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.edificio_ids.includes(e.id)}
                      onChange={() => toggleEdificio(e.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-gray-700">{e.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="sm:col-span-2 text-red-600 text-xs">{error}</p>}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                {saving ? "Guardando…" : "Crear administrador"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Editar edificios asignados</h3>
            <p className="text-xs text-gray-500 mb-4">{editingAdmin.nombre} · {editingAdmin.email}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {edificios.map((e) => (
                <label key={e.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 cursor-pointer hover:border-primary/30 hover:bg-blue-50/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={editEdificios.includes(e.id)}
                    onChange={() => toggleEditEdificio(e.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-gray-700">{e.nombre}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                onClick={() => { setEditingAdmin(null); setError(""); }}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admins list */}
      {error && !showForm && !editingAdmin && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filteredAdmins.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {q ? "Sin resultados para la búsqueda." : "No hay administradores registrados."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Edificios</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAdmins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-gray-900">{a.nombre}</div>
                    {a.cedula && <div className="text-xs text-gray-400">{a.cedula}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{a.email}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {a.edificios.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Sin edificio</span>
                      ) : (
                        a.edificios.map((e) => (
                          <span key={e.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {e.nombre}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
