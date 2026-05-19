"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatUnidadLabel } from "@/lib/format-unidad";

const CARGOS_FIJOS = ["presidente", "vicepresidente", "secretario", "vocal", "fiscal"];
const CARGOS = [...CARGOS_FIJOS, "otro"];

type FormState = {
  nombre: string;
  cargo: string;
  tipo: string;
  es_propietario: boolean;
  unidad_id: number | null;
  residente_id: number | null;
  cargo_otro: string;
};

const FORM_INIT: FormState = {
  nombre: "",
  cargo: "presidente",
  tipo: "activo",
  es_propietario: true,
  unidad_id: null,
  residente_id: null,
  cargo_otro: "",
};

export default function ConsejoPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [eid, setEid] = useState<number | null>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMiembro, setEditingMiembro] = useState<any>(null);
  const [form, setForm] = useState<FormState>(FORM_INIT);
  const [saving, setSaving] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [residentes, setResidentes] = useState<any[]>([]);

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
      const data = await api.consejo.list(id);
      setMiembros(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnidades(edificioId?: number): Promise<any[]> {
    const id = edificioId ?? eid;
    if (!id) return [];
    const data = await api.consejo.unidades(id);
    const list = Array.isArray(data) ? data : [];
    setUnidades(list);
    return list;
  }

  async function openCreate() {
    setEditingMiembro(null);
    setForm(FORM_INIT);
    setResidentes([]);
    setShowModal(true);
    await loadUnidades();
  }

  async function openEdit(m: any) {
    setEditingMiembro(m);
    const cargo = CARGOS_FIJOS.includes(m.cargo) ? m.cargo : "otro";
    setForm({
      nombre: m.nombre,
      cargo,
      tipo: m.tipo,
      es_propietario: !!m.unidad_id,
      unidad_id: m.unidad_id ?? null,
      residente_id: m.residente_id ?? null,
      cargo_otro: cargo === "otro" ? m.cargo : "",
    });
    setResidentes([]);
    setShowModal(true);
    const uList = await loadUnidades();
    if (m.unidad_id) {
      const unidad = uList.find((u: any) => u.id === m.unidad_id);
      setResidentes(unidad?.residentes ?? []);
    }
  }

  function onUnidadChange(val: string) {
    const unidadId = val ? parseInt(val) : null;
    const unidad = unidades.find((u: any) => u.id === unidadId);
    setResidentes(unidad?.residentes ?? []);
    setForm((f) => ({ ...f, unidad_id: unidadId, residente_id: null, nombre: "" }));
  }

  function onResidenteChange(val: string) {
    const residenteId = val ? parseInt(val) : null;
    const residente = residentes.find((r: any) => r.id === residenteId);
    setForm((f) => ({ ...f, residente_id: residenteId, nombre: residente?.nombre ?? "" }));
  }

  function toggleEsPropietario(checked: boolean) {
    setResidentes([]);
    setForm((f) => ({ ...f, es_propietario: checked, unidad_id: null, residente_id: null, nombre: "" }));
  }

  async function save() {
    if (!eid) return;
    const cargoFinal = form.cargo === "otro" ? form.cargo_otro.trim() : form.cargo;
    if (!form.nombre.trim() || !cargoFinal) return;
    setSaving(true);
    const body = {
      nombre: form.nombre,
      cargo: cargoFinal,
      tipo: form.tipo,
      unidad_id: form.es_propietario ? form.unidad_id : null,
      residente_id: form.es_propietario ? form.residente_id : null,
    };
    try {
      if (editingMiembro) {
        await api.consejo.update(editingMiembro.id, body);
      } else {
        await api.consejo.create(eid, body);
      }
      setShowModal(false);
      loadMiembros();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(m: any) {
    await api.consejo.update(m.id, { activo: !m.activo });
    loadMiembros();
  }

  async function deleteMiembro(id: number) {
    if (!confirm("¿Eliminar este miembro del consejo?")) return;
    await api.consejo.delete(id);
    loadMiembros();
  }

  const activos = miembros.filter((m) => m.tipo === "activo");
  const suplentes = miembros.filter((m) => m.tipo === "suplente");
  const cargoFinal = form.cargo === "otro" ? form.cargo_otro.trim() : form.cargo;
  const canSave = !!form.nombre.trim() && !!cargoFinal;

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
          {activos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Titulares</h3>
              <MiembroTable miembros={activos} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteMiembro} onToggle={toggleActivo} />
            </div>
          )}
          {suplentes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Suplentes</h3>
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

              {/* Checkbox propietario */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.es_propietario}
                  onChange={(e) => toggleEsPropietario(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm font-medium text-gray-700">Es propietario/a de una unidad</span>
              </label>

              {form.es_propietario ? (
                /* Selección unidad + residente */
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unidad *</label>
                    <select
                      value={form.unidad_id ?? ""}
                      onChange={(e) => onUnidadChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Seleccionar unidad…</option>
                      {unidades.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {formatUnidadLabel({ numero: u.numero, piso: u.piso, torre: u.torre })}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.unidad_id && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Persona *</label>
                      {residentes.length === 0 ? (
                        <p className="text-xs text-gray-400 italic px-1">Sin residentes registrados en esta unidad.</p>
                      ) : (
                        <select
                          value={form.residente_id ?? ""}
                          onChange={(e) => onResidenteChange(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Seleccionar persona…</option>
                          {residentes.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {form.nombre && (
                    <p className="text-xs text-gray-500 px-1">
                      Nombre: <span className="font-medium text-gray-800">{form.nombre}</span>
                    </p>
                  )}
                </div>
              ) : (
                /* Nombre libre */
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cargo</label>
                  <select
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value, cargo_otro: "" }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CARGOS.map((c) => (
                      <option key={c} value={c}>
                        {c === "otro" ? "Otro…" : c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
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
                    <option value="activo">Titular</option>
                    <option value="suplente">Suplente</option>
                  </select>
                </div>
              </div>

              {form.cargo === "otro" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Especifique el cargo *</label>
                  <input
                    value={form.cargo_otro}
                    onChange={(e) => setForm((f) => ({ ...f, cargo_otro: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej: tesorero, revisor fiscal…"
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !canSave}
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
              <td className="px-4 py-3 font-medium text-gray-900">
                {m.nombre}
                {m.unidad_numero && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    ({[m.unidad_torre, m.unidad_torre_numero].filter(Boolean).join(" ") || m.unidad_torre} – {m.unidad_numero})
                  </span>
                )}
              </td>
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
