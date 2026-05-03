"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi, api } from "@/lib/api";

interface Modulo {
  clave: string;
  nombre: string;
  icono: string;
  activo: boolean;
}

interface Unidad {
  id: number;
  numero: string;
  piso: number;
  area_m2: number | null;
  coeficiente: number | null;
  residente_nombre: string | null;
  tipo_ocupacion: string | null;
}

type Tab = "modulos" | "unidades";

export default function EdificioGestionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const edificioId = parseInt(id);

  const [tab, setTab] = useState<Tab>("modulos");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Módulos
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Unidades
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadesLoading, setUnidadesLoading] = useState(false);
  const [showAddUnidad, setShowAddUnidad] = useState(false);
  const [addForm, setAddForm] = useState({ numero: "", piso: 1, area_m2: "", coeficiente: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [editUnidad, setEditUnidad] = useState<Unidad | null>(null);
  const [editUForm, setEditUForm] = useState({ numero: "", piso: 1, area_m2: "", coeficiente: "" });
  const [editUSaving, setEditUSaving] = useState(false);
  const [editUError, setEditUError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }

    Promise.allSettled([
      superadminApi.edificios.getModulos(edificioId),
      superadminApi.edificios.list(),
    ]).then(([modulosRes, listRes]) => {
      if (modulosRes.status === "fulfilled") setModulos(modulosRes.value.modulos);
      if (listRes.status === "fulfilled") {
        const ed = listRes.value.edificios.find((e: any) => e.id === edificioId);
        if (ed) setNombre(ed.nombre);
      }
    }).catch(() => setError("Error al cargar datos del edificio"))
      .finally(() => setLoading(false));
  }, [router, edificioId]);

  async function loadUnidades() {
    setUnidadesLoading(true);
    try {
      const data = await api.edificios.unidades(edificioId);
      setUnidades(data);
    } catch {
      setError("Error al cargar unidades");
    } finally {
      setUnidadesLoading(false);
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === "unidades" && unidades.length === 0) loadUnidades();
  }

  function toggleModulo(clave: string) {
    setModulos((prev) =>
      prev.map((m) => m.clave === clave ? { ...m, activo: !m.activo } : m)
    );
    setSaved(false);
  }

  async function handleSaveModulos() {
    setSaving(true);
    setError("");
    try {
      await superadminApi.edificios.updateModulos(
        edificioId,
        modulos.map((m) => ({ clave: m.clave, activo: m.activo }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Error al guardar los módulos");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUnidad(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    setAddError("");
    try {
      await api.edificios.createUnidad(edificioId, {
        numero: addForm.numero,
        piso: addForm.piso,
        area_m2: addForm.area_m2 ? parseFloat(addForm.area_m2) : undefined,
        coeficiente: addForm.coeficiente ? parseFloat(addForm.coeficiente) : undefined,
      });
      setAddForm({ numero: "", piso: 1, area_m2: "", coeficiente: "" });
      setShowAddUnidad(false);
      loadUnidades();
    } catch {
      setAddError("Error al crear la unidad");
    } finally {
      setAddSaving(false);
    }
  }

  function openEditUnidad(u: Unidad) {
    setEditUnidad(u);
    setEditUForm({
      numero: u.numero,
      piso: u.piso,
      area_m2: u.area_m2 != null ? String(u.area_m2) : "",
      coeficiente: u.coeficiente != null ? String(u.coeficiente) : "",
    });
    setEditUError("");
  }

  async function handleEditUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!editUnidad) return;
    setEditUSaving(true);
    setEditUError("");
    try {
      await api.edificios.updateUnidad(edificioId, editUnidad.id, {
        numero: editUForm.numero,
        piso: editUForm.piso,
        area_m2: editUForm.area_m2 ? parseFloat(editUForm.area_m2) : undefined,
        coeficiente: editUForm.coeficiente ? parseFloat(editUForm.coeficiente) : undefined,
      });
      setEditUnidad(null);
      loadUnidades();
    } catch {
      setEditUError("Error al guardar los cambios");
    } finally {
      setEditUSaving(false);
    }
  }

  async function handleDeleteUnidad(u: Unidad) {
    if (!confirm(`¿Eliminar la unidad ${u.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.edificios.deleteUnidad(edificioId, u.id);
      loadUnidades();
    } catch (err: any) {
      const msg = err?.message?.includes("residentes activos")
        ? "No se puede eliminar: la unidad tiene residentes activos."
        : "Error al eliminar la unidad.";
      alert(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  const modulosActivos = modulos.filter((m) => m.activo).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/superadmin/edificios" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
          ← Edificios
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">{nombre || `Edificio #${edificioId}`}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {modulosActivos} de {modulos.length} módulos activos · {unidades.length > 0 ? `${unidades.length} unidades` : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["modulos", "unidades"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "modulos" ? "Módulos" : "Unidades"}
          </button>
        ))}
      </div>

      {/* Módulos tab */}
      {tab === "modulos" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Módulos disponibles</h3>
          <div className="space-y-3">
            {modulos.map((m) => (
              <label
                key={m.clave}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.icono}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{m.nombre}</div>
                    <div className="text-xs text-gray-400">{m.clave}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleModulo(m.clave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    m.activo ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      m.activo ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>

          {error && <p className="mt-3 text-red-600 text-xs">{error}</p>}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveModulos}
              disabled={saving}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {saved && (
              <span className="text-green-600 text-sm font-medium">✓ Guardado correctamente</span>
            )}
          </div>
        </div>
      )}

      {/* Unidades tab */}
      {tab === "unidades" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {unidadesLoading ? "Cargando…" : `${unidades.length} unidad${unidades.length !== 1 ? "es" : ""}`}
            </p>
            <button
              onClick={() => { setShowAddUnidad((v) => !v); setAddError(""); }}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {showAddUnidad ? "✕ Cancelar" : "+ Agregar unidad"}
            </button>
          </div>

          {/* Add unit form */}
          {showAddUnidad && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Nueva unidad</h4>
              <form onSubmit={handleAddUnidad} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número / nombre</label>
                  <input
                    required value={addForm.numero}
                    onChange={(e) => setAddForm({ ...addForm, numero: e.target.value })}
                    placeholder="101"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Piso</label>
                  <input
                    type="number" min={1} value={addForm.piso}
                    onChange={(e) => setAddForm({ ...addForm, piso: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Área m² (opcional)</label>
                  <input
                    type="number" step="0.01" min={0} value={addForm.area_m2}
                    onChange={(e) => setAddForm({ ...addForm, area_m2: e.target.value })}
                    placeholder="75.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coeficiente (opcional)</label>
                  <input
                    type="number" step="0.0001" min={0} value={addForm.coeficiente}
                    onChange={(e) => setAddForm({ ...addForm, coeficiente: e.target.value })}
                    placeholder="0.0250"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {addError && <p className="col-span-2 text-red-600 text-xs">{addError}</p>}
                <div className="col-span-2 flex gap-3">
                  <button type="submit" disabled={addSaving}
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

          {/* Units table */}
          {unidadesLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando unidades…</div>
          ) : unidades.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No hay unidades registradas. Agrega la primera.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidad</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Piso</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Área</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Coef.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Residente</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unidades.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.numero}</td>
                      <td className="px-4 py-3 text-gray-600">{u.piso}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {u.area_m2 != null ? `${u.area_m2} m²` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {u.coeficiente != null ? u.coeficiente : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {u.residente_nombre ? (
                          <span className="text-gray-700">{u.residente_nombre}
                            <span className="ml-1 text-xs text-gray-400">({u.tipo_ocupacion})</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin residente</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => openEditUnidad(u)}
                            className="text-xs text-primary hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUnidad(u)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Eliminar
                          </button>
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

      {/* Edit unit modal */}
      {editUnidad && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Editar unidad {editUnidad.numero}</h3>
              <button onClick={() => setEditUnidad(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onSubmit={handleEditUnidad} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número / nombre</label>
                <input
                  required value={editUForm.numero}
                  onChange={(e) => setEditUForm({ ...editUForm, numero: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Piso</label>
                <input
                  type="number" min={1} value={editUForm.piso}
                  onChange={(e) => setEditUForm({ ...editUForm, piso: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Área m²</label>
                <input
                  type="number" step="0.01" min={0} value={editUForm.area_m2}
                  onChange={(e) => setEditUForm({ ...editUForm, area_m2: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coeficiente</label>
                <input
                  type="number" step="0.0001" min={0} value={editUForm.coeficiente}
                  onChange={(e) => setEditUForm({ ...editUForm, coeficiente: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
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
