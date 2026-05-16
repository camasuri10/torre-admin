"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const ROL_LABELS: Record<string, string> = {
  superadmin: "Super Administrador",
  backoffice: "Backoffice",
};

const ROL_COLORS: Record<string, string> = {
  superadmin: "bg-blue-100 text-blue-700",
  backoffice: "bg-purple-100 text-purple-700",
};

type BoUser = {
  id: number;
  nombre: string;
  cedula: string | null;
  email: string;
  telefono: string | null;
  rol: string;
  activo: boolean;
  created_at: string;
};

type FormData = {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  password: string;
  rol: "superadmin" | "backoffice";
};

const EMPTY_FORM: FormData = { nombre: "", cedula: "", email: "", telefono: "", password: "", rol: "superadmin" };

export default function BackofficeUsuariosPage() {
  const [usuarios, setUsuarios] = useState<BoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<BoUser | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDesactivar, setConfirmDesactivar] = useState<BoUser | null>(null);

  function loadUsuarios() {
    setLoading(true);
    api.backoffice.usuarios.list()
      .then((data: any) => setUsuarios(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsuarios(); }, []);

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(u: BoUser) {
    setEditUser(u);
    setForm({ nombre: u.nombre, cedula: u.cedula ?? "", email: u.email, telefono: u.telefono ?? "", password: "", rol: u.rol as any });
    setError("");
    setShowModal(true);
  }

  const [saCreatedWarning, setSaCreatedWarning] = useState(false);

  async function handleSave() {
    if (!form.nombre.trim() || !form.email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }
    if (!editUser && !form.password.trim()) {
      setError("La contraseña es obligatoria al crear un usuario.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editUser) {
        await api.backoffice.usuarios.update(editUser.id, {
          nombre: form.nombre,
          cedula: form.cedula || undefined,
          email: form.email,
          telefono: form.telefono || undefined,
        });
      } else {
        await api.backoffice.usuarios.create({
          nombre: form.nombre,
          cedula: form.cedula || undefined,
          email: form.email,
          telefono: form.telefono || undefined,
          password: form.password,
          rol: form.rol,
        });
        if (form.rol === "superadmin") {
          setSaCreatedWarning(true);
        }
      }
      setShowModal(false);
      loadUsuarios();
    } catch (e: any) {
      const msg = e.message ?? "";
      const detail = msg.match(/"detail":"([^"]+)"/)?.[1] ?? msg;
      setError(detail || "Error al guardar. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDesactivar(u: BoUser) {
    try {
      await api.backoffice.usuarios.desactivar(u.id);
      setConfirmDesactivar(null);
      loadUsuarios();
    } catch (e: any) {
      alert("Error al desactivar usuario.");
    }
  }

  const activos = usuarios.filter((u) => u.activo);
  const inactivos = usuarios.filter((u) => !u.activo);

  return (
    <div className="space-y-6">
      {/* Warning SA sin org */}
      {saCreatedWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">SuperAdmin creado — asígnalo a una organización</p>
            <p className="text-sm text-amber-700 mt-0.5">
              El SuperAdmin no puede iniciar sesión hasta ser asignado a una organización.
              Ve a <strong>Organizaciones</strong>, abre el detalle de la org y usa <em>Crear SA</em> o <em>Asignar existente</em>.
            </p>
          </div>
          <button onClick={() => setSaCreatedWarning(false)} className="text-amber-500 hover:text-amber-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-gray-500 text-sm mt-1">Administra Super Admins y usuarios Backoffice</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <span>+</span> Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{activos.length}</div>
          <div className="text-xs text-gray-500 mt-1">Usuarios activos</div>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 text-center">
          <div className="text-3xl font-bold text-blue-700">{activos.filter((u) => u.rol === "superadmin").length}</div>
          <div className="text-xs text-blue-600 mt-1">Super Admins</div>
        </div>
        <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4 text-center">
          <div className="text-3xl font-bold text-purple-700">{activos.filter((u) => u.rol === "backoffice").length}</div>
          <div className="text-xs text-purple-600 mt-1">Backoffice</div>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cédula</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...activos, ...inactivos].map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.activo ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                          {u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{u.nombre}</div>
                          <div className="text-xs text-gray-400">{u.telefono ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.cedula ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROL_COLORS[u.rol] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROL_LABELS[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("es-CO") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {u.activo && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmDesactivar(u)}
                            className="text-xs text-red-500 hover:underline font-medium"
                          >
                            Desactivar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {activos.length === 0 && inactivos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">
                      No hay usuarios registrados aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editUser ? "Editar usuario" : "Nuevo usuario"}</h3>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Ej: Carlos Suárez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cédula</label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="+57 300 000 0000"
                  />
                </div>
              </div>
              {!editUser && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rol *</label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value as any })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="superadmin">Super Administrador</option>
                      <option value="backoffice">Backoffice</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando…" : editUser ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm desactivar */}
      {confirmDesactivar && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="font-semibold text-gray-900 mb-2">¿Desactivar usuario?</h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmDesactivar.nombre} ya no podrá iniciar sesión. Esta acción se puede revertir editando el usuario en la base de datos.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmDesactivar(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDesactivar(confirmDesactivar)}
                className="px-5 py-2 bg-red-500 text-white text-sm rounded-xl hover:bg-red-600"
              >
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
