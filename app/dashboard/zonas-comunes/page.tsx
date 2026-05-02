"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const ESTADO_BADGE: Record<string, string> = {
  confirmada: "bg-green-100 text-green-700",
  pendiente: "bg-amber-100 text-amber-700",
  cancelada: "bg-gray-100 text-gray-500",
  no_usada: "bg-orange-100 text-orange-700",
};

const ICONOS_ZONA = ["🏊", "🎾", "🏋️", "🌳", "🎮", "🎲", "🎉", "🔥", "🍽️", "🛋️"];

const ZONA_FORM_EMPTY = {
  nombre: "", icono: "🏊", descripcion: "", capacidad: 20,
  horario_inicio: "06:00", horario_fin: "22:00",
  duracion_min_horas: 1, duracion_max_horas: 4,
  anticipacion_min_dias: 1, anticipacion_max_dias: 30,
};

export default function ZonasComunesPage() {
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;
  const usuarioId = user?.id ?? 1;

  const [zonas, setZonas] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"zonas" | "reservas">("zonas");
  const [selectedZona, setSelectedZona] = useState<any | null>(null);
  const [showReservaForm, setShowReservaForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showZonaForm, setShowZonaForm] = useState(false);
  const [reservaZona, setReservaZona] = useState<any | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: number; zona: string } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [zonaForm, setZonaForm] = useState(ZONA_FORM_EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [incluirInactivas, setIncluirInactivas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [z, r] = await Promise.all([
        api.zonas.list(edificioId, incluirInactivas),
        api.zonas.reservas.list({ edificio_id: edificioId }),
      ]);
      setZonas(z);
      setReservas(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [edificioId, incluirInactivas]);

  useEffect(() => { load(); }, [load]);

  const handleReservar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      zona_id: reservaZona.id,
      usuario_id: usuarioId,
      fecha: fd.get("fecha"),
      hora_inicio: fd.get("hora_inicio"),
      notas: fd.get("notas") || null,
    };
    const horaFin = fd.get("hora_fin");
    if (horaFin) body.hora_fin = horaFin;
    setSaving(true);
    try {
      await api.zonas.reservas.create(body);
      setShowReservaForm(false);
      setReservaZona(null);
      (e.target as HTMLFormElement).reset();
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.zonas.updateConfig(selectedZona.id, {
        duracion_min_horas: Number(fd.get("duracion_min_horas")),
        duracion_max_horas: Number(fd.get("duracion_max_horas")),
        anticipacion_min_dias: Number(fd.get("anticipacion_min_dias")),
        anticipacion_max_dias: Number(fd.get("anticipacion_max_dias")),
        horario_inicio: fd.get("horario_inicio"),
        horario_fin: fd.get("horario_fin"),
        activo: fd.get("activo") === "true",
      });
      setShowConfigForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCrearZona = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.zonas.create({ ...zonaForm, edificio_id: edificioId });
      setShowZonaForm(false);
      setZonaForm(ZONA_FORM_EMPTY);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmar = async (id: number) => {
    await api.zonas.reservas.update(id, "confirmada");
    load();
  };

  const handleCancelar = async () => {
    if (!cancelModal) return;
    setSaving(true);
    try {
      await api.zonas.reservas.cancelar(cancelModal.id, {
        cancelada_por: "admin",
        motivo: cancelMotivo || undefined,
      });
      setCancelModal(null);
      setCancelMotivo("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const disponibles = zonas.filter((z) => z.disponible && z.activo !== false).length;
  const confirmadas = reservas.filter((r) => r.estado === "confirmada").length;
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const noUsadas = reservas.filter((r) => r.estado === "no_usada").length;

  const q = search.trim().toLowerCase();
  const filteredZonas = q
    ? zonas.filter((z) => z.nombre.toLowerCase().includes(q) || (z.descripcion ?? "").toLowerCase().includes(q))
    : zonas;

  const filteredReservas = filtroEstado
    ? reservas.filter((r) => r.estado === filtroEstado)
    : reservas;

  const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Zonas disponibles", value: disponibles, color: "bg-green-50 text-green-700" },
          { label: "Confirmadas", value: confirmadas, color: "bg-blue-50 text-blue-700" },
          { label: "Pendientes", value: pendientes, color: "bg-amber-50 text-amber-700" },
          { label: "No usadas", value: noUsadas, color: "bg-orange-50 text-orange-700" },
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
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar zona común…"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={incluirInactivas} onChange={(e) => setIncluirInactivas(e.target.checked)}
                className="rounded border-gray-300 text-primary" />
              Ver inactivas
            </label>
            <button onClick={() => setShowZonaForm(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 whitespace-nowrap">
              + Nueva zona
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              <div className="col-span-3 text-center py-12 text-gray-400">Cargando...</div>
            ) : filteredZonas.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-400">Sin resultados.</div>
            ) : filteredZonas.map((zona) => (
              <div key={zona.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                zona.activo === false ? "opacity-60 border-gray-100" : "border-gray-100"
              }`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{zona.icono}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{zona.nombre}</h3>
                        <p className="text-xs text-gray-400">{zona.edificio_nombre}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {zona.activo === false ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Inactiva</span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${zona.disponible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {zona.disponible ? "Disponible" : "No disponible"}
                        </span>
                      )}
                    </div>
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
                      disabled={!zona.disponible || zona.activo === false}
                      className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      Reservar
                    </button>
                    <button
                      onClick={() => { setSelectedZona(zona); setShowConfigForm(true); }}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                      title="Configurar">
                      ⚙️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Reservas table */}
      {tab === "reservas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["", "pendiente", "confirmada", "cancelada", "no_usada"].map((e) => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filtroEstado === e ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {e === "" ? "Todas" : e.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Zona", "Residente / Apto", "Registrado por", "Fecha", "Horario", "Estado", "Acciones"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
                  ) : filteredReservas.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay reservas</td></tr>
                  ) : filteredReservas.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{r.zona_icono}</span>
                          <span className="font-medium">{r.zona_nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{r.usuario_nombre}</div>
                        <div className="text-xs text-gray-400">{r.unidad_numero ? `Apto ${r.unidad_numero}` : "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.registrado_por_nombre ?? r.usuario_nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.fecha}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.estado] ?? "bg-gray-100 text-gray-500"}`}>
                          {r.estado === "no_usada" ? "No usada" : r.estado}
                        </span>
                        {r.cancelada_por && (
                          <div className="text-xs text-gray-400 mt-0.5">por {r.cancelada_por}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {r.estado === "pendiente" && (
                            <button onClick={() => handleConfirmar(r.id)}
                              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 font-medium">
                              Confirmar
                            </button>
                          )}
                          {(r.estado === "pendiente" || r.estado === "confirmada") && (
                            <button
                              onClick={() => setCancelModal({ id: r.id, zona: r.zona_nombre })}
                              className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200 font-medium">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input name="fecha" type="date" required className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
                  <input name="hora_inicio" type="time" required className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                  <input name="hora_fin" type="time" className={INPUT}
                    placeholder="Auto" />
                  <p className="text-xs text-gray-400 mt-0.5">Opcional — se calcula sola</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea name="notas" rows={2} className={INPUT} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowReservaForm(false); setReservaZona(null); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Reservando…" : "Reservar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel reserva modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Cancelar reserva</h3>
            <p className="text-sm text-gray-500 mb-4">
              Zona: <strong>{cancelModal.zona}</strong>. La reserva quedará cancelada pero visible en el historial.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={3}
                placeholder="Ej: Residente solicitó cancelación…"
                className={INPUT}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setCancelModal(null); setCancelMotivo(""); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">
                Volver
              </button>
              <button onClick={handleCancelar} disabled={saving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                {saving ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config form modal */}
      {showConfigForm && selectedZona && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">⚙️ Configurar {selectedZona.nombre}</h3>
            <form onSubmit={handleUpdateConfig} className="space-y-4">
              {/* Activo / Inactivo */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-700">Zona activa</div>
                  <div className="text-xs text-gray-400">Las zonas inactivas no se pueden reservar</div>
                </div>
                <select name="activo" defaultValue={selectedZona.activo !== false ? "true" : "false"}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración mínima (h)</label>
                  <input name="duracion_min_horas" type="number" step="0.5" min="0.5"
                    defaultValue={selectedZona.duracion_min_horas} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración máxima (h)</label>
                  <input name="duracion_max_horas" type="number" step="0.5" min="0.5"
                    defaultValue={selectedZona.duracion_max_horas} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación mínima (días)</label>
                  <input name="anticipacion_min_dias" type="number" min="0"
                    defaultValue={selectedZona.anticipacion_min_dias} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación máxima (días)</label>
                  <input name="anticipacion_max_dias" type="number" min="1"
                    defaultValue={selectedZona.anticipacion_max_dias} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario apertura</label>
                  <input name="horario_inicio" type="time"
                    defaultValue={String(selectedZona.horario_inicio).slice(0,5)} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario cierre</label>
                  <input name="horario_fin" type="time"
                    defaultValue={String(selectedZona.horario_fin).slice(0,5)} className={INPUT} />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowConfigForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nueva zona modal */}
      {showZonaForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Nueva zona común</h3>
            <form onSubmit={handleCrearZona} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input required value={zonaForm.nombre}
                    onChange={(e) => setZonaForm({ ...zonaForm, nombre: e.target.value })}
                    placeholder="Piscina principal" className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ícono</label>
                  <select value={zonaForm.icono}
                    onChange={(e) => setZonaForm({ ...zonaForm, icono: e.target.value })}
                    className={INPUT}>
                    {ICONOS_ZONA.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={zonaForm.descripcion}
                  onChange={(e) => setZonaForm({ ...zonaForm, descripcion: e.target.value })}
                  rows={2} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad (personas)</label>
                <input type="number" min="1" value={zonaForm.capacidad}
                  onChange={(e) => setZonaForm({ ...zonaForm, capacidad: Number(e.target.value) })}
                  className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario apertura</label>
                  <input type="time" value={zonaForm.horario_inicio}
                    onChange={(e) => setZonaForm({ ...zonaForm, horario_inicio: e.target.value })}
                    className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario cierre</label>
                  <input type="time" value={zonaForm.horario_fin}
                    onChange={(e) => setZonaForm({ ...zonaForm, horario_fin: e.target.value })}
                    className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración mínima (h)</label>
                  <input type="number" step="0.5" min="0.5" value={zonaForm.duracion_min_horas}
                    onChange={(e) => setZonaForm({ ...zonaForm, duracion_min_horas: Number(e.target.value) })}
                    className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración máxima (h)</label>
                  <input type="number" step="0.5" min="0.5" value={zonaForm.duracion_max_horas}
                    onChange={(e) => setZonaForm({ ...zonaForm, duracion_max_horas: Number(e.target.value) })}
                    className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación mín. (días)</label>
                  <input type="number" min="0" value={zonaForm.anticipacion_min_dias}
                    onChange={(e) => setZonaForm({ ...zonaForm, anticipacion_min_dias: Number(e.target.value) })}
                    className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anticipación máx. (días)</label>
                  <input type="number" min="1" value={zonaForm.anticipacion_max_dias}
                    onChange={(e) => setZonaForm({ ...zonaForm, anticipacion_max_dias: Number(e.target.value) })}
                    className={INPUT} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowZonaForm(false); setZonaForm(ZONA_FORM_EMPTY); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Creando…" : "Crear zona"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
