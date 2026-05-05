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
  const usuarioId = user ? parseInt(user.sub) : 1;
  const isAdmin = ["administrador", "superadmin"].includes(user?.rol ?? "");

  const [zonas, setZonas] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"zonas" | "reservas">("zonas");
  const [selectedZona, setSelectedZona] = useState<any | null>(null);
  const [showReservaForm, setShowReservaForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showZonaForm, setShowZonaForm] = useState(false);
  const [reservaZona, setReservaZona] = useState<any | null>(null);
  const [reservaFecha, setReservaFecha] = useState("");
  const [reservaUnidadId, setReservaUnidadId] = useState<number | null>(null);
  const [slots, setSlots] = useState<{ inicio: string; fin: string; libre: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reservaNotas, setReservaNotas] = useState("");
  const [reservandoSlot, setReservandoSlot] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: number; zona: string; esPropia: boolean } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [zonaForm, setZonaForm] = useState(ZONA_FORM_EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [incluirInactivas, setIncluirInactivas] = useState(false);

  function timeToMin(t: string) {
    const [h, m] = String(t).slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }
  function minToTime(m: number) {
    return `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
  }
  function generarSlots(horarioInicio: string, horarioFin: string, durMinHoras: number) {
    const start = timeToMin(horarioInicio);
    const end = timeToMin(horarioFin);
    const dur = Math.round(Number(durMinHoras) * 60);
    const result: { inicio: string; fin: string }[] = [];
    for (let t = start; t + dur <= end; t += 15) {
      result.push({ inicio: minToTime(t), fin: minToTime(t + dur) });
    }
    return result;
  }
  function slotLibre(inicio: string, fin: string, ocupados: any[]) {
    const s = timeToMin(inicio), e = timeToMin(fin);
    return !ocupados.some((o) => {
      const os = timeToMin(o.hora_inicio), oe = timeToMin(o.hora_fin);
      return s < oe && e > os;
    });
  }

  async function cargarSlots(zona: any, fecha: string) {
    if (!fecha) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlots([]);
    try {
      const { ocupados, config, conteo_hora } = await api.zonas.disponibilidad(zona.id, fecha);
      const raw = generarSlots(
        config?.horario_inicio ?? zona.horario_inicio,
        config?.horario_fin ?? zona.horario_fin,
        config?.duracion_min_horas ?? zona.duracion_min_horas,
      );
      const capacidadHora: number | null = config?.capacidad_hora ?? zona.capacidad_hora ?? null;
      // Solo incluir slots que estén libres (ocultar los ocupados en lugar de mostrarlos disabled)
      const libres = raw.filter((s) => {
        if (!slotLibre(s.inicio, s.fin, ocupados)) return false;
        // Si hay capacidad_hora, verificar que no se haya alcanzado
        if (capacidadHora) {
          const count = (conteo_hora ?? {})[s.inicio.slice(0, 5)] ?? 0;
          if (count >= capacidadHora) return false;
        }
        return true;
      });
      setSlots(libres.map((s) => ({ ...s, libre: true })));
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleReservarSlot(slot: { inicio: string; fin: string }) {
    if (!reservaZona || !reservaFecha) return;
    setReservandoSlot(slot.inicio);
    try {
      const reserva = await api.zonas.reservas.create({
        zona_id: reservaZona.id,
        usuario_id: usuarioId,
        unidad_id: reservaUnidadId || null,
        fecha: reservaFecha,
        hora_inicio: slot.inicio,
        hora_fin: slot.fin,
        notas: reservaNotas || null,
      });
      await api.zonas.reservas.update(reserva.id, "confirmada");
      setShowReservaForm(false);
      setReservaZona(null);
      setReservaFecha("");
      setSlots([]);
      setReservaNotas("");
      setReservaUnidadId(null);
      load();
    } catch (err: any) {
      alert("Error al reservar: " + (err?.message ?? "Intenta de nuevo"));
    } finally {
      setReservandoSlot(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [z, r, uns] = await Promise.all([
        api.zonas.list(edificioId, incluirInactivas),
        api.zonas.reservas.list({ edificio_id: edificioId }),
        api.edificios.unidades(edificioId),
      ]);
      setZonas(z);
      setReservas(r);
      setUnidades(uns);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [edificioId, incluirInactivas]);

  useEffect(() => { load(); }, [load]);


  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const cap = fd.get("capacidad_hora");
    try {
      await api.zonas.updateConfig(selectedZona.id, {
        duracion_min_horas:  Number(fd.get("duracion_min_horas")),
        duracion_max_horas:  Number(fd.get("duracion_max_horas")),
        anticipacion_min_dias: Number(fd.get("anticipacion_min_dias")),
        anticipacion_max_dias: Number(fd.get("anticipacion_max_dias")),
        horario_inicio:      fd.get("horario_inicio"),
        horario_fin:         fd.get("horario_fin"),
        activo:              fd.get("activo") === "true",
        capacidad_hora:      cap ? Number(cap) : null,
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
      const canceladaPor = cancelModal.esPropia
        ? (user?.name ?? "residente")
        : "administrador";
      await api.zonas.reservas.cancelar(cancelModal.id, {
        cancelada_por: canceladaPor,
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
            {isAdmin && (
              <button onClick={() => setShowZonaForm(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 whitespace-nowrap">
                + Nueva zona
              </button>
            )}
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
                      onClick={() => {
                        setReservaZona(zona);
                        setShowReservaForm(true);
                        // Pre-cargar unidad del usuario si es residente con ocupación
                        if (!isAdmin && unidades.length > 0) {
                          setReservaUnidadId(unidades[0]?.id ?? null);
                        }
                      }}
                      disabled={!zona.disponible || zona.activo === false}
                      className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      Reservar
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setSelectedZona(zona); setShowConfigForm(true); }}
                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        title="Configurar">
                        ⚙️
                      </button>
                    )}
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
                          {isAdmin && r.estado === "pendiente" && (
                            <button onClick={() => handleConfirmar(r.id)}
                              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 font-medium">
                              Confirmar
                            </button>
                          )}
                          {(r.estado === "pendiente" || r.estado === "confirmada") &&
                           (isAdmin || r.usuario_id === usuarioId) && (
                            <button
                              onClick={() => setCancelModal({ id: r.id, zona: r.zona_nombre, esPropia: r.usuario_id === usuarioId && !isAdmin })}
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

      {/* Reserva modal — slot picker */}
      {showReservaForm && reservaZona && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-gray-900">
                {reservaZona.icono} Reservar {reservaZona.nombre}
              </h3>
              <button
                onClick={() => { setShowReservaForm(false); setReservaZona(null); setReservaFecha(""); setSlots([]); setReservaNotas(""); setReservaUnidadId(null); }}
                className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Horario: {String(reservaZona.horario_inicio).slice(0,5)}–{String(reservaZona.horario_fin).slice(0,5)} ·
              Bloque: {reservaZona.duracion_min_horas}h
            </p>

            {/* Unidad */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Apartamento / Unidad</label>
              <select
                value={reservaUnidadId ?? ""}
                onChange={(e) => setReservaUnidadId(e.target.value ? Number(e.target.value) : null)}
                className={INPUT}
              >
                <option value="">— Sin unidad —</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.numero} {u.torre_nombre ? `(${u.torre_nombre})` : ""}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona una fecha</label>
              <input
                type="date"
                value={reservaFecha}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setReservaFecha(e.target.value); cargarSlots(reservaZona, e.target.value); }}
                className={INPUT}
              />
            </div>

            {/* Slots */}
            {reservaFecha && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Horarios disponibles</p>
                {slotsLoading ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Verificando disponibilidad…</div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No se encontraron horarios.</div>
                ) : slots.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-600 text-sm font-medium">
                    No hay disponibilidad para este día
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.inicio}
                        disabled={reservandoSlot !== null}
                        onClick={() => handleReservarSlot(slot)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-colors border ${
                          reservandoSlot === slot.inicio
                            ? "bg-primary/10 text-primary border-primary/30 cursor-wait"
                            : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        }`}
                      >
                        {slot.inicio}
                        <span className="block text-[10px] opacity-70">{slot.fin}</span>
                        {reservandoSlot === slot.inicio && <span className="block text-[10px]">reservando…</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={reservaNotas}
                onChange={(e) => setReservaNotas(e.target.value)}
                rows={2}
                placeholder="Ej: reunión de copropietarios…"
                className={INPUT}
              />
            </div>
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
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad máxima por hora (opcional)</label>
                  <input name="capacidad_hora" type="number" min="1" placeholder="Ej: 5 reservas por hora"
                    defaultValue={selectedZona.capacidad_hora ?? ""} className={INPUT} />
                  <p className="text-xs text-gray-400 mt-0.5">Límite de reservas simultáneas para el mismo horario</p>
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
