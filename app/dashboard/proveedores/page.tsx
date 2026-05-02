"use client";

import { useCallback, useEffect, useState } from "react";
import { proveedoresApi, superadminApi } from "@/lib/api";
import { getUser } from "@/lib/auth";

const EMPTY_FORM = {
  nombre: "", especialidad: "", contacto: "", telefono: "", email: "", nit: "",
};

export default function ProveedoresPage() {
  const user = getUser();
  const isSuperAdmin = user?.rol === "superadmin";
  const edificioId = user?.edificio_id ?? 1;

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);
  const [filtroEdificio, setFiltroEdificio] = useState<number>(edificioId);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await proveedoresApi.list(filtroEdificio || undefined);
      setProveedores(Array.isArray(p) ? p : (p?.proveedores ?? []));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [filtroEdificio]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isSuperAdmin) {
      superadminApi.edificios.list()
        .then((r: any) => setEdificios(r?.edificios ?? []))
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const openCreate = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditando(p);
    setForm({
      nombre: p.nombre ?? "",
      especialidad: p.especialidad ?? "",
      contacto: p.contacto ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      nit: p.nit ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editando) {
        await proveedoresApi.update(editando.id, form);
      } else {
        await proveedoresApi.create({ ...form, edificio_id: filtroEdificio || edificioId });
      }
      setShowForm(false);
      setEditando(null);
      setForm(EMPTY_FORM);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Desactivar este proveedor?")) return;
    await proveedoresApi.delete(id);
    load();
  };

  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Proveedores</h2>
          <p className="text-sm text-gray-500 mt-0.5">Empresas y contactos de mantenimiento y servicios</p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
          + Nuevo proveedor
        </button>
      </div>

      {/* Filtro de edificio (solo superadmin) */}
      {isSuperAdmin && edificios.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">Edificio:</label>
          <select
            value={filtroEdificio}
            onChange={(e) => setFiltroEdificio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value={0}>Todos los edificios</option>
            {edificios.map((e: any) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
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
          <button onClick={openCreate} className="mt-4 bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-primary/90">
            + Agregar primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedores.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                  {p.especialidad && (
                    <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                      {p.especialidad}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Desactivar">
                    🗑️
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs text-gray-500">
                {p.contacto && <div>👤 {p.contacto}</div>}
                {p.telefono && <div>📞 {p.telefono}</div>}
                {p.email && <div>📧 {p.email}</div>}
                {p.nit && <div>🪪 NIT: {p.nit}</div>}
                {isSuperAdmin && p.edificio_nombre && (
                  <div className="pt-1 border-t border-gray-100 text-gray-400">🏢 {p.edificio_nombre}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {editando ? "Editar proveedor" : "Nuevo proveedor"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input required value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Mantenimientos García SAS" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Especialidad</label>
                <input value={form.especialidad}
                  onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                  placeholder="Ej: Plomería, Electricidad, Ascensores…" className={INPUT} />
              </div>

              {/* Si superadmin crea, puede elegir edificio */}
              {isSuperAdmin && !editando && edificios.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Edificio *</label>
                  <select value={filtroEdificio || ""} onChange={(e) => setFiltroEdificio(Number(e.target.value))}
                    required className={INPUT}>
                    <option value="">Seleccionar edificio…</option>
                    {edificios.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contacto</label>
                  <input value={form.contacto}
                    onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                    placeholder="Nombre del contacto" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="300 000 0000" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="proveedor@email.com" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NIT</label>
                  <input value={form.nit}
                    onChange={(e) => setForm({ ...form, nit: e.target.value })}
                    placeholder="900.000.000-0" className={INPUT} />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button"
                  onClick={() => { setShowForm(false); setEditando(null); setForm(EMPTY_FORM); }}
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
