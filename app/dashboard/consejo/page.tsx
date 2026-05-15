"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";

const CARGOS = ["presidente", "vicepresidente", "secretario", "vocal", "fiscal"];

export default function ConsejoPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [eid, setEid] = useState<number | null>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMiembro, setEditingMiembro] = useState<any>(null);
  const [form, setForm] = useState({ nombre: "", cargo: "presidente", tipo: "activo" });
  const [saving, setSaving] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "";
  const isAdmin = user?.rol === "administrador" || user?.rol === "superadmin";

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);
    if (u.edificio_id) {
      setEid(u.edificio_id);
      loadMiembros(u.edificio_id);
    }
  }, []);

  async function loadMiembros(edificioId?: number) {
    const id = edificioId ?? eid;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/consejo/${id}`);
      const data = await res.json();
      setMiembros(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingMiembro(null);
    setForm({ nombre: "", cargo: "presidente", tipo: "activo" });
    setShowModal(true);
  }

  function openEdit(m: any) {
    setEditingMiembro(m);
    setForm({ nombre: m.nombre, cargo: m.cargo, tipo: m.tipo });
    setShowModal(true);
  }

  async function save() {
    if (!eid) return;
    setSaving(true);
    try {
      if (editingMiembro) {
        await fetch(`${API}/api/consejo/miembros/${editingMiembro.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch(`${API}/api/consejo/${eid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setShowModal(false);
      loadMiembros();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(m: any) {
    await fetch(`${API}/api/consejo/miembros/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !m.activo }),
    });
    loadMiembros();
  }

  async function deleteMiembro(id: number) {
    if (!confirm("¿Eliminar este miembro del consejo?")) return;
    await fetch(`${API}/api/consejo/miembros/${id}`, { method: "DELETE" });
    loadMiembros();
  }

  const activos = miembros.filter((m) => m.tipo === "activo");
  const suplentes = miembros.filter((m) => m.tipo === "suplente");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Consejo de Administración</h2>
          <p className="text-sm text-gray-500 mt-0.5">Miembros del consejo y sus cargos</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Agregar Miembro
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl py-12 text-center text-gray-400 text-sm">Cargando…</div>
      ) : miembros.length === 0 ? (
        <div className="bg-white border rounded-xl py-12 text-center">
          <div className="text-4xl mb-3">🏛️</div>
          <div className="text-gray-500 text-sm">Sin miembros registrados.</div>
          {isAdmin && (
            <button onClick={openCreate} className="mt-4 text-sm text-primary underline hover:text-primary/80">
              Agregar el primer miembro
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Miembros activos */}
          {activos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Miembros Activos</h3>
              <MiembroTable miembros={activos} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteMiembro} onToggle={toggleActivo} />
            </div>
          )}

          {/* Suplentes */}
          {suplentes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Miembros Suplentes</h3>
              <MiembroTable miembros={suplentes} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteMiembro} onToggle={toggleActivo} />
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editingMiembro ? "Editar Miembro" : "Nuevo Miembro del Consejo"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nombre del miembro"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cargo</label>
                  <select
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CARGOS.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="activo">Activo</option>
                    <option value="suplente">Suplente</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.nombre.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : editingMiembro ? "Guardar cambios" : "Agregar miembro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiembroTable({
  miembros,
  isAdmin,
  onEdit,
  onDelete,
  onToggle,
}: {
  miembros: any[];
  isAdmin: boolean;
  onEdit: (m: any) => void;
  onDelete: (id: number) => void;
  onToggle: (m: any) => void;
}) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cargo</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
            {isAdmin && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {miembros.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{m.nombre}</td>
              <td className="px-4 py-3 text-gray-700 capitalize">{m.cargo}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    m.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"
                  }`}
                >
                  {m.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              {isAdmin && (
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => onEdit(m)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onToggle(m)}
                      className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
                    >
                      {m.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => onDelete(m.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
