"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { superadminApi, proveedoresApi } from "@/lib/api";

type PageTab = "admins" | "staff";

interface Admin {
  id: number;
  nombre: string;
  email: string;
  cedula: string | null;
  telefono: string | null;
  rol?: string;
  activo: boolean;
  eps?: string | null;
  aseguradora_riesgo?: string | null;
  edificios: { id: number; nombre: string }[];
}

const ROL_COLORS: Record<string, string> = {
  administrador: "bg-blue-100 text-blue-700",
  portero: "bg-yellow-100 text-yellow-700",
  servicios: "bg-teal-100 text-teal-700",
};
const ROL_LABELS: Record<string, string> = {
  administrador: "Administrador",
  portero: "Portero",
  servicios: "Servicios",
};

const TIPOS_DOC = [
  { value: "CC",  label: "CC — Cédula de Ciudadanía" },
  { value: "CE",  label: "CE — Cédula de Extranjería" },
  { value: "TI",  label: "TI — Tarjeta de Identidad" },
  { value: "PA",  label: "PA — Pasaporte" },
  { value: "PEP", label: "PEP — Permiso Especial de Permanencia" },
  { value: "PPT", label: "PPT — Permiso de Protección Temporal" },
  { value: "NIT", label: "NIT" },
  { value: "RC",  label: "RC — Registro Civil" },
];

const emptyForm = {
  nombre: "", email: "", password: "", tipo_documento: "CC", cedula: "", telefono: "",
  rol: "administrador",
  eps: "", aseguradora_riesgo: "", proveedor_id: "",
  edificio_ids: [] as number[],
  asignarEdificio: false,
};

const emptyEdificioRapido = { nombre: "", direccion: "", pisos: 1 };

