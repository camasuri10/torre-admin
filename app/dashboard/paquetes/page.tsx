"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const ESTADO_COLORS: Record<string, string> = {
  recibido:   "bg-blue-100 text-blue-700",
  notificado: "bg-yellow-100 text-yellow-700",
  entregado:  "bg-green-100 text-green-700",
  devuelto:   "bg-red-100 text-red-700",
};

export default function PaquetesPage() {
  const user      = getUser();
  const edificioId = user?.edificio_id ?? 1;

  const [paquetes, setPaquetes]       = useState<any[]>([]);
  const [stats, setStats]             = useState<any>(null);
  const [unidades, setUnidades]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [search, setSearch]           = useState("");
  const [showForm, setShowForm]       = useState(false);
  const [entregandoId, setEntregandoId] = useState<number | null>(null);
  const [entregadoA, setEntregadoA]   = useState("");
  const [notificadoA, setNotificadoA] = useState("");
  const formRef                       = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, uns] = await Promise.all([
        api.paquetes.list({ edificio_id: edificioId, ...(filtroEstado ? { estado: filtroEstado } : {}) }),
        api.paquetes.stats(edificioId),
        api.edificios.unidades(edificioId),
      ]);
      setPaquetes(p);
      setStats(s);
      setUnidades(uns);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, edificioId]);

  useEffect(() => { load(); }, [load]);

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current!;
    const fd = new FormData(form);
    fd.append("edificio_id", String(edificioId));
    await api.paquetes.registrar(fd);
    form.reset();
    setShowForm(false);
    load();
  };

  const handleEntregar = async (id: number) => {
    if (!entregadoA.trim()) return;
    await api.paquetes.entregar(id, {
      entregado_a: entregadoA,
      ...(notificadoA.trim() ? { notas: `Notificado a: ${notificadoA}` } : {}),
    });
    setEntregandoId(null);
    setEntregadoA("");
    setNotificadoA("");
    load();
  };

  const sq = search.trim().toLowerCase();
  const filtered = sq
    ? paquetes.filter((p) =>
        (p.unidad_numero ?? "").toString().toLowerCase().includes(sq) ||
        (p.remitente ?? "").toLowerCase().includes(sq) ||
        (p.numero_guia ?? "").toLowerCase().includes(sq) ||
        (p.empresa_mensajeria ?? "").toLowerCase().includes(sq)
      )
    : paquetes;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Recibidos",   value: stats?.recibidos  ?? 0, color: "bg-blue-50 text-blue-700" },
          { label: "Notificados", value: stats?.notificados ?? 0, color: "bg-yellow-50 text-yellow-700" },
          { label: "Entregados",  value: stats?.entregados  ?? 0, color: "bg-green-50 text-green-700" },
          { label: "Hoy",         value: stats?.hoy         ?? 0, color: "bg-purple-50 text-purple-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color} border border-current/10`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filtros + Botón */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por unidad, remitente, guía…"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["", "recibido", "notificado", "entregado", "devuelto"].map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filtroEstado === e ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {e === "" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          + Registrar paquete
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Registrar nuevo paquete</h3>
          <form ref={formRef} onSubmit={handleRegistrar} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad destinataria</label>
              <select
                name="unidad_id"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Selecciona unidad —</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.numero} {u.torre_nombre ? `(${u.torre_nombre})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remitente</label>
              <input
                name="remitente"
                placeholder="Ej: Amazon, Rappi..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa mensajería</label>
              <input
                name="empresa_mensajeria"
                placeholder="Ej: Servientrega, DHL..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de guía</label>
              <input
                name="numero_guia"
                placeholder="Número de tracking"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del paquete</label>
              <input
                name="descripcion"
                placeholder="Ej: Caja mediana, sobre..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto del paquete (opcional)</label>
              <input
                name="foto"
                type="file"
                accept="image/*"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["#", "Unidad", "Remitente", "Empresa", "Guía", "Recibido", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {sq ? "Sin resultados." : "No hay paquetes registrados"}
                </td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">#{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.unidad_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.remitente ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.empresa_mensajeria ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.numero_guia ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(p.fecha_recepcion).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100 text-gray-600"}`}>
                        {p.estado}
                      </span>
                      {p.fecha_entrega && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Entregado {new Date(p.fecha_entrega).toLocaleDateString("es-CO", { dateStyle: "short" })}
                        </div>
                      )}
                      {p.entregado_a && (
                        <div className="text-[10px] text-gray-500">→ {p.entregado_a}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.estado !== "entregado" && p.estado !== "devuelto" && (
                      entregandoId === p.id ? (
                        <div className="space-y-1.5">
                          <input
                            value={entregadoA}
                            onChange={(e) => setEntregadoA(e.target.value)}
                            placeholder="Quien recibe el paquete"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
                          />
                          <input
                            value={notificadoA}
                            onChange={(e) => setNotificadoA(e.target.value)}
                            placeholder="A quién se notificó (opcional)"
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEntregar(p.id)}
                              disabled={!entregadoA.trim()}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >✓ Confirmar</button>
                            <button
                              onClick={() => { setEntregandoId(null); setEntregadoA(""); setNotificadoA(""); }}
                              className="text-xs text-gray-400 px-1"
                            >✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEntregandoId(p.id)}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Entregar
                        </button>
                      )
                    )}
                    {p.foto_url && (
                      <a href={p.foto_url} target="_blank" rel="noreferrer" className="block mt-1 text-xs text-gray-400 hover:text-gray-600">
                        📷 foto
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
