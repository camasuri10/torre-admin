"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const TURNO_COLORS: Record<string, string> = {
  dia:        "bg-yellow-100 text-yellow-700 border-yellow-200",
  noche:      "bg-indigo-100 text-indigo-700 border-indigo-200",
  fin_semana: "bg-purple-100 text-purple-700 border-purple-200",
};

const TURNO_ICONO: Record<string, string> = {
  dia: "☀️", noche: "🌙", fin_semana: "📅",
};

const ESTADO_COLORS: Record<string, string> = {
  programado: "bg-blue-100 text-blue-700",
  en_curso:   "bg-green-100 text-green-700",
  completado: "bg-gray-100 text-gray-600",
  ausente:    "bg-red-100 text-red-700",
};

const EVENTO_ICONS: Record<string, string> = {
  novedad: "📝", incidente: "⚠️", ronda: "🔄", alerta: "🚨", otro: "📌",
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getMesStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function GuardiasPage() {
  const edificioId = getUser()?.edificio_id;
  const [guardias, setGuardias]           = useState<any[]>([]);
  const [turnos, setTurnos]               = useState<any[]>([]);
  const [cuadro, setCuadro]               = useState<any[]>([]);
  const [selectedTurno, setSelectedTurno] = useState<any | null>(null);
  const [eventos, setEventos]             = useState<any[]>([]);
  const [tab, setTab]                     = useState<"cuadro" | "turnos" | "guardias">("cuadro");
  const [showTurnoForm, setShowTurnoForm] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [mesActual, setMesActual]         = useState(() => getMesStr(new Date()));

  const navMes = (delta: number) => {
    const [y, m] = mesActual.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesActual(getMesStr(d));
  };

  const load = async (mes?: string) => {
    if (!edificioId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [g, t, c] = await Promise.all([
        api.guardias.list(edificioId),
        api.guardias.turnos.list({ edificio_id: edificioId }),
        api.guardias.cuadro(edificioId, mes ?? mesActual),
      ]);
      setGuardias(g);
      setTurnos(t);
      setCuadro(c);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (edificioId) load(mesActual); }, [mesActual]);

  const loadEventos = async (turno_id: number) => {
    const ev = await api.guardias.turnos.eventos(turno_id);
    setEventos(ev);
  };

  const handleSelectTurno = (turno: any) => {
    setSelectedTurno(turno);
    loadEventos(turno.id);
  };

  const handleCrearTurno = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.guardias.turnos.create({
      guardia_id:  Number(fd.get("guardia_id")),
      edificio_id: edificioId,
      fecha_inicio: fd.get("fecha_inicio"),
      fecha_fin:    fd.get("fecha_fin"),
      tipo_turno:   fd.get("tipo_turno"),
      notas:        fd.get("notas") || null,
    });
    setShowTurnoForm(false);
    load(mesActual);
  };

  const handleUpdateEstado = async (turno_id: number, estado: string) => {
    await api.guardias.turnos.update(turno_id, { estado });
    load(mesActual);
    if (selectedTurno?.id === turno_id) setSelectedTurno((t: any) => ({ ...t, estado }));
  };

  const handleCrearEvento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.append("guardia_id", String(selectedTurno?.guardia_id ?? 1));
    await api.guardias.turnos.crearEvento(selectedTurno!.id, fd);
    (e.target as HTMLFormElement).reset();
    loadEventos(selectedTurno!.id);
  };

  // ── Generar calendario mensual ─────────────────────────────────────────────
  const [year, month] = mesActual.split("-").map(Number);
  const primerDia     = new Date(year, month - 1, 1);
  const diasEnMes     = new Date(year, month, 0).getDate();
  // Offset: lunes = 0
  const offsetInicio  = (primerDia.getDay() + 6) % 7;
  const totalCeldas   = Math.ceil((offsetInicio + diasEnMes) / 7) * 7;
  const nombresDias   = ["L", "M", "X", "J", "V", "S", "D"];

  function turnosDia(dia: number) {
    return cuadro.filter((t) => {
      const d = new Date(t.fecha_inicio);
      return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === dia;
    });
  }

  function nombreMesAnio() {
    return `${MESES[month - 1]} ${year}`;
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["cuadro", "turnos", "guardias"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "cuadro" ? "📅 Cuadro de Turnos" : t === "turnos" ? "🕐 Turnos" : "👮 Guardias"}
          </button>
        ))}
      </div>

      {/* ── Calendario mensual ──────────────────────────────────────────── */}
      {tab === "cuadro" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header: navegación */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navMes(-1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="Mes anterior"
              >‹</button>
              <h2 className="font-semibold text-gray-900 text-lg min-w-[180px] text-center">
                {nombreMesAnio()}
              </h2>
              <button
                onClick={() => navMes(1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="Mes siguiente"
              >›</button>
            </div>
            <button
              onClick={() => setShowTurnoForm(true)}
              className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              + Programar turno
            </button>
          </div>

          {/* Leyenda */}
          <div className="px-5 py-2 flex flex-wrap gap-3 border-b border-gray-50">
            {Object.entries(TURNO_ICONO).map(([tipo, icon]) => (
              <span key={tipo} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${TURNO_COLORS[tipo]}`}>
                {icon} {tipo === "dia" ? "Día" : tipo === "noche" ? "Noche" : "Fin de semana"}
              </span>
            ))}
          </div>

          {/* Calendario */}
          <div className="p-4">
            {/* Días de la semana */}
            <div className="grid grid-cols-7 mb-1">
              {nombresDias.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Celdas */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: totalCeldas }).map((_, idx) => {
                const dia = idx - offsetInicio + 1;
                const esMes = dia >= 1 && dia <= diasEnMes;
                const esHoy = esMes && new Date().getDate() === dia && new Date().getMonth() === month - 1 && new Date().getFullYear() === year;
                const turnos = esMes ? turnosDia(dia) : [];
                return (
                  <div
                    key={idx}
                    className={`min-h-[72px] rounded-lg p-1 ${
                      !esMes ? "bg-gray-50/50" : esHoy ? "bg-blue-50 border border-blue-200" : "bg-gray-50/30 hover:bg-gray-50"
                    }`}
                  >
                    {esMes && (
                      <>
                        <div className={`text-xs font-semibold mb-1 text-right pr-1 ${esHoy ? "text-blue-600" : "text-gray-500"}`}>
                          {dia}
                        </div>
                        <div className="space-y-0.5">
                          {turnos.slice(0, 3).map((t) => (
                            <div
                              key={t.id}
                              title={`${t.guardia_nombre} — ${t.tipo_turno}`}
                              className={`text-[10px] px-1 py-0.5 rounded font-medium truncate border ${TURNO_COLORS[t.tipo_turno] ?? "bg-gray-100 text-gray-600"}`}
                            >
                              {TURNO_ICONO[t.tipo_turno]} {t.guardia_nombre?.split(" ")[0]}
                            </div>
                          ))}
                          {turnos.length > 3 && (
                            <div className="text-[10px] text-gray-400 text-center">+{turnos.length - 3} más</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Turnos list ─────────────────────────────────────────────────── */}
      {tab === "turnos" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Turnos recientes</h2>
              <button onClick={() => setShowTurnoForm(true)} className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                + Nuevo
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {turnos.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleSelectTurno(t)}
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTurno?.id === t.id ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{t.guardia_nombre}</span>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${TURNO_COLORS[t.tipo_turno]}`}>
                        {TURNO_ICONO[t.tipo_turno]} {t.tipo_turno}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[t.estado]}`}>
                        {t.estado}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(t.fecha_inicio).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                    {" → "}
                    {new Date(t.fecha_fin).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  {t.estado === "programado" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={(e) => { e.stopPropagation(); handleUpdateEstado(t.id, "en_curso"); }}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200">
                        Iniciar
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleUpdateEstado(t.id, "ausente"); }}
                        className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200">
                        Ausente
                      </button>
                    </div>
                  )}
                  {t.estado === "en_curso" && (
                    <button onClick={(e) => { e.stopPropagation(); handleUpdateEstado(t.id, "completado"); }}
                      className="mt-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-200">
                      Finalizar turno
                    </button>
                  )}
                </div>
              ))}
              {turnos.length === 0 && !loading && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No hay turnos registrados</div>
              )}
            </div>
          </div>

          {/* Eventos del turno seleccionado */}
          {selectedTurno && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Novedades — {selectedTurno.guardia_nombre}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedTurno.fecha_inicio).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {eventos.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin novedades registradas</p>
                ) : eventos.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-sm">
                    <span className="text-lg">{EVENTO_ICONS[ev.tipo]}</span>
                    <div>
                      <span className="font-medium capitalize text-gray-700">{ev.tipo}: </span>
                      <span className="text-gray-600">{ev.descripcion}</span>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(ev.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-4">
                <form onSubmit={handleCrearEvento} className="space-y-2">
                  <div className="flex gap-2">
                    <select name="tipo" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-shrink-0">
                      {Object.keys(EVENTO_ICONS).map((t) => (
                        <option key={t} value={t}>{EVENTO_ICONS[t]} {t}</option>
                      ))}
                    </select>
                    <input name="descripcion" required placeholder="Descripción de la novedad..." className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <button type="submit" className="w-full bg-primary text-white py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90">
                    Registrar novedad
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Guardias list ────────────────────────────────────────────────── */}
      {tab === "guardias" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Personal de seguridad</h2>
          </div>
          {guardias.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No hay guardias registrados</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {guardias.map((g) => (
                <div key={g.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                    {g.nombre?.[0] ?? "G"}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{g.nombre}</div>
                    <div className="text-xs text-gray-500">{g.cedula} · {g.telefono}</div>
                  </div>
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Programar turno ───────────────────────────────────────── */}
      {showTurnoForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Programar turno</h3>
            <form onSubmit={handleCrearTurno} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guardia</label>
                <select name="guardia_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {guardias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                  <input name="fecha_inicio" type="datetime-local" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                  <input name="fecha_fin" type="datetime-local" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de turno</label>
                <select name="tipo_turno" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="dia">☀️ Día</option>
                  <option value="noche">🌙 Noche</option>
                  <option value="fin_semana">📅 Fin de semana</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea name="notas" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowTurnoForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                  Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