export default function AdminsPage() {
  const router = useRouter();
  const [pageTab, setPageTab]       = useState<PageTab>("admins");
  const [admins, setAdmins]         = useState<Admin[]>([]);
  const [staff, setStaff]           = useState<Admin[]>([]);
  const [edificios, setEdificios]   = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [form, setForm]             = useState(emptyForm);

  // Quick building creation within admin form
  const [showEdificioRapido, setShowEdificioRapido] = useState(false);
  const [edificioRapidoForm, setEdificioRapidoForm] = useState(emptyEdificioRapido);
  const [edificioRapidoSaving, setEdificioRapidoSaving] = useState(false);
  const [edificioRapidoError, setEdificioRapidoError] = useState("");

  // View modal
  const [viewingAdmin, setViewingAdmin] = useState<Admin | null>(null);

  // Edit modal (personal data + edificios)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editPersonal, setEditPersonal] = useState({ nombre: "", tipo_documento: "CC", cedula: "", telefono: "", eps: "", aseguradora_riesgo: "" });
  const [editEdificios, setEditEdificios] = useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [adminsData, staffData, edData, provData] = await Promise.all([
        superadminApi.admins.list(),
        superadminApi.staff.list(),
        superadminApi.edificios.list(),
        proveedoresApi.list(),
      ]);
      setAdmins(adminsData.admins ?? []);
      setStaff(staffData.staff ?? []);
      setEdificios(edData.edificios ?? []);
      setProveedores(provData.proveedores ?? []);
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
    setEditEdificios((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  }

  function openEdit(admin: Admin) {
    setEditingAdmin(admin);
    setEditPersonal({
      nombre: admin.nombre,
      tipo_documento: (admin as any).tipo_documento ?? "CC",
      cedula: admin.cedula ?? "",
      telefono: admin.telefono ?? "",
      eps: admin.eps ?? "",
      aseguradora_riesgo: admin.aseguradora_riesgo ?? "",
    });
    setEditEdificios(admin.edificios.map((e) => e.id));
    setEditError("");
  }

  async function handleEditSave() {
    if (!editingAdmin) return;
    setEditSaving(true); setEditError("");
    try {
      // Update personal data
      const personalPayload: any = {};
      if (editPersonal.nombre !== editingAdmin.nombre) personalPayload.nombre = editPersonal.nombre;
      if (editPersonal.tipo_documento !== ((editingAdmin as any).tipo_documento ?? "CC")) personalPayload.tipo_documento = editPersonal.tipo_documento;
      if (editPersonal.cedula !== (editingAdmin.cedula ?? "")) personalPayload.cedula = editPersonal.cedula || undefined;
      if (editPersonal.telefono !== (editingAdmin.telefono ?? "")) personalPayload.telefono = editPersonal.telefono || undefined;
      if (editPersonal.eps !== (editingAdmin.eps ?? "")) personalPayload.eps = editPersonal.eps || undefined;
      if (editPersonal.aseguradora_riesgo !== (editingAdmin.aseguradora_riesgo ?? "")) personalPayload.aseguradora_riesgo = editPersonal.aseguradora_riesgo || undefined;

      await Promise.all([
        Object.keys(personalPayload).length > 0
          ? superadminApi.admins.update(editingAdmin.id, personalPayload)
          : Promise.resolve(),
        superadminApi.admins.updateAsignaciones(editingAdmin.id, { edificio_ids: editEdificios, conjunto_ids: [] }),
      ]);
      setEditingAdmin(null);
      loadData();
    } catch { setEditError("Error al guardar los cambios."); }
    finally { setEditSaving(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload: any = {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        cedula: form.cedula || undefined,
        telefono: form.telefono || undefined,
        rol: form.rol,
        eps: form.eps || undefined,
        aseguradora_riesgo: form.aseguradora_riesgo || undefined,
        edificio_ids: form.edificio_ids,
      };
      if (form.rol !== "administrador" && form.proveedor_id) {
        payload.proveedor_id = parseInt(form.proveedor_id);
      }
      await superadminApi.admins.create(payload);
      setShowForm(false);
      setForm(emptyForm);
      setShowEdificioRapido(false);
      loadData();
    } catch { setError("Error al crear. Verifica que el email no esté registrado."); }
    finally { setSaving(false); }
  }

  async function handleCrearEdificioRapido(e: React.FormEvent) {
    e.preventDefault();
    setEdificioRapidoSaving(true); setEdificioRapidoError("");
    try {
      const data = await superadminApi.edificios.create(edificioRapidoForm);
      // Reload edificios and auto-select the new one
      const edData = await superadminApi.edificios.list();
      const nuevosEdificios = edData.edificios ?? [];
      setEdificios(nuevosEdificios);
      if (data?.id) {
        setForm((prev) => ({ ...prev, edificio_ids: [...prev.edificio_ids, data.id] }));
      }
      setShowEdificioRapido(false);
      setEdificioRapidoForm(emptyEdificioRapido);
    } catch { setEdificioRapidoError("Error al crear el edificio."); }
    finally { setEdificioRapidoSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const filteredAdmins = q ? admins.filter((a) => a.nombre.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : admins;
  const filteredStaff  = q ? staff.filter((a) => a.nombre.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q)) : staff;

  const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  if (loading) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Cargando…</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Personal</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona administradores, porteros y staff de servicios</p>
        </div>
        <button
          onClick={() => {
            setForm({ ...emptyForm, rol: pageTab === "admins" ? "administrador" : "portero" });
            setShowForm((v) => !v);
            setError("");
          }}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0">
          {pageTab === "admins" ? "+ Nuevo Administrador" : "+ Nuevo Staff de Servicio"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([["admins", "👤 Administradores", admins.length], ["staff", "🧹 Staff Servicios", staff.length]] as const).map(([t, label, count]) => (
          <button key={t} onClick={() => { setPageTab(t); setShowForm(false); setError(""); }}
            className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              pageTab === t ? "border-b-2 border-primary text-primary" : "text-gray-500 hover:text-gray-800"
            }`}>
            {label}
            <span className={`text-xs rounded-full px-2 py-0.5 ${pageTab === t ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email…"
          className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {pageTab === "admins" ? "Nuevo Administrador" : "Nuevo Staff de Servicio"}
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Rodríguez" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="persona@edificio.co" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label>
              <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol *</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value, proveedor_id: "" })}
                className={INPUT}>
                {pageTab === "admins" ? (
                  <option value="administrador">Administrador</option>
                ) : (
                  <>
                    <option value="portero">Portero / Seguridad</option>
                    <option value="servicios">Servicios Generales</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de documento</label>
              <select value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
                className={INPUT}>
                {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de documento</label>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="79.123.456" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="310 000 0000" className={INPUT} />
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Seguridad social</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">EPS</label>
              <input value={form.eps} onChange={(e) => setForm({ ...form, eps: e.target.value })}
                placeholder="Sanitas, Nueva EPS, Compensar…" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora de riesgo (ARL)</label>
              <input value={form.aseguradora_riesgo} onChange={(e) => setForm({ ...form, aseguradora_riesgo: e.target.value })}
                placeholder="Positiva, Sura, Colmena…" className={INPUT} />
            </div>

            {form.rol !== "administrador" && proveedores.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor asociado (opcional)</label>
                <select value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
                  className={INPUT}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Edificios */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={form.asignarEdificio}
                  onChange={() => setForm({ ...form, asignarEdificio: !form.asignarEdificio, edificio_ids: [] })}
                  className="accent-primary" />
                <span className="text-sm font-medium text-gray-700">¿Asignar a un edificio?</span>
              </label>

              {form.asignarEdificio && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-600">Edificios asignados</label>
                    <button
                      type="button"
                      onClick={() => { setShowEdificioRapido((v) => !v); setEdificioRapidoError(""); }}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      + Crear nuevo edificio
                    </button>
                  </div>

                  {/* Quick building creation */}
                  {showEdificioRapido && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-700 mb-3">Crear edificio rápido</p>
                      <form onSubmit={handleCrearEdificioRapido} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                          <input required value={edificioRapidoForm.nombre}
                            onChange={(e) => setEdificioRapidoForm({ ...edificioRapidoForm, nombre: e.target.value })}
                            placeholder="Torres del Norte" className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
                          <input type="number" min={1} value={edificioRapidoForm.pisos}
                            onChange={(e) => setEdificioRapidoForm({ ...edificioRapidoForm, pisos: parseInt(e.target.value) || 1 })}
                            className={INPUT} />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Dirección *</label>
                          <input required value={edificioRapidoForm.direccion}
                            onChange={(e) => setEdificioRapidoForm({ ...edificioRapidoForm, direccion: e.target.value })}
                            placeholder="Cra 15 #85-32, Bogotá" className={INPUT} />
                        </div>
                        {edificioRapidoError && <p className="sm:col-span-3 text-red-600 text-xs">{edificioRapidoError}</p>}
                        <div className="sm:col-span-3 flex gap-2">
                          <button type="submit" disabled={edificioRapidoSaving}
                            className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
                            {edificioRapidoSaving ? "Creando…" : "Crear y seleccionar"}
                          </button>
                          <button type="button" onClick={() => setShowEdificioRapido(false)}
                            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:text-gray-700">
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {edificios.map((e: any) => (
                      <label key={e.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 cursor-pointer hover:border-primary/30 hover:bg-blue-50/30 transition-colors">
                        <input type="checkbox" checked={form.edificio_ids.includes(e.id)} onChange={() => toggleEdificio(e.id)} className="accent-primary" />
                        <span className="text-sm text-gray-700">{e.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="sm:col-span-2 text-red-600 text-xs">{error}</p>}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                {saving ? "Guardando…" : "Crear"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setShowEdificioRapido(false); }}
                className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View modal */}
      {viewingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">{viewingAdmin.nombre}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${ROL_COLORS[viewingAdmin.rol ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                  {ROL_LABELS[viewingAdmin.rol ?? ""] ?? viewingAdmin.rol}
                </span>
              </div>
              <button onClick={() => setViewingAdmin(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="text-gray-800">{viewingAdmin.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Documento</p>
                  <p className="text-gray-800">{viewingAdmin.cedula ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                  <p className="text-gray-800">{viewingAdmin.telefono ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Estado</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${viewingAdmin.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {viewingAdmin.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">EPS</p>
                  <p className="text-gray-800">{viewingAdmin.eps ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">ARL</p>
                  <p className="text-gray-800">{viewingAdmin.aseguradora_riesgo ?? "—"}</p>
                </div>
              </div>

              {viewingAdmin.edificios?.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-gray-400 mb-1.5">Edificios asignados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingAdmin.edificios.map((e) => (
                      <span key={e.id} className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">{e.nombre}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setViewingAdmin(null); openEdit(viewingAdmin); }}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90">
                  ✏️ Editar
                </button>
                <button onClick={() => setViewingAdmin(null)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Editar personal</h3>
                <p className="text-xs text-gray-500">{editingAdmin.email}</p>
              </div>
              <button onClick={() => { setEditingAdmin(null); setEditError(""); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datos personales</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                  <input value={editPersonal.nombre}
                    onChange={(e) => setEditPersonal({ ...editPersonal, nombre: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de documento</label>
                  <select value={editPersonal.tipo_documento}
                    onChange={(e) => setEditPersonal({ ...editPersonal, tipo_documento: e.target.value })}
                    className={INPUT}>
                    {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número de documento</label>
                  <input value={editPersonal.cedula}
                    onChange={(e) => setEditPersonal({ ...editPersonal, cedula: e.target.value })}
                    placeholder="79.123.456" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input value={editPersonal.telefono}
                    onChange={(e) => setEditPersonal({ ...editPersonal, telefono: e.target.value })}
                    placeholder="310 000 0000" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">EPS</label>
                  <input value={editPersonal.eps}
                    onChange={(e) => setEditPersonal({ ...editPersonal, eps: e.target.value })}
                    placeholder="Sanitas, Nueva EPS…" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ARL</label>
                  <input value={editPersonal.aseguradora_riesgo}
                    onChange={(e) => setEditPersonal({ ...editPersonal, aseguradora_riesgo: e.target.value })}
                    placeholder="Positiva, Sura…" className={INPUT} />
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Edificios asignados</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {edificios.map((e: any) => (
                  <label key={e.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 cursor-pointer hover:border-primary/30 hover:bg-blue-50/30 transition-colors">
                    <input type="checkbox" checked={editEdificios.includes(e.id)} onChange={() => toggleEditEdificio(e.id)} className="accent-primary" />
                    <span className="text-sm text-gray-700">{e.nombre}</span>
                  </label>
                ))}
              </div>

              {editError && <p className="text-red-600 text-xs">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleEditSave} disabled={editSaving}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {editSaving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button onClick={() => { setEditingAdmin(null); setEditError(""); }}
                  className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 border border-gray-200">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && !showForm && !editingAdmin && <p className="text-red-600 text-sm">{error}</p>}

      {/* List */}
      <PersonalTable
        list={pageTab === "admins" ? filteredAdmins : filteredStaff}
        emptyMsg={q ? "Sin resultados." : pageTab === "admins" ? "No hay administradores." : "No hay staff registrado."}
        onEdit={openEdit}
        onView={setViewingAdmin}
        showRol={pageTab === "staff"}
      />
    </div>
  );
}

function PersonalTable({ list, emptyMsg, onEdit, onView, showRol }: {
  list: any[];
  emptyMsg: string;
  onEdit: (a: any) => void;
  onView: (a: any) => void;
  showRol?: boolean;
}) {
  const ROL_COLORS: Record<string, string> = {
    administrador: "bg-blue-100 text-blue-700",
    portero: "bg-yellow-100 text-yellow-700",
    servicios: "bg-teal-100 text-teal-700",
  };
  const ROL_LABELS: Record<string, string> = {
    administrador: "Administrador",
    portero: "Portero",
    servicios: "Servicios",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {list.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">{emptyMsg}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
              {showRol && <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Rol</th>}
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Seguridad social</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Edificios</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {list.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 cursor-pointer" onClick={() => onView(a)}>
                  <div className="font-medium text-gray-900 hover:text-primary">{a.nombre}</div>
                  {a.cedula && <div className="text-xs text-gray-400">{a.cedula}</div>}
                </td>
                <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{a.email}</td>
                {showRol && (
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROL_COLORS[a.rol] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROL_LABELS[a.rol] ?? a.rol}
                    </span>
                  </td>
                )}
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  {a.eps || a.aseguradora_riesgo ? (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {a.eps && <div>EPS: {a.eps}</div>}
                      {a.aseguradora_riesgo && <div>ARL: {a.aseguradora_riesgo}</div>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {(a.edificios ?? []).length === 0 ? (
                      <span className="text-xs text-gray-400 italic">Sin edificio</span>
                    ) : a.edificios.map((e: any) => (
                      <span key={e.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{e.nombre}</span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {a.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => onEdit(a)} className="text-xs text-primary font-medium hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
