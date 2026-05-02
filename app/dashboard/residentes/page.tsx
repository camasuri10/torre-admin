"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;

type Residente = {
  id: number;
  nombre: string;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  rol: string;
  tipo_ocupacion: string | null;
  unidad_numero: string | null;
  edificio_nombre: string | null;
};

type NuevoResidente = {
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  rol: string;
  password: string;
};

export default function ResidentesPage() {
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState("");
  const [form, setForm]             = useState<NuevoResidente>({ nombre: "", cedula: "", email: "", telefono: "", rol: "propietario", password: "" });

  async function load() {
    try {
      const data = await api.usuarios.list({ edificio_id: EDIFICIO_ID });
      setResidentes(data);
    } catch (err) {
      console.error("Error cargando residentes", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.usuarios.create(form);
      setForm({ nombre: "", cedula: "", email: "", telefono: "", rol: "propietario", password: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("Error creando residente", err);
    } finally {
      setSaving(false);
    }
  }

  const propietarios = residentes.filter((r) => r.tipo_ocupacion === "propietario" || r.rol === "propietario").length;
  const inquilinos   = residentes.filter((r) => r.tipo_ocupacion === "inquilino"   || r.rol === "inquilino").length;

  const q = search.trim().toLowerCase();
  const filteredResidentes = q
    ? residentes.filter((r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.cedula ?? "").toLowerCase().includes(q) ||
        (r.unidad_numero ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      )
    : residentes;

  const initials = (nombre: string) =>
    nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total residentes", value: residentes.length,  color: "text-primary",      bg: "bg-blue-50" },
          { label: "Propietarios",     value: propietarios,        color: "text-indigo-700",   bg: "bg-indigo-50" },
          { label: "Inquilinos",       value: inquilinos,          color: "text-purple-700",   bg: "bg-purple-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Nuevo residente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Rodríguez" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cédula</label>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="79.111.222" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@email.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="310 000 0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="propietario">Propietario</option>
                <option value="inquilino">Inquilino</option>
                <option value="portero">Portero</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña temporal</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Guardando…" : "Crear residente"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Listado de residentes</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {showForm ? "✕ Cancelar" : "+ Nuevo residente"}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, cédula, unidad…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Nombre", "Cédula", "Tipo", "Unidad", "Edificio", "Teléfono", "Email"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : residentes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Sin residentes registrados.</td></tr>
              ) : filteredResidentes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Sin resultados.</td></tr>
              ) : filteredResidentes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">{initials(r.nombre)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.nombre}</div>
                        <div className="text-xs text-gray-400">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.cedula ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      (r.tipo_ocupacion ?? r.rol) === "propietario"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {r.tipo_ocupacion ?? r.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{r.unidad_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.edificio_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {q ? `${filteredResidentes.length} de ${residentes.length}` : residentes.length} residentes
          </span>
        </div>
      </div>
    </div>
  );
}
