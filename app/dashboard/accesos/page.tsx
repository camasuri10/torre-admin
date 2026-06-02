"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import OptionalPhotoInput from "@/components/OptionalPhotoInput";

const MOTIVO_BADGE: Record<string, string> = {
  visita:           "bg-blue-100 text-blue-700",
  domicilio:        "bg-purple-100 text-purple-700",
  servicio_tecnico: "bg-indigo-100 text-indigo-700",
  mudanza:          "bg-orange-100 text-orange-700",
  otro:             "bg-gray-100 text-gray-600",
};

const MOTIVO_LABELS: Record<string, string> = {
  visita:           "Visita",
  domicilio:        "Domicilio",
  servicio_tecnico: "Serv. técnico",
  mudanza:          "Mudanza",
  otro:             "Otro",
};

const VEHICULO_LABELS: Record<string, string> = {
  carro: "Carro",
  moto: "Moto",
  bicicleta: "Bicicleta",
  otro: "Otro",
};

type Acceso = {
  id: number;
  visitante_nombre: string;
  visitante_documento: string | null;
  descripcion: string | null;
  foto_url: string | null;
  vehiculo_tipo: string | null;
  vehiculo_placa: string | null;
  motivo: string;
  autorizado: boolean;
  fecha_entrada: string;
  fecha_salida: string | null;
  unidad_numero: string | null;
  anfitrion_nombre: string | null;
};

type Stats = {
  ingresos_hoy: number;
  dentro_ahora: number;
  no_autorizados_hoy: number;
};

const EMPTY_FORM = {
  visitante_nombre: "",
  visitante_documento: "",
  descripcion: "",
  motivo: "visita",
  autorizado: true,
  destino_unidad_id: undefined as number | undefined,
  vehiculo_tipo: "",
  vehiculo_placa: "",
};

