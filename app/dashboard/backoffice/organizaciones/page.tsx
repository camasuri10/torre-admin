"use client";

import { useEffect, useState } from "react";
import { organizacionesApi } from "@/lib/api";

interface CrearSAForm {
  nombre: string;
  email: string;
  password: string;
  cedula: string;
  telefono: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Org {
  id: number;
  nombre: string;
  nit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais: string;
  activo: boolean;
  num_edificios: number;
  num_conjuntos: number;
  num_superadmins: number;
  num_usuarios: number;
}

interface OrgDetail extends Org {
  superadmins: { id: number; nombre: string; email: string; telefono?: string; asignacion_activa: boolean }[];
  edificios: { id: number; nombre: string; direccion?: string; conjunto_nombre?: string }[];
}

interface SADisponible {
  id: number;
  nombre: string;
  email: string;
  organizaciones: { id: number; nombre: string }[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrganizacionesPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [detailOrg, setDetailOrg] = useState<OrgDetail | null>(null);
  const [showAssignSA, setShowAssignSA] = useState(false);
  const [saDisponibles, setSADisponibles] = useState<SADisponible[]>([]);

  // Create form
  const [createForm, setCreateForm] = useState({ nombre: "", nit: "", email: "", telefono: "", direccion: "", ciudad: "", pais: "Colombia" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Crear SA modal
  const [showCrearSA, setShowCrearSA] = useState(false);
  const [crearSAForm, setCrearSAForm] = useState<CrearSAForm>({ nombre: "", email: "", password: "", cedula: "", telefono: "" });
  const [crearSASaving, setCrearSASaving] = useState(false);
  const [crearSAError, setCrearSAError] = useState("");

  function load() {
    organizacionesApi.list()
      .then((d) => setOrgs(d.organizaciones))
      .catch(() => setError("Error al cargar organizaciones"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError("");
    try {
      await organizacionesApi.create(createForm);
      setShowCreate(false);
      setCreateForm({ nombre: "", nit: "", email: "", telefono: "", direccion: "", ciudad: "", pais: "Colombia" });
      load();
    } catch (err: any) {
      setSaveError(err?.message ?? "Error al crear");
    } finally { setSaving(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editOrg) return;
    setSaving(true); setSaveError("");
    try {
      await organizacionesApi.update(editOrg.id, {
        nombre: editOrg.nombre, nit: editOrg.nit, email: editOrg.email,
        telefono: editOrg.telefono, direccion: editOrg.direccion,
        ciudad: editOrg.ciudad, activo: editOrg.activo,
      });
      setEditOrg(null);
      load();
    } catch (err: any) {
      setSaveError(err?.message ?? "Error al actualizar");
    } finally { setSaving(false); }
  }

  async function openDetail(org: Org) {
    const d = await organizacionesApi.get(org.id);
    setDetailOrg(d.organizacion);
  }

  async function openAssignSA() {
    const d = await organizacionesApi.superadminsDisponibles();
    setSADisponibles(d.superadmins);
    setShowAssignSA(true);
  }

  async function handleCrearSA(e: React.FormEvent) {
    e.preventDefault();
    if (!detailOrg) return;
    if (!crearSAForm.nombre.trim() || !crearSAForm.email.trim() || !crearSAForm.password.trim()) {
      setCrearSAError("Nombre, email y contraseña son obligatorios.");
      return;
    }
    setCrearSASaving(true); setCrearSAError("");
    try {
      await organizacionesApi.crearYAsignarSA(detailOrg.id, {
        nombre: crearSAForm.nombre.trim(),
        email: crearSAForm.email.trim(),
        password: crearSAForm.password,
        cedula: crearSAForm.cedula || undefined,
        telefono: crearSAForm.telefono || undefined,
      });
      setShowCrearSA(false);
      setCrearSAForm({ nombre: "", email: "", password: "", cedula: "", telefono: "" });
      const d = await organizacionesApi.get(detailOrg.id);
      setDetailOrg(d.organizacion);
      load();
    } catch (err: any) {
      setCrearSAError(err?.message ?? "Error al crear el SuperAdmin.");
    } finally { setCrearSASaving(false); }
  }

  async function handleAssignSA(usuarioId: number) {
    if (!detailOrg) return;
    try {
      await organizacionesApi.asignarSA(detailOrg.id, usuarioId);
      const d = await organizacionesApi.get(detailOrg.id);
      setDetailOrg(d.organizacion);
      setShowAssignSA(false);
    } catch (err: any) {
      alert(err?.message ?? "Error al asignar");
    }
  }

  async function handleQuitarSA(orgId: number, usuarioId: number) {
    if (!confirm("¿Remover este SuperAdmin de la organización?")) return;
    try {
      await organizacionesApi.quitarSA(orgId, usuarioId);
      const d = await organizacionesApi.get(orgId);
      setDetailOrg(d.organizacion);
    } catch (err: any) {
      alert(err?.message ?? "Error");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando organizaciones…</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  const totalActivas = orgs.filter((o) => o.activo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orgs.length} organizaciones · {totalActivas} activas
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + Nueva organización
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: orgs.length, icon: "🏢" },
          { label: "Activas", value: totalActivas, icon: "✅" },
          { label: "Conjuntos", value: orgs.reduce((s, o) => s + o.num_edificios, 0), icon: "🏗️" },
          { label: "SuperAdmins", value: orgs.reduce((s, o) => s + o.num_superadmins, 0), icon: "👤" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Org grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orgs.map((org) => (
          <div
            key={org.id}
            className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${org.activo ? "border-gray-100" : "border-red-100 opacity-75"}`}
          >
            {/* Title */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-900">{org.nombre}</div>
                {org.nit && <div className="text-xs text-gray-400">NIT {org.nit}</div>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${org.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {org.activo ? "Activa" : "Inactiva"}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "Conjuntos", value: org.num_edificios },
                { label: "Agrupaciones", value: org.num_conjuntos },
                { label: "SuperAdmins", value: org.num_superadmins },
                { label: "Usuarios", value: org.num_usuarios },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-lg px-2 py-1.5">
                  <div className="font-semibold text-gray-900">{s.value}</div>
                  <div className="text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => openDetail(org)}
                className="flex-1 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary/20 transition-colors"
              >
                Ver detalle
              </button>
              <button
                onClick={() => { setEditOrg(org); setSaveError(""); }}
                className="flex-1 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Nueva organización" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <Field label="Nombre *" value={createForm.nombre} onChange={(v) => setCreateForm({ ...createForm, nombre: v })} required />
            <Field label="NIT" value={createForm.nit} onChange={(v) => setCreateForm({ ...createForm, nit: v })} />
            <Field label="Email" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} type="email" />
            <Field label="Teléfono" value={createForm.telefono} onChange={(v) => setCreateForm({ ...createForm, telefono: v })} />
            <Field label="Dirección" value={createForm.direccion} onChange={(v) => setCreateForm({ ...createForm, direccion: v })} />
            <Field label="Ciudad" value={createForm.ciudad} onChange={(v) => setCreateForm({ ...createForm, ciudad: v })} />
            <Field label="País" value={createForm.pais} onChange={(v) => setCreateForm({ ...createForm, pais: v })} />
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">{saving ? "Guardando…" : "Crear"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editOrg && (
        <Modal title="Editar organización" onClose={() => setEditOrg(null)}>
          <form onSubmit={handleUpdate} className="space-y-3">
            <Field label="Nombre *" value={editOrg.nombre} onChange={(v) => setEditOrg({ ...editOrg, nombre: v })} required />
            <Field label="NIT" value={editOrg.nit ?? ""} onChange={(v) => setEditOrg({ ...editOrg, nit: v })} />
            <Field label="Email" value={editOrg.email ?? ""} onChange={(v) => setEditOrg({ ...editOrg, email: v })} type="email" />
            <Field label="Teléfono" value={editOrg.telefono ?? ""} onChange={(v) => setEditOrg({ ...editOrg, telefono: v })} />
            <Field label="Dirección" value={editOrg.direccion ?? ""} onChange={(v) => setEditOrg({ ...editOrg, direccion: v })} />
            <Field label="Ciudad" value={editOrg.ciudad ?? ""} onChange={(v) => setEditOrg({ ...editOrg, ciudad: v })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editOrg.activo} onChange={(e) => setEditOrg({ ...editOrg, activo: e.target.checked })} className="rounded" />
              Activa
            </label>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditOrg(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Detail drawer ── */}
      {detailOrg && (
        <Modal title={detailOrg.nombre} onClose={() => { setDetailOrg(null); setShowAssignSA(false); }} wide>
          <div className="space-y-5">
            {/* Info */}
            <div className="text-sm text-gray-600 space-y-1">
              {detailOrg.nit && <div>NIT: <span className="font-medium">{detailOrg.nit}</span></div>}
              {detailOrg.email && <div>Email: <span className="font-medium">{detailOrg.email}</span></div>}
              {detailOrg.telefono && <div>Tel: <span className="font-medium">{detailOrg.telefono}</span></div>}
              {detailOrg.ciudad && <div>Ciudad: <span className="font-medium">{detailOrg.ciudad}, {detailOrg.pais}</span></div>}
            </div>

            {/* SuperAdmins */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">SuperAdmins asignados</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowCrearSA(true); setCrearSAForm({ nombre: "", email: "", password: "", cedula: "", telefono: "" }); setCrearSAError(""); }}
                    className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-medium hover:bg-primary/90"
                  >
                    + Crear SA
                  </button>
                  <button onClick={openAssignSA} className="text-xs text-primary font-medium hover:underline">Asignar existente</button>
                </div>
              </div>
              {detailOrg.superadmins.length === 0 ? (
                <p className="text-xs text-gray-400">Sin SuperAdmins asignados</p>
              ) : (
                <div className="space-y-1.5">
                  {detailOrg.superadmins.map((sa) => (
                    <div key={sa.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{sa.nombre}</div>
                        <div className="text-xs text-gray-400">{sa.email}</div>
                      </div>
                      <button
                        onClick={() => handleQuitarSA(detailOrg.id, sa.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conjuntos */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Conjuntos ({detailOrg.edificios.length})</h3>
              {detailOrg.edificios.length === 0 ? (
                <p className="text-xs text-gray-400">Sin conjuntos registrados</p>
              ) : (
                <div className="space-y-1">
                  {detailOrg.edificios.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      <span>🏘️</span>
                      <span className="font-medium">{e.nombre}</span>
                      {e.conjunto_nombre && <span className="text-xs text-gray-400">({e.conjunto_nombre})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Crear SA modal ── */}
      {showCrearSA && detailOrg && (
        <Modal title={`Crear SuperAdmin → ${detailOrg.nombre}`} onClose={() => setShowCrearSA(false)}>
          <form onSubmit={handleCrearSA} className="space-y-3">
            <Field label="Nombre completo *" value={crearSAForm.nombre} onChange={(v) => setCrearSAForm({ ...crearSAForm, nombre: v })} required />
            <Field label="Email *" value={crearSAForm.email} onChange={(v) => setCrearSAForm({ ...crearSAForm, email: v })} type="email" required />
            <Field label="Contraseña *" value={crearSAForm.password} onChange={(v) => setCrearSAForm({ ...crearSAForm, password: v })} type="password" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cédula" value={crearSAForm.cedula} onChange={(v) => setCrearSAForm({ ...crearSAForm, cedula: v })} />
              <Field label="Teléfono" value={crearSAForm.telefono} onChange={(v) => setCrearSAForm({ ...crearSAForm, telefono: v })} />
            </div>
            {crearSAError && <p className="text-xs text-red-600">{crearSAError}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCrearSA(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={crearSASaving} className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">{crearSASaving ? "Creando…" : "Crear y asignar"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign SA modal ── */}
      {showAssignSA && detailOrg && (
        <Modal title="Asignar SuperAdmin" onClose={() => setShowAssignSA(false)}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {saDisponibles.length === 0 ? (
              <p className="text-sm text-gray-500">No hay SuperAdmins disponibles</p>
            ) : (
              saDisponibles.map((sa) => {
                const yaAsignado = detailOrg.superadmins.some((s) => s.id === sa.id);
                return (
                  <div key={sa.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{sa.nombre}</div>
                      <div className="text-xs text-gray-400">{sa.email}</div>
                      {sa.organizaciones.length > 0 && (
                        <div className="text-xs text-gray-400">{sa.organizaciones.map((o) => o.nombre).join(", ")}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAssignSA(sa.id)}
                      disabled={yaAsignado}
                      className={`text-xs px-3 py-1 rounded-lg font-medium ${yaAsignado ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90"}`}
                    >
                      {yaAsignado ? "Ya asignado" : "Asignar"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}
