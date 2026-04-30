"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;
const USUARIO_ID = 1;

const ESTADO_BADGE: Record<string, string> = {
  confirmada: "bg-green-100 text-green-700",
  pendiente: "bg-amber-100 text-amber-700",
  cancelada: "bg-gray-100 text-gray-500",
};

export default function ZonasComunesPage() {
  const [zonas, setZonas] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"zonas" | "reservas">("zonas");
  const [selectedZona, setSelectedZona] = useState<any | null>(null);
  const [showReservaForm, setShowReservaForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [reservaZona, setReservaZona] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [z, r] = await Promise.all([
        api.zonas.list(EDIFICIO_ID),
        api.zonas.reservas.list({ edificio_id: EDIFICIO_ID }),
      ]);
      setZonas(z);
      setReservas(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReservar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.zonas.reservas.create({
      zona_id: reservaZona.id,
      usuario_id: USUARIO_ID,
      fecha: fd.get("fecha"),
      hora_inicio: fd.get("hora_inicio"),
      hora_fin: fd.get("hora_fin"),
      notas: fd.get("notas") || null,
    });
    setShowReservaForm(false);
    setReservaZona(null);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.zonas.updateConfig(selectedZona.id, {
      duracion_min_horas: Number(fd.get("duracion_min_horas")),
      duracion_max_horas: Number(fd.get("duracion_max_horas")),
      anticipacion_min_dias: Number(fd.get("anticipacion_min_dias")),
      anticipacion_max_dias: Number(fd.get("anticipacion_max_dias")),
      horario_inicio: fd.get("horario_inicio"),
      horario_fin: fd.get("horario_fin"),
    });
    setShowConfigForm(false);
    load();
  };

  const handleUpdateReserva = async (id: number, estado: string) => {
    await api.zonas.reservas.update(id, estado);
    load();
  };

  const disponibles = zonas.filter((z) => z.disponible).length;
  const confirmadas = reservas.filter((r) => r.estado === "confirmada").length;
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Zonas disponibles", value: disponibles, color: "bg-green-50 text-green-700" },
          { label: "Reservas confirmadas", value: confirmadas, color: "bg-blue-50 text-blue-700" },
          { label: "Reservas pendientes", value: pendientes, color: "bg-amber-50 text-amber-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-5 border border-current/10 ${s.color}`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["zonas", "reservas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "zonas" ? "🏊 Zonas comunes" : "📅 Reservas"}
          </button>
        ))}
      </div>

      {/* Zonas grid */}
      {tab === "zonas" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-3 text-center py-12 text-gray-400">Cargando...</div>
          ) : zonas.map((zona) => (
            <div key={zona.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{zona.icono}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{zona.nombre}</h3>
                      <p className="text-xs text-gray-400">{zona.edificio_nombre}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${zona.disponible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {zona.disponible ? "Disponible" : "No disponible"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{zona.descripcion}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                  <div>👥 Capacidad: <strong>{zona.capacidad}</strong></div>
                  <div>⏱️ Min: <strong>{zona.duracion_min_horas}h</strong></div>
                  <div>🕐 Horario: <strong>{String(zona.horario_inicio).slice(0,5)}–{String(zona.horario_fin).slice(0,5)}</strong></div>
                  <div>⏱️ Máx: <strong>{zona.duracion_max_horas}h</strong></div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setReservaZona(zona); setShowReservaForm(true); }}
                    disabled={!zona.disponible}
                    className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reservar
                  </button>
                  <button
                    onClick={() => { setSelectedZona(zona); setShowConfigForm(true); }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                    title="Configurar"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reservas table */}
      {tab === "reservas" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Zona", "Residente", "Unidad", "Fecha", "Horario", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
                ) : reservas.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay reservas</td></tr>
                ) : reservas.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{r.zona_icono}</span>
                        <span className="font-medium">{r.zona_nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.usuario_nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{r.unidad_numero ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.fecha}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado]}`}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.estado === "pendiente" && (
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateReserva(r.id, "confirmada")}
                            className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200">
                            Confirmar
                          </button>
                          <button onClick={() => handleUpdateReserva(r.id, "cancelada")}
                            className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reserva form modal */}
      {showReservaForm && reservaZona && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Reservar {reservaZona.nombre}</h3>
            <p className="text-xs text-gray-400 mb-4">
              Horario: {String(reservaZona.horario_inicio).slice(0,5)}–{String(reservaZona.horario_fin).slice(0,5)} ·
              Duración: {reservaZona.duracion_min_horas}h – {reservaZona.duracion_max_horas}h ·
              Anticipación: {reservaZona.anticipacion_min_dias}–{reservaZona.anticipacion_max_dias} días
            </p>
            <form onSubmit={handleReservar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input name="fecha" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                  <input name="hora_inicio" type="time" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                  <input name="hora_fin" type="time" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea name="notas" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowReservaForm(false); setReservaZona(null); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">Reservar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config form modal */}
      {showConfigForm && selectedZona && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">⚙️ Configurar {selectedZona.nombre}</h3>
            <form onSubmit={handleUpdateConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración mínima (h)</label>
                  <input name="duracion_min_horas" type="number" step="0.5" min="0.5"
                    defaultValue={selectedZona.duracion_min_horas}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración máxima (h)</label>
                  <input name="duracion_max_horas" type="number" step="0.5" min="0.5"
                    defaultValue={selectedZona.duracion_max_horas}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación mínima (días)</label>
                  <input name="anticipacion_min_dias" type="number" min="0"
                    defaultValue={selectedZona.anticipacion_min_dias}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación máxima (días)</label>
                  <input name="anticipacion_max_dias" type="number" min="1"
                    defaultValue={selectedZona.anticipacion_max_dias}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario apertura</label>
                  <input name="horario_inicio" type="time"
                    defaultValue={String(selectedZona.horario_inicio).slice(0,5)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario cierre</label>
                  <input name="horario_fin" type="time"
                    defaultValue={String(selectedZona.horario_fin).slice(0,5)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowConfigForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
