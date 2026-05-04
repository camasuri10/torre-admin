"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi, api } from "@/lib/api";

interface Modulo  { clave: string; nombre: string; icono: string; activo: boolean; }
interface Torre   { id: number; nombre: string; numero: string | null; pisos: number | null; total_unidades: number; activo: boolean; }
interface Unidad  { id: number; numero: string; piso: number | null; area_m2: number | null; coeficiente: number | null; residente_nombre: string | null; tipo_ocupacion: string | null; torre_nombre?: string | null; }

type Tab = "modulos" | "torres" | "unidades";

const emptyTorreForm = { nombre: "", numero: "", pisos: "" };
const emptyUnidadForm = { numero: "", piso: 1, tipo: "apartamento", area_m2: "", coeficiente: "", torre_id: "" };

export default function EdificioGestionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const edificioId = parseInt(id);

  const [tab, setTab]       = useState<Tab>("modulos");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // ── Módulos ──────────────────────────────────────────────────────────────────
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // ── Torres ───────────────────────────────────────────────────────────────────
  const [torres, setTorres]               = useState<Torre[]>([]);
  const [torresLoading, setTorresLoading] = useState(false);
  const [showAddTorre, setShowAddTorre]   = useState(false);
  const [torreForm, setTorreForm]         = useState(emptyTorreForm);
  const [torreSaving, setTorreSaving]     = useState(false);
  const [torreError, setTorreError]       = useState("");
  const [editTorre, setEditTorre]         = useState<Torre | null>(null);
  const [editTForm, setEditTForm]         = useState(emptyTorreForm);
  const [editTSaving, setEditTSaving]     = useState(false);
  const [editTError, setEditTError]       = useState("");

  // ── Unidades ─────────────────────────────────────────────────────────────────
  const [unidades, setUnidades]               = useState<Unidad[]>([]);
  const [unidadesLoading, setUnidadesLoading] = useState(false);
  const [filterTorreId, setFilterTorreId]     = useState<number | undefined>(undefined);
  const [showAddUnidad, setShowAddUnidad]     = useState(false);
  const [addForm, setAddForm]                 = useState(emptyUnidadForm);
  const [addSaving, setAddSaving]             = useState(false);
  const [addError, setAddError]               = useState("");
  const [editUnidad, setEditUnidad]           = useState<Unidad | null>(null);
  const [editUForm, setEditUForm]             = useState({ numero: "", piso: 1, area_m2: "", coeficiente: "" });
  const [editUSaving, setEditUSaving]         = useState(false);
  const [editUError, setEditUError]           = useState("");

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }

    Promise.allSettled([
      superadminApi.edificios.getModulos(edificioId),
      superadminApi.edificios.list(),
    ]).then(([modulosRes, listRes]) => {
      if (modulosRes.status === "fulfilled") setModulos(modulosRes.value.modulos);
      if (listRes.status === "fulfilled") {
        const ed = listRes.value.edificios?.find((e: any) => e.id === edificioId);
        if (ed) setNombre(ed.nombre);
      }
    }).catch(() => setError("Error al cargar datos del edificio"))
      .finally(() => setLoading(false));
  }, [router, edificioId]);

  // ── Torres ───────────────────────────────────────────────────────────────────
  const loadTorres = useCallback(async () => {
    setTorresLoading(true);
    try {
      const data = await api.edificios.torres.list(edificioId);
      setTorres(data?.torres ?? data ?? []);
    } catch { setError("Error al cargar torres"); }
    finally { setTorresLoading(false); }
  }, [edificioId]);

  // ── Unidades ─────────────────────────────────────────────────────────────────
  const loadUnidades = useCallback(async (torreId?: number) => {
    setUnidadesLoading(true);
    try {
      const data = await api.edificios.unidades(edificioId, torreId);
      setUnidades(data ?? []);
    } catch { setError("Error al cargar unidades"); }
    finally { setUnidadesLoading(false); }
  }, [edificioId]);

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === "torres" && torres.length === 0) loadTorres();
    if (t === "unidades" && unidades.length === 0) loadUnidades();
  }

  // ── Módulos ───────────────────────────────────────────────────────────────────
  function toggleModulo(clave: string) {
    setModulos((prev) => prev.map((m) => m.clave === clave ? { ...m, activo: !m.activo } : m));
    setSaved(false);
  }

  async function handleSaveModulos() {
    setSaving(true); setError("");
    try {
      await superadminApi.edificios.updateModulos(edificioId, modulos.map((m) => ({ clave: m.clave, activo: m.activo })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError("Error al guardar los módulos"); }
    finally { setSaving(false); }
  }

  // ── Torres CRUD ───────────────────────────────────────────────────────────────
  async function handleAddTorre(e: React.FormEvent) {
    e.preventDefault();
    setTorreSaving(true); setTorreError("");
    try {
      await api.edificios.torres.create(edificioId, {
        nombre: torreForm.nombre,
        numero: torreForm.numero || undefined,
        pisos: torreForm.pisos ? parseInt(torreForm.pisos) : undefined,
      });
      setTorreForm(emptyTorreForm);
      setShowAddTorre(false);
      loadTorres();
    } catch { setTorreError("Error al crear la torre"); }
    finally { setTorreSaving(false); }
  }

  function openEditTorre(t: Torre) {
    setEditTorre(t);
    setEditTForm({ nombre: t.nombre, numero: t.numero ?? "", pisos: t.pisos != null ? String(t.pisos) : "" });
    setEditTError("");
  }

  async function handleEditTorre(e: React.FormEvent) {
    e.preventDefault();
    if (!editTorre) return;
    setEditTSaving(true); setEditTError("");
    try {
      await api.edificios.torres.update(edificioId, editTorre.id, {
        nombre: editTForm.nombre,
        numero: editTForm.numero || undefined,
        pisos: editTForm.pisos ? parseInt(editTForm.pisos) : undefined,
      });
      setEditTorre(null);
      loadTorres();
    } catch { setEditTError("Error al guardar los cambios"); }
    finally { setEditTSaving(false); }
  }

  async function handleDeleteTorre(t: Torre) {
    if (!confirm(`¿Eliminar la torre "${t.nombre}"? No se puede deshacer.`)) return;
    try {
      await api.edificios.torres.delete(edificioId, t.id);
      loadTorres();
    } catch (err: any) {
      const msg = err?.message?.includes("unidades activas")
        ? "No se puede eliminar: la torre tiene unidades activas."
        : "Error al eliminar la torre.";
      alert(msg);
    }
  }

  // ── Unidades CRUD ─────────────────────────────────────────────────────────────
  async function handleAddUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.torre_id) { setAddError("Debe seleccionar una torre"); return; }
    setAddSaving(true); setAddError("");
    try {
      await api.edificios.createUnidad(edificioId, {
        torre_id: parseInt(addForm.torre_id),
        numero: addForm.numero,
        piso: addForm.piso,
        tipo: addForm.tipo,
        area_m2: addForm.area_m2 ? parseFloat(addForm.area_m2) : undefined,
        coeficiente: addForm.coeficiente ? parseFloat(addForm.coeficiente) : undefined,
      });
      setAddForm(emptyUnidadForm);
      setShowAddUnidad(false);
      loadUnidades(filterTorreId);
    } catch { setAddError("Error al crear la unidad"); }
    finally { setAddSaving(false); }
  }

  function openEditUnidad(u: Unidad) {
    setEditUnidad(u);
    setEditUForm({ numero: u.numero, piso: u.piso ?? 1, area_m2: u.area_m2 != null ? String(u.area_m2) : "", coeficiente: u.coeficiente != null ? String(u.coeficiente) : "" });
    setEditUError("");
  }

  async function handleEditUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!editUnidad) return;
    setEditUSaving(true); setEditUError("");
    try {
      await api.edificios.updateUnidad(edificioId, editUnidad.id, {
        numero: editUForm.numero,
        piso: editUForm.piso,
        area_m2: editUForm.area_m2 ? parseFloat(editUForm.area_m2) : undefined,
        coeficiente: editUForm.coeficiente ? parseFloat(editUForm.coeficiente) : undefined,
      });
      setEditUnidad(null);
      loadUnidades(filterTorreId);
    } catch { setEditUError("Error al guardar los cambios"); }
    finally { setEditUSaving(false); }
  }

  async function handleDeleteUnidad(u: Unidad) {
    if (!confirm(`¿Eliminar la unidad ${u.numero}?`)) return;
    try {
      await api.edificios.deleteUnidad(edificioId, u.id);
      loadUnidades(filterTorreId);
    } catch (err: any) {
      alert(err?.message?.includes("residentes activos")
        ? "No se puede eliminar: la unidad tiene residentes activos."
        : "Error al eliminar la unidad.");
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Cargando…</p></div>;
  }

  const modulosActivos = modulos.filter((m) => m.activo).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/superadmin/edificios" className="text-gray-400 hover:text-gray-600 transition-colors text-sm inline-block">
        ← Edificios
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900">{nombre || `Edificio #${edificioId}`}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {modulosActivos} de {modulos.length} módulos activos
          {torres.length > 0 && ` · ${torres.length} torre${torres.length !== 1 ? "s" : ""}`}
          {unidades.length > 0 && ` · ${unidades.length} unidades`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["modulos", "torres", "unidades"] as Tab[]).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "modulos" ? "Módulos" : t === "torres" ? "Torres" : "Unidades"}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Módulos tab ──────────────────────────────────────────────────────── */}
      {tab === "modulos" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Módulos disponibles</h3>
          <div className="space-y-3">
            {modulos.map((m) => (
              <label key={m.clave}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.icono}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{m.nombre}</div>
                    <div className="text-xs text-gray-400">{m.clave}</div>
                  </div>
                </div>
                <button type="button" onClick={() => toggleModulo(m.clave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${m.activo ? "bg-primary" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${m.activo ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={handleSaveModulos} disabled={saving}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">✓ Guardado correctamente</span>}
          </div>
        </div>
      )}

      {/* ── Torres tab ───────────────────────────────────────────────────────── */}
      {tab === "torres" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {torresLoading ? "Cargando…" : `${torres.length} torre${torres.length !== 1 ? "s" : ""}`}
            </p>
            <button onClick={() => { setShowAddTorre((v) => !v); setTorreError(""); }}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              {showAddTorre ? "✕ Cancelar" : "+ Agregar torre"}
            </button>
          </div>

          {showAddTorre && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Nueva torre</h4>
              <form onSubmit={handleAddTorre} className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input required value={torreForm.nombre}
                    onChange={(e) => setTorreForm({ ...torreForm, nombre: e.target.value })}
                    placeholder="Torre A"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número / letra</label>
                  <input value={torreForm.numero}
                    onChange={(e) => setTorreForm({ ...torreForm, numero: e.target.value })}
                    placeholder="A"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
                  <input type="number" min={1} value={torreForm.pisos}
                    onChange={(e) => setTorreForm({ ...torreForm, pisos: e.target.value })}
                    placeholder="10"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {torreError && <p className="col-span-3 text-red-600 text-xs">{torreError}</p>}
                <div className="col-span-3 flex gap-3">
                  <button type="submit" disabled={torreSaving}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                    {torreSaving ? "Guardando…" : "Crear torre"}
                  </button>
                  <button type="button" onClick={() => setShowAddTorre(false)}
                    className="border border-gray-200 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {torresLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando torres…</div>
          ) : torres.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No hay torres registradas. Crea la primera para agregar unidades.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">N.°</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Pisos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {torres.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.numero ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.pisos ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{t.total_unidades}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button onClick={() => openEditTorre(t)} className="text-xs text-primary hover:underline">Editar</button>
                          <button onClick={() => handleDeleteTorre(t)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Unidades tab ─────────────────────────────────────────────────────── */}
      {tab === "unidades" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">
                {unidadesLoading ? "Cargando…" : `${unidades.length} unidad${unidades.length !== 1 ? "es" : ""}`}
              </p>
              {torres.length > 0 && (
                <select
                  value={filterTorreId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value) : undefined;
                    setFilterTorreId(v);
                    loadUnidades(v);
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Todas las torres</option>
                  {torres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              )}
            </div>
            <button onClick={() => { setShowAddUnidad((v) => !v); setAddError(""); }}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              {showAddUnidad ? "✕ Cancelar" : "+ Agregar unidad"}
            </button>
          </div>

          {showAddUnidad && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Nueva unidad</h4>
              {torres.length === 0 && (
                <p className="text-sm text-amber-600 mb-3">Primero debes crear al menos una torre en la pestaña Torres.</p>
              )}
              <form onSubmit={handleAddUnidad} className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Torre *</label>
                  <select required value={addForm.torre_id}
                    onChange={(e) => setAddForm({ ...addForm, torre_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Seleccionar torre…</option>
                    {torres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número / nombre *</label>
                  <input required value={addForm.numero}
                    onChange={(e) => setAddForm({ ...addForm, numero: e.target.value })}
                    placeholder="101"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Piso</label>
                  <input type="number" min={1} value={addForm.piso}
                    onChange={(e) => setAddForm({ ...addForm, piso: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select value={addForm.tipo} onChange={(e) => setAddForm({ ...addForm, tipo: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="apartamento">Apartamento</option>
                    <option value="local">Local</option>
                    <option value="parqueadero">Parqueadero</option>
                    <option value="bodega">Bodega</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Área m²</label>
                  <input type="number" step="0.01" min={0} value={addForm.area_m2}
                    onChange={(e) => setAddForm({ ...addForm, area_m2: e.target.value })}
                    placeholder="75.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coeficiente</label>
                  <input type="number" step="0.0001" min={0} value={addForm.coeficiente}
                    onChange={(e) => setAddForm({ ...addForm, coeficiente: e.target.value })}
                    placeholder="0.0250"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {addError && <p className="col-span-2 text-red-600 text-xs">{addError}</p>}
                <div className="col-span-2 flex gap-3">
                  <button type="submit" disabled={addSaving || torres.length === 0}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                    {addSaving ? "Guardando…" : "Crear unidad"}
                  </button>
                  <button type="button" onClick={() => setShowAddUnidad(false)}
                    className="border border-gray-200 px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {unidadesLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando unidades…</div>
          ) : unidades.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No hay unidades registradas. Agrega la primera.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidad</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Torre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Piso</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Área</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Residente</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unidades.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.numero}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.torre_nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.piso ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{u.area_m2 != null ? `${u.area_m2} m²` : "—"}</td>
                      <td className="px-4 py-3">
                        {u.residente_nombre ? (
                          <span className="text-gray-700">{u.residente_nombre}
                            <span className="ml-1 text-xs text-gray-400">({u.tipo_ocupacion})</span>
                          </span>
                        ) : <span className="text-gray-400 text-xs">Sin residente</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button onClick={() => openEditUnidad(u)} className="text-xs text-primary hover:underline">Editar</button>
                          <button onClick={() => handleDeleteUnidad(u)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit torre modal */}
      {editTorre && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Editar torre</h3>
              <button onClick={() => setEditTorre(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onSubmit={handleEditTorre} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input required value={editTForm.nombre}
                  onChange={(e) => setEditTForm({ ...editTForm, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número / letra</label>
                <input value={editTForm.numero}
                  onChange={(e) => setEditTForm({ ...editTForm, numero: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pisos</label>
                <input type="number" min={1} value={editTForm.pisos}
                  onChange={(e) => setEditTForm({ ...editTForm, pisos: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {editTError && <p className="col-span-2 text-red-600 text-xs">{editTError}</p>}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={editTSaving}
                  className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {editTSaving ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setEditTorre(null)}
                  className="flex-1 border border-gray-200 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit unidad modal */}
      {editUnidad && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Editar unidad {editUnidad.numero}</h3>
              <button onClick={() => setEditUnidad(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onSubmit={handleEditUnidad} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número *</label>
                <input required value={editUForm.numero}
                  onChange={(e) => setEditUForm({ ...editUForm, numero: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Piso</label>
                <input type="number" min={1} value={editUForm.piso}
                  onChange={(e) => setEditUForm({ ...editUForm, piso: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Área m²</label>
                <input type="number" step="0.01" min={0} value={editUForm.area_m2}
                  onChange={(e) => setEditUForm({ ...editUForm, area_m2: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coeficiente</label>
                <input type="number" step="0.0001" min={0} value={editUForm.coeficiente}
                  onChange={(e) => setEditUForm({ ...editUForm, coeficiente: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {editUError && <p className="col-span-2 text-red-600 text-xs">{editUError}</p>}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={editUSaving}
                  className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {editUSaving ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setEditUnidad(null)}
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