export default function AccesosPage() {
  const user = getUser();
  const conjuntoId = user?.conjunto_id ?? null;

  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [photoKey, setPhotoKey] = useState(0);

  async function load() {
    try {
      const [data, s] = await Promise.all([
        api.accesos.list({ conjunto_id: conjuntoId }),
        api.accesos.stats(conjuntoId),
      ]);
      setAccesos(data);
      setStats(s);
    } catch (err) {
      console.error("Error cargando accesos", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.conjuntos.unidades(conjuntoId)
      .then((u: any) => setUnidades(Array.isArray(u) ? u : []))
      .catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("conjunto_id", String(conjuntoId));
      fd.append("visitante_nombre", form.visitante_nombre);
      if (form.visitante_documento) fd.append("visitante_documento", form.visitante_documento);
      if (form.descripcion) fd.append("descripcion", form.descripcion);
      fd.append("motivo", form.motivo);
      fd.append("autorizado", form.autorizado ? "true" : "false");
      if (form.destino_unidad_id) fd.append("destino_unidad_id", String(form.destino_unidad_id));
      if (form.vehiculo_tipo) fd.append("vehiculo_tipo", form.vehiculo_tipo);
      if (form.vehiculo_placa.trim()) fd.append("vehiculo_placa", form.vehiculo_placa.trim());
      if (user?.sub) fd.append("registrado_por", user.sub);
      if (fotoFile) fd.append("foto", fotoFile);

      await api.accesos.registrar(fd);
      setForm(EMPTY_FORM);
      setFotoFile(null);
      setPhotoKey((k) => k + 1);
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("Error registrando acceso", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSalida(id: number) {
    try {
      await api.accesos.salida(id);
      await load();
    } catch (err) {
      console.error("Error registrando salida", err);
    }
  }

  function formatHora(iso: string) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  const q = search.trim().toLowerCase();
  const filteredAccesos = q
    ? accesos.filter((a) =>
        a.visitante_nombre.toLowerCase().includes(q) ||
        (a.visitante_documento ?? "").toLowerCase().includes(q) ||
        (a.unidad_numero ?? "").toLowerCase().includes(q) ||
        (a.anfitrion_nombre ?? "").toLowerCase().includes(q) ||
        (a.descripcion ?? "").toLowerCase().includes(q) ||
        (a.vehiculo_placa ?? "").toLowerCase().includes(q) ||
        MOTIVO_LABELS[a.motivo]?.toLowerCase().includes(q)
      )
    : accesos;

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  }

  function vehiculoLabel(a: Acceso) {
    if (!a.vehiculo_placa && !a.vehiculo_tipo) return "—";
    const tipo = a.vehiculo_tipo ? (VEHICULO_LABELS[a.vehiculo_tipo] ?? a.vehiculo_tipo) : "";
    if (a.vehiculo_placa && tipo) return `${tipo} · ${a.vehiculo_placa}`;
    return a.vehiculo_placa ?? tipo;
  }

  const COLS = 10;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Ingresos hoy", value: stats?.ingresos_hoy ?? 0, color: "text-primary", bg: "bg-blue-50" },
          { label: "Actualmente dentro", value: stats?.dentro_ahora ?? 0, color: "text-green-600", bg: "bg-green-50" },
          { label: "Accesos no autorizados", value: stats?.no_autorizados_hoy ?? 0, color: "text-red-600", bg: "bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Registrar nuevo visitante</h3>
            <p className="text-blue-200 text-sm mt-1">Ingresa los datos del visitante para autorizar su acceso al conjunto.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-primary px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            + Registrar ingreso
          </button>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Registrar visitante</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del visitante</label>
              <input required value={form.visitante_nombre} onChange={(e) => setForm({ ...form, visitante_nombre: e.target.value })}
                placeholder="Nombre completo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Documento</label>
              <input value={form.visitante_documento} onChange={(e) => setForm({ ...form, visitante_documento: e.target.value })}
                placeholder="CC / Pasaporte" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / observaciones</label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2} placeholder="Ej: visita familiar, entrega programada…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
              <select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                {Object.entries(MOTIVO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apartamento / Unidad destino</label>
              <select
                value={form.destino_unidad_id ?? ""}
                onChange={(e) => setForm({ ...form, destino_unidad_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">— Sin especificar</option>
                {unidades.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.numero}{u.piso ? ` (piso ${u.piso})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de vehículo</label>
              <select value={form.vehiculo_tipo} onChange={(e) => setForm({ ...form, vehiculo_tipo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="">— Sin vehículo</option>
                {Object.entries(VEHICULO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Placa</label>
              <input value={form.vehiculo_placa} onChange={(e) => setForm({ ...form, vehiculo_placa: e.target.value.toUpperCase() })}
                placeholder="ABC123" disabled={!form.vehiculo_tipo}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div className="sm:col-span-2">
              <OptionalPhotoInput key={photoKey} label="Foto del visitante (opcional)" onFileChange={setFotoFile} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input type="checkbox" id="autorizado" checked={form.autorizado} onChange={(e) => setForm({ ...form, autorizado: e.target.checked })} className="w-4 h-4 rounded" />
              <label htmlFor="autorizado" className="text-sm text-gray-700">Acceso autorizado</label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Registrando…" : "Registrar ingreso"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          <h2 className="font-semibold text-gray-900">Registro de accesos</h2>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar visitante, unidad, placa, descripción…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Visitante", "Documento", "Descripción", "Unidad", "Vehículo", "Motivo", "Entrada", "Salida", "Estado", ""].map((h) => (
                  <th key={h || "foto"} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={COLS} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : accesos.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-8 text-center text-sm text-gray-400">Sin registros de acceso.</td></tr>
              ) : filteredAccesos.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-8 text-center text-sm text-gray-400">Sin resultados.</td></tr>
              ) : filteredAccesos.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${!r.autorizado ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        r.autorizado ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"
                      }`}>
                        {r.visitante_nombre[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{r.visitante_nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{r.visitante_documento ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate" title={r.descripcion ?? undefined}>
                    {r.descripcion ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.unidad_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">{vehiculoLabel(r)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${MOTIVO_BADGE[r.motivo] ?? "bg-gray-100 text-gray-600"}`}>
                      {MOTIVO_LABELS[r.motivo] ?? r.motivo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{formatFecha(r.fecha_entrada)}</div>
                    <div className="text-xs text-gray-400">{formatHora(r.fecha_entrada)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.fecha_salida ? (
                      <span>{formatHora(r.fecha_salida)}</span>
                    ) : (
                      <button
                        onClick={() => handleSalida(r.id)}
                        className="inline-flex items-center gap-1 text-xs text-green-600 font-medium hover:text-green-800 transition-colors"
                        title="Registrar salida"
                      >
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Dentro · salida
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.autorizado ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ Autorizado</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">✗ No autorizado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.foto_url ? (
                      <a href={r.foto_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">📷</a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {q ? `${filteredAccesos.length} de ${accesos.length}` : accesos.length} registros
          </span>
        </div>
      </div>
    </div>
  );
}
