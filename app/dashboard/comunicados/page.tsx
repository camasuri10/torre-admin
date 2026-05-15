"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getUser } from "@/lib/auth";

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  informativo:  "Informativo",
  urgente:      "Urgente",
  convocatoria: "Convocatoria",
  recordatorio: "Recordatorio",
};
const TIPO_BADGE: Record<string, string> = {
  informativo:  "bg-blue-100 text-blue-700",
  urgente:      "bg-red-100 text-red-700",
  convocatoria: "bg-purple-100 text-purple-700",
  recordatorio: "bg-amber-100 text-amber-700",
};
const TIPO_ICONO: Record<string, string> = {
  informativo: "ℹ️", urgente: "🚨", convocatoria: "📋", recordatorio: "🔔",
};
const TIPOS = ["todos", "informativo", "urgente", "convocatoria", "recordatorio"] as const;
const CANAL_LABELS: Record<string, string> = {
  sistema: "📱 Notificación en plataforma",
  email:   "📧 Email",
  whatsapp: "💬 WhatsApp",
};
const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-600",
  activa:   "bg-green-100 text-green-700",
  cerrada:  "bg-slate-100 text-slate-600",
};
const TIPO_PREGUNTA_LABELS: Record<string, string> = {
  unica:    "Selección única",
  multiple: "Selección múltiple",
  escala:   "Escala numérica",
  texto:    "Texto libre",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Comunicado = {
  id: number; titulo: string; contenido: string; tipo: string;
  fecha: string; created_at: string; autor_nombre: string | null;
  edificio_nombre: string | null; canales: string | null;
  fecha_programada: string | null; imagen_url: string | null; leido?: boolean;
};
type EnvioRecord = {
  id: number; canal: string; enviado_at: string; leido: boolean;
  usuario_nombre: string; usuario_rol: string; usuario_email: string;
};
type PreguntaForm = {
  texto: string; tipo: "unica" | "multiple" | "escala" | "texto";
  requerida: boolean; escala_max: number; opciones: string[];
};

function mkPregunta(): PreguntaForm {
  return { texto: "", tipo: "unica", requerida: true, escala_max: 5, opciones: ["", ""] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseCanales(raw: string | null): string[] {
  if (!raw) return ["sistema"];
  try { return JSON.parse(raw); } catch { return ["sistema"]; }
}
function formatFecha(raw: string) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function UnidadesSelector({
  unidades, todasUnidades, setTodasUnidades, selected, setSelected,
  consejo, setConsejo,
}: {
  unidades: any[]; todasUnidades: boolean; setTodasUnidades: (v: boolean) => void;
  selected: number[]; setSelected: (v: number[]) => void;
  consejo?: boolean; setConsejo?: (v: boolean) => void;
}) {
  function toggle(id: number) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-gray-600 mb-2">Destinatarios</label>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <label className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
          <input
            type="radio" checked={todasUnidades && !consejo}
            onChange={() => { setTodasUnidades(true); setConsejo?.(false); }}
            className="text-primary"
          />
          <span className="text-sm text-gray-700 font-medium">Todos los apartamentos</span>
        </label>
        <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors border-t border-gray-100">
          <input
            type="radio" checked={!todasUnidades && !consejo}
            onChange={() => { setTodasUnidades(false); setConsejo?.(false); }}
            className="text-primary"
          />
          <span className="text-sm text-gray-700 font-medium">Seleccionar apartamentos específicos</span>
        </label>
        {!todasUnidades && !consejo && (
          <div className="border-t border-gray-100 p-2 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
            {unidades.length === 0
              ? <p className="text-xs text-gray-400 col-span-3 py-2 text-center">Cargando unidades…</p>
              : unidades.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 text-xs">
                    <input
                      type="checkbox" checked={selected.includes(u.id)}
                      onChange={() => toggle(u.id)} className="text-primary rounded"
                    />
                    <span className="text-gray-700 truncate">{u.numero}</span>
                  </label>
                ))
            }
          </div>
        )}
        {!todasUnidades && !consejo && selected.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-1.5 bg-blue-50 text-xs text-blue-700">
            {selected.length} apartamento{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}
          </div>
        )}
        {setConsejo !== undefined && (
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors border-t border-gray-100">
            <input
              type="radio" checked={!!consejo}
              onChange={() => { setTodasUnidades(false); setConsejo(true); }}
              className="text-primary"
            />
            <span className="text-sm text-gray-700 font-medium">Consejo de administración</span>
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Resultados por tipo de pregunta ─────────────────────────────────────────
function ResultadoPregunta({ p }: { p: any }) {
  const max = p.opciones?.length
    ? Math.max(...p.opciones.map((o: any) => o.count), 1)
    : 1;

  if (p.tipo === "unica" || p.tipo === "multiple") {
    return (
      <div className="space-y-2">
        {(p.opciones ?? []).map((o: any, i: number) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
              <span>{o.texto}</span>
              <span className="font-semibold text-gray-900">{o.count}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.round((o.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (p.tipo === "escala") {
    const dist = p.distribucion ?? {};
    const distData = Object.entries(dist).map(([v, n]) => ({ valor: `${v}★`, count: n as number }));
    return (
      <div>
        <div className="text-2xl font-bold text-primary mb-1">
          {p.promedio?.toFixed(1) ?? "—"}
          <span className="text-sm text-gray-400 font-normal"> / {p.escala_max ?? 5}</span>
        </div>
        {distData.length > 0 && (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={distData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="valor" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Votos" fill="#1a5276" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  if (p.tipo === "texto") {
    return (
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {(p.respuestas ?? []).length === 0
          ? <p className="text-xs text-gray-400">Sin respuestas de texto aún.</p>
          : (p.respuestas ?? []).map((r: string, i: number) => (
              <div key={i} className="text-xs text-gray-700 bg-gray-50 rounded px-3 py-2 border border-gray-100">
                {r}
              </div>
            ))
        }
      </div>
    );
  }

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ComunicadosPage() {
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;
  const usuarioId = user ? parseInt(user.sub) : 0;
  const canEdit = ["administrador", "superadmin"].includes(user?.rol ?? "");
  const isResidente = ["propietario", "inquilino"].includes(user?.rol ?? "");

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"comunicados" | "encuestas">("comunicados");

  // ── Comunicados state ──────────────────────────────────────────────────────
  const [comunicados, setComunicados]   = useState<Comunicado[]>([]);
  const [filtro, setFiltro]             = useState("todos");
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState({
    titulo: "", contenido: "", tipo: "informativo",
    canales: ["sistema"] as string[], fecha_programada: "",
  });
  const [imagenFile, setImagenFile]     = useState<File | null>(null);
  const [auditComunicado, setAuditComunicado] = useState<number | null>(null);
  const [auditData, setAuditData]       = useState<EnvioRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);

  // ── Unidades para selector destinatarios ──────────────────────────────────
  const [unidades, setUnidades]           = useState<any[]>([]);
  const [comTodasUnidades, setComTodasUnidades] = useState(true);
  const [comSelectedUnidades, setComSelectedUnidades] = useState<number[]>([]);
  const [comDestinatarioConsejo, setComDestinatarioConsejo] = useState(false);

  // ── Encuestas state ────────────────────────────────────────────────────────
  const [encuestas, setEncuestas]         = useState<any[]>([]);
  const [loadingEnc, setLoadingEnc]       = useState(false);
  const [encView, setEncView]             = useState<"lista" | "form" | "resultados" | "responder">("lista");
  const [encSeleccionada, setEncSeleccionada] = useState<any | null>(null);
  const [resultados, setResultados]       = useState<any | null>(null);
  const [savingEnc, setSavingEnc]         = useState(false);
  const [submitResp, setSubmitResp]       = useState(false);

  const [formEnc, setFormEnc] = useState({
    titulo: "", descripcion: "", anonima: false, fecha_cierre: "",
  });
  const [encPreguntas, setEncPreguntas]   = useState<PreguntaForm[]>([mkPregunta()]);
  const [encTodasUnidades, setEncTodasUnidades] = useState(true);
  const [encSelectedUnidades, setEncSelectedUnidades] = useState<number[]>([]);

  // Respuestas del residente (pregunta_id → {opcion_ids?, texto_libre?, valor_escala?})
  const [respuestas, setRespuestas] = useState<Record<number, any>>({});

  // ── Load functions ─────────────────────────────────────────────────────────
  async function loadComunicados() {
    try {
      const data = await api.comunicados.list({ edificio_id: edificioId, usuario_id: usuarioId });
      setComunicados(data);
    } catch (err) {
      console.error("Error cargando comunicados", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEncuestas() {
    setLoadingEnc(true);
    try {
      const data = await api.encuestas.list(edificioId);
      setEncuestas(data);
    } catch (err) {
      console.error("Error cargando encuestas", err);
    } finally {
      setLoadingEnc(false);
    }
  }

  async function loadUnidades() {
    if (unidades.length > 0) return;
    try {
      const data = await api.edificios.unidades(edificioId);
      setUnidades(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => { loadComunicados(); }, []);
  useEffect(() => {
    if (activeTab === "encuestas" && encuestas.length === 0) loadEncuestas();
  }, [activeTab]);

  // ── Comunicados handlers ───────────────────────────────────────────────────
  function toggleCanal(canal: string) {
    setForm((f) => ({
      ...f,
      canales: f.canales.includes(canal)
        ? f.canales.filter((c) => c !== canal)
        : [...f.canales, canal],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.canales.length === 0) { alert("Selecciona al menos un canal de envío."); return; }
    setSaving(true);
    try {
      let imagen_url: string | undefined;
      if (imagenFile) {
        const reader = new FileReader();
        imagen_url = await new Promise<string>((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(imagenFile);
        });
      }
      const unidades_destino = comDestinatarioConsejo || comTodasUnidades
        ? null
        : comSelectedUnidades.length > 0 ? JSON.stringify(comSelectedUnidades) : null;
      await api.comunicados.create({
        edificio_id: edificioId, titulo: form.titulo, contenido: form.contenido,
        tipo: form.tipo, canales: form.canales,
        fecha_programada: form.fecha_programada || undefined,
        imagen_url, unidades_destino,
        ...(comDestinatarioConsejo ? { destinatario_tipo: "consejo" } : {}),
      });
      setForm({ titulo: "", contenido: "", tipo: "informativo", canales: ["sistema"], fecha_programada: "" });
      setImagenFile(null);
      setComTodasUnidades(true); setComSelectedUnidades([]); setComDestinatarioConsejo(false);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      await loadComunicados();
    } catch (err) {
      console.error("Error creando comunicado", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este comunicado?")) return;
    try { await api.comunicados.delete(id); await loadComunicados(); } catch { /**/ }
  }

  async function handleMarcarLeido(id: number) {
    if (!usuarioId) return;
    try {
      await api.comunicados.marcarLeido(id, usuarioId);
      setComunicados((prev) => prev.map((c) => c.id === id ? { ...c, leido: true } : c));
    } catch { /**/ }
  }

  async function loadAudit(id: number) {
    setAuditComunicado(id); setAuditLoading(true);
    try { const data = await api.comunicados.envios(id); setAuditData(data); }
    catch { setAuditData([]); } finally { setAuditLoading(false); }
  }

  // ── Encuestas handlers ─────────────────────────────────────────────────────
  function addPregunta() {
    setEncPreguntas((prev) => [...prev, mkPregunta()]);
  }
  function removePregunta(i: number) {
    setEncPreguntas((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updatePregunta(i: number, patch: Partial<PreguntaForm>) {
    setEncPreguntas((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  }
  function addOpcion(pi: number) {
    setEncPreguntas((prev) => prev.map((p, idx) =>
      idx === pi ? { ...p, opciones: [...p.opciones, ""] } : p
    ));
  }
  function removeOpcion(pi: number, oi: number) {
    setEncPreguntas((prev) => prev.map((p, idx) =>
      idx === pi ? { ...p, opciones: p.opciones.filter((_, j) => j !== oi) } : p
    ));
  }
  function updateOpcion(pi: number, oi: number, val: string) {
    setEncPreguntas((prev) => prev.map((p, idx) =>
      idx === pi ? { ...p, opciones: p.opciones.map((o, j) => j === oi ? val : o) } : p
    ));
  }

  async function handleCreateEncuesta(e: React.FormEvent) {
    e.preventDefault();
    if (encPreguntas.length === 0) { alert("Agrega al menos una pregunta."); return; }
    setSavingEnc(true);
    try {
      const preguntas = encPreguntas.map((p, i) => ({
        texto: p.texto, tipo: p.tipo, orden: i + 1,
        requerida: p.requerida, escala_max: p.escala_max,
        opciones: p.tipo === "escala" || p.tipo === "texto"
          ? []
          : p.opciones.filter(Boolean).map((o, j) => ({ texto: o, orden: j + 1 })),
      }));
      const unidades_destino = encTodasUnidades
        ? null
        : encSelectedUnidades.length > 0 ? JSON.stringify(encSelectedUnidades) : null;
      await api.encuestas.create({
        edificio_id: edificioId, titulo: formEnc.titulo,
        descripcion: formEnc.descripcion || null,
        anonima: formEnc.anonima,
        fecha_cierre: formEnc.fecha_cierre || null,
        unidades_destino, preguntas,
      });
      setFormEnc({ titulo: "", descripcion: "", anonima: false, fecha_cierre: "" });
      setEncPreguntas([mkPregunta()]);
      setEncTodasUnidades(true); setEncSelectedUnidades([]);
      setEncView("lista");
      await loadEncuestas();
    } catch (err) {
      console.error("Error creando encuesta", err);
    } finally {
      setSavingEnc(false);
    }
  }

  async function handleCambiarEstado(id: number, estado: string) {
    try {
      await api.encuestas.cambiarEstado(id, estado);
      await loadEncuestas();
    } catch { /**/ }
  }

  async function handleDeleteEncuesta(id: number) {
    if (!confirm("¿Eliminar esta encuesta?")) return;
    try { await api.encuestas.delete(id); await loadEncuestas(); } catch { /**/ }
  }

  async function handleVerResultados(enc: any) {
    setEncSeleccionada(enc);
    setEncView("resultados");
    try {
      const data = await api.encuestas.resultados(enc.id);
      setResultados(data);
    } catch {
      setResultados(null);
    }
  }

  async function handleResponder(enc: any) {
    setEncSeleccionada(enc);
    setRespuestas({});
    // Load full encuesta to get preguntas
    try {
      const data = await api.encuestas.get(enc.id);
      setEncSeleccionada(data);
    } catch { /**/ }
    setEncView("responder");
  }

  function setRespuesta(preguntaId: number, tipo: string, value: any) {
    setRespuestas((prev) => {
      const updated = { ...prev };
      if (tipo === "unica") {
        updated[preguntaId] = { opcion_ids: [value] };
      } else if (tipo === "multiple") {
        const cur = prev[preguntaId]?.opcion_ids ?? [];
        updated[preguntaId] = {
          opcion_ids: cur.includes(value) ? cur.filter((x: number) => x !== value) : [...cur, value],
        };
      } else if (tipo === "escala") {
        updated[preguntaId] = { valor_escala: value };
      } else if (tipo === "texto") {
        updated[preguntaId] = { texto_libre: value };
      }
      return updated;
    });
  }

  async function handleSubmitRespuesta(e: React.FormEvent) {
    e.preventDefault();
    setSubmitResp(true);
    try {
      const payload = {
        usuario_id: usuarioId,
        unidad_id: null,
        respuestas: (encSeleccionada?.preguntas ?? []).map((p: any) => ({
          pregunta_id: p.id,
          opcion_ids: respuestas[p.id]?.opcion_ids ?? [],
          texto_libre: respuestas[p.id]?.texto_libre ?? null,
          valor_escala: respuestas[p.id]?.valor_escala ?? null,
        })),
      };
      await api.encuestas.responder(encSeleccionada.id, payload);
      setEncView("lista");
      await loadEncuestas();
    } catch (err: any) {
      alert(err?.message ?? "Error al enviar respuesta");
    } finally {
      setSubmitResp(false);
    }
  }

  // ── Comunicados filtered ───────────────────────────────────────────────────
  const byTipo    = filtro === "todos" ? comunicados : comunicados.filter((c) => c.tipo === filtro);
  const sq        = search.trim().toLowerCase();
  const filtrados = sq
    ? byTipo.filter((c) => c.titulo.toLowerCase().includes(sq) || c.contenido.toLowerCase().includes(sq))
    : byTipo;
  const noLeidos  = comunicados.filter((c) => !c.leido).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("comunicados")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "comunicados"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📢 Comunicados
          {noLeidos > 0 && isResidente && (
            <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {noLeidos}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("encuestas")}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "encuestas"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📊 Encuestas
        </button>
      </div>

      {/* ═══════════════════ TAB COMUNICADOS ════════════════════════════════ */}
      {activeTab === "comunicados" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {loading ? "Cargando…" : `${filtrados.length} comunicado${filtrados.length !== 1 ? "s" : ""}`}
            </p>
            {canEdit && (
              <button
                onClick={() => { setShowForm((v) => !v); if (!showForm) loadUnidades(); }}
                className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {showForm ? "✕ Cancelar" : "+ Nuevo comunicado"}
              </button>
            )}
          </div>

          {/* Create form */}
          {showForm && canEdit && (
            <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Nuevo comunicado</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                  <input
                    required value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Título del comunicado"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    {TIPOS.filter((t) => t !== "todos").map((t) => (
                      <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Programar envío (opcional)</label>
                  <input
                    type="datetime-local" value={form.fecha_programada}
                    onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Canales de envío *</label>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(CANAL_LABELS).map(([canal, label]) => (
                      <label key={canal} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox" checked={form.canales.includes(canal)}
                          onChange={() => toggleCanal(canal)}
                          className="rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <UnidadesSelector
                  unidades={unidades} todasUnidades={comTodasUnidades}
                  setTodasUnidades={setComTodasUnidades}
                  selected={comSelectedUnidades} setSelected={setComSelectedUnidades}
                  consejo={comDestinatarioConsejo} setConsejo={setComDestinatarioConsejo}
                />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contenido *</label>
                  <textarea
                    required rows={3} value={form.contenido}
                    onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                    placeholder="Escribe el contenido del comunicado…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Imagen adjunta (opcional)</label>
                  <input
                    ref={fileRef} type="file" accept="image/*"
                    onChange={(e) => setImagenFile(e.target.files?.[0] ?? null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  {imagenFile && <p className="text-xs text-gray-400 mt-1">📎 {imagenFile.name}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {saving ? "Publicando…" : form.fecha_programada ? "Programar" : "Publicar"}
                </button>
              </div>
            </form>
          )}

          {/* Search + Filtros */}
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título o contenido…"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((tipo) => (
                <button
                  key={tipo} onClick={() => setFiltro(tipo)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    filtro === tipo
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
                  }`}
                >
                  {tipo === "todos" ? "Todos" : TIPO_LABELS[tipo]}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Cargando comunicados…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No hay comunicados para mostrar.</div>
          ) : (
            <div className="space-y-4">
              {filtrados.map((c) => {
                const canales = parseCanales(c.canales);
                const noLeido = isResidente && !c.leido;
                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-xl border shadow-sm p-6 transition-shadow ${noLeido ? "border-blue-200" : "border-gray-100"} hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="text-3xl">{TIPO_ICONO[c.tipo] ?? "📄"}</div>
                          {noLeido && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <h3 className={`font-semibold text-base ${noLeido ? "text-gray-900" : "text-gray-700"}`}>{c.titulo}</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[c.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                              {TIPO_LABELS[c.tipo] ?? c.tipo}
                            </span>
                            {noLeido && <span className="text-xs font-medium text-blue-600">Nuevo</span>}
                            {c.fecha_programada && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                                🕐 Programado: {formatFecha(c.fecha_programada)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.contenido}</p>
                          {c.imagen_url && (
                            <div className="mb-3">
                              <img src={c.imagen_url} alt="Imagen del comunicado" className="max-h-48 rounded-lg border border-gray-100 object-cover" />
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                            <span>📅 {formatFecha(c.fecha || c.created_at)}</span>
                            {c.autor_nombre && <span>✍️ {c.autor_nombre}</span>}
                            {c.edificio_nombre && <span>🏢 {c.edificio_nombre}</span>}
                            {canEdit && (
                              <span className="flex gap-1">
                                {canales.map((canal) => (
                                  <span key={canal} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">
                                    {canal === "sistema" ? "📱" : canal === "email" ? "📧" : "💬"}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {canEdit && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="text-xs text-red-500 hover:underline">Eliminar</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); auditComunicado === c.id ? setAuditComunicado(null) : loadAudit(c.id); }}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${auditComunicado === c.id ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"}`}
                            >
                              {auditComunicado === c.id ? "✕ Cerrar" : "📊 Estadísticas"}
                            </button>
                          </>
                        )}
                        {isResidente && (
                          c.leido
                            ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">✓ Leído</span>
                            : <button onClick={(e) => { e.stopPropagation(); handleMarcarLeido(c.id); }} className="text-xs text-white bg-primary px-3 py-1.5 rounded-full hover:bg-primary/90 transition-colors font-medium">
                                Marcar leído
                              </button>
                        )}
                      </div>
                    </div>

                    {/* Audit trail */}
                    {canEdit && auditComunicado === c.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Auditoría de envíos</p>
                        {auditLoading ? (
                          <p className="text-xs text-gray-400">Cargando…</p>
                        ) : auditData.length === 0 ? (
                          <p className="text-xs text-gray-400">Sin registros de envío aún.</p>
                        ) : (
                          <div className="space-y-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-100">
                                    <th className="text-left pb-1 font-medium">Residente</th>
                                    <th className="text-left pb-1 font-medium">Canal</th>
                                    <th className="text-left pb-1 font-medium">Enviado</th>
                                    <th className="text-left pb-1 font-medium">Leído</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {auditData.map((env) => (
                                    <tr key={env.id}>
                                      <td className="py-1 pr-3">
                                        <div className="font-medium text-gray-700">{env.usuario_nombre}</div>
                                        <div className="text-gray-400 text-[10px]">{env.usuario_email}</div>
                                      </td>
                                      <td className="py-1 pr-3">
                                        {env.canal === "sistema" ? "📱 Plataforma" : env.canal === "email" ? "📧 Email" : "💬 WhatsApp"}
                                      </td>
                                      <td className="py-1 pr-3 text-gray-500">
                                        {new Date(env.enviado_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                                      </td>
                                      <td className="py-1">
                                        {env.leido ? <span className="text-green-600 font-medium">✓ Sí</span> : <span className="text-gray-300">No</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="w-full max-w-sm">
                              <p className="text-xs font-semibold text-gray-500 mb-2">Envíos por canal</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                  data={["sistema", "email", "whatsapp"].map((canal) => ({
                                    canal: canal === "sistema" ? "Plataforma" : canal === "email" ? "Email" : "WhatsApp",
                                    total: auditData.filter((e) => e.canal === canal).length,
                                    leidos: auditData.filter((e) => e.canal === canal && e.leido).length,
                                  }))}
                                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                                >
                                  <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
                                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                  <Tooltip wrapperStyle={{ fontSize: 12 }} />
                                  <Bar dataKey="total" name="Enviados" fill="#2e86c1" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="leidos" name="Leídos" fill="#1e8449" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB ENCUESTAS ══════════════════════════════════ */}
      {activeTab === "encuestas" && (
        <div className="space-y-6">

          {/* ── Lista de encuestas ─────────────────────────────────────────── */}
          {encView === "lista" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {loadingEnc ? "Cargando…" : `${encuestas.length} encuesta${encuestas.length !== 1 ? "s" : ""}`}
                </p>
                {canEdit && (
                  <button
                    onClick={() => { setEncView("form"); loadUnidades(); }}
                    className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    + Nueva encuesta
                  </button>
                )}
              </div>

              {loadingEnc ? (
                <div className="text-center py-12 text-gray-400 text-sm">Cargando encuestas…</div>
              ) : encuestas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No hay encuestas aún.</div>
              ) : (
                <div className="space-y-4">
                  {encuestas.map((enc) => (
                    <div key={enc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-gray-900 text-base">{enc.titulo}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[enc.estado] ?? "bg-gray-100 text-gray-600"}`}>
                              {enc.estado}
                            </span>
                            {enc.anonima && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">🔒 Anónima</span>
                            )}
                            {enc.unidades_destino && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                🎯 {(() => { try { return JSON.parse(enc.unidades_destino).length; } catch { return "?"; } })()} aptos
                              </span>
                            )}
                          </div>
                          {enc.descripcion && <p className="text-sm text-gray-500 mb-2">{enc.descripcion}</p>}
                          <p className="text-xs text-gray-400">
                            📊 {enc.total_respuestas} respuesta{enc.total_respuestas !== 1 ? "s" : ""}
                            {enc.fecha_cierre && <span className="ml-3">⏰ Cierra: {formatFecha(enc.fecha_cierre)}</span>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {canEdit && (
                            <>
                              {enc.estado === "borrador" && (
                                <>
                                  <button onClick={() => handleCambiarEstado(enc.id, "activa")} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors">
                                    Activar
                                  </button>
                                  <button onClick={() => handleDeleteEncuesta(enc.id)} className="text-xs text-red-500 hover:underline">
                                    Eliminar
                                  </button>
                                </>
                              )}
                              {enc.estado === "activa" && (
                                <>
                                  <button onClick={() => handleVerResultados(enc)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                                    Ver resultados
                                  </button>
                                  <button onClick={() => handleCambiarEstado(enc.id, "cerrada")} className="text-xs text-gray-500 hover:underline">
                                    Cerrar
                                  </button>
                                </>
                              )}
                              {enc.estado === "cerrada" && (
                                <button onClick={() => handleVerResultados(enc)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                                  Ver resultados
                                </button>
                              )}
                            </>
                          )}
                          {isResidente && enc.estado === "activa" && (
                            enc.ya_respondio
                              ? <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">Ya respondiste ✓</span>
                              : <button onClick={() => handleResponder(enc)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                                  Responder
                                </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Formulario creación encuesta ───────────────────────────────── */}
          {encView === "form" && canEdit && (
            <form onSubmit={handleCreateEncuesta} className="space-y-6">
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setEncView("lista")} className="text-gray-400 hover:text-gray-600 text-sm">
                  ← Volver
                </button>
                <h3 className="font-semibold text-gray-900">Nueva encuesta</h3>
              </div>

              {/* Datos generales */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">Datos generales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                    <input
                      required value={formEnc.titulo}
                      onChange={(e) => setFormEnc({ ...formEnc, titulo: e.target.value })}
                      placeholder="Título de la encuesta"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
                    <textarea
                      rows={2} value={formEnc.descripcion}
                      onChange={(e) => setFormEnc({ ...formEnc, descripcion: e.target.value })}
                      placeholder="Describe el objetivo de la encuesta…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de cierre (opcional)</label>
                    <input
                      type="datetime-local" value={formEnc.fecha_cierre}
                      onChange={(e) => setFormEnc({ ...formEnc, fecha_cierre: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox" checked={formEnc.anonima}
                        onChange={(e) => setFormEnc({ ...formEnc, anonima: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </label>
                    <span className="text-sm text-gray-700">Encuesta anónima 🔒</span>
                  </div>
                  <UnidadesSelector
                    unidades={unidades} todasUnidades={encTodasUnidades}
                    setTodasUnidades={setEncTodasUnidades}
                    selected={encSelectedUnidades} setSelected={setEncSelectedUnidades}
                  />
                </div>
              </div>

              {/* Preguntas */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Preguntas ({encPreguntas.length})</h4>
                  <button
                    type="button" onClick={addPregunta}
                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary/20 transition-colors"
                  >
                    + Agregar pregunta
                  </button>
                </div>
                <div className="space-y-4">
                  {encPreguntas.map((p, pi) => (
                    <div key={pi} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-400 mt-2 w-5 shrink-0">{pi + 1}.</span>
                        <div className="flex-1 space-y-3">
                          <div>
                            <input
                              required value={p.texto}
                              onChange={(e) => updatePregunta(pi, { texto: e.target.value })}
                              placeholder="Escribe la pregunta…"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 items-center">
                            <select
                              value={p.tipo}
                              onChange={(e) => updatePregunta(pi, { tipo: e.target.value as PreguntaForm["tipo"], opciones: ["", ""] })}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                            >
                              {Object.entries(TIPO_PREGUNTA_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                            {p.tipo === "escala" && (
                              <select
                                value={p.escala_max}
                                onChange={(e) => updatePregunta(pi, { escala_max: parseInt(e.target.value) })}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                              >
                                <option value={5}>Escala 1-5</option>
                                <option value={10}>Escala 1-10</option>
                              </select>
                            )}
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox" checked={p.requerida}
                                onChange={(e) => updatePregunta(pi, { requerida: e.target.checked })}
                                className="rounded border-gray-300 text-primary"
                              />
                              Obligatoria
                            </label>
                          </div>

                          {/* Opciones para unica/multiple */}
                          {(p.tipo === "unica" || p.tipo === "multiple") && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-gray-500">Opciones de respuesta:</p>
                              {p.opciones.map((op, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <div className="w-3 h-3 shrink-0 rounded-full border-2 border-gray-300" />
                                  <input
                                    value={op}
                                    onChange={(e) => updateOpcion(pi, oi, e.target.value)}
                                    placeholder={`Opción ${oi + 1}`}
                                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 bg-white"
                                  />
                                  {p.opciones.length > 2 && (
                                    <button type="button" onClick={() => removeOpcion(pi, oi)} className="text-gray-300 hover:text-red-400 text-sm leading-none">✕</button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button" onClick={() => addOpcion(pi)}
                                className="text-xs text-primary hover:underline"
                              >
                                + Agregar opción
                              </button>
                            </div>
                          )}
                          {p.tipo === "escala" && (
                            <div className="flex gap-1">
                              {Array.from({ length: p.escala_max }, (_, i) => i + 1).map((n) => (
                                <div key={n} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-400 bg-white">{n}</div>
                              ))}
                            </div>
                          )}
                          {p.tipo === "texto" && (
                            <div className="h-8 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-300">
                              Respuesta de texto libre
                            </div>
                          )}
                        </div>
                        <button
                          type="button" onClick={() => removePregunta(pi)}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0 mt-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEncView("lista")} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingEnc} className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {savingEnc ? "Guardando…" : "Guardar como borrador"}
                </button>
              </div>
            </form>
          )}

          {/* ── Vista resultados ───────────────────────────────────────────── */}
          {encView === "resultados" && encSeleccionada && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setEncView("lista")} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
                <div>
                  <h3 className="font-semibold text-gray-900">{encSeleccionada.titulo}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {resultados?.total_sesiones ?? "—"} respuestas · estado: {encSeleccionada.estado}
                  </p>
                </div>
              </div>

              {!resultados ? (
                <div className="text-center py-12 text-gray-400 text-sm">Cargando resultados…</div>
              ) : resultados.preguntas?.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Sin preguntas en esta encuesta.</div>
              ) : (
                <div className="space-y-4">
                  {(resultados.preguntas ?? []).map((p: any, i: number) => (
                    <div key={p.pregunta_id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <p className="text-xs font-semibold text-gray-400 mb-0.5">Pregunta {i + 1} · {TIPO_PREGUNTA_LABELS[p.tipo] ?? p.tipo}</p>
                      <p className="text-sm font-medium text-gray-800 mb-3">{p.texto}</p>
                      <ResultadoPregunta p={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Modal responder ────────────────────────────────────────────── */}
          {encView === "responder" && encSeleccionada && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setEncView("lista")} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
                <div>
                  <h3 className="font-semibold text-gray-900">{encSeleccionada.titulo}</h3>
                  {encSeleccionada.descripcion && (
                    <p className="text-xs text-gray-500 mt-0.5">{encSeleccionada.descripcion}</p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmitRespuesta} className="space-y-4">
                {(encSeleccionada.preguntas ?? []).map((p: any, i: number) => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Pregunta {i + 1}</p>
                      <p className="text-sm font-medium text-gray-800">{p.texto}</p>
                    </div>

                    {p.tipo === "unica" && (
                      <div className="space-y-2">
                        {(p.opciones ?? []).map((op: any) => (
                          <label key={op.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio" name={`q_${p.id}`}
                              checked={(respuestas[p.id]?.opcion_ids ?? []).includes(op.id)}
                              onChange={() => setRespuesta(p.id, "unica", op.id)}
                              className="text-primary" required={p.requerida}
                            />
                            <span className="text-sm text-gray-700">{op.texto}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {p.tipo === "multiple" && (
                      <div className="space-y-2">
                        {(p.opciones ?? []).map((op: any) => (
                          <label key={op.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(respuestas[p.id]?.opcion_ids ?? []).includes(op.id)}
                              onChange={() => setRespuesta(p.id, "multiple", op.id)}
                              className="rounded border-gray-300 text-primary"
                            />
                            <span className="text-sm text-gray-700">{op.texto}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {p.tipo === "escala" && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: p.escala_max ?? 5 }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n} type="button"
                            onClick={() => setRespuesta(p.id, "escala", n)}
                            className={`w-10 h-10 rounded-lg border-2 text-sm font-semibold transition-colors ${
                              respuestas[p.id]?.valor_escala === n
                                ? "border-primary bg-primary text-white"
                                : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {p.tipo === "texto" && (
                      <textarea
                        rows={3}
                        value={respuestas[p.id]?.texto_libre ?? ""}
                        onChange={(e) => setRespuesta(p.id, "texto", e.target.value)}
                        placeholder="Escribe tu respuesta…"
                        required={p.requerida}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                      />
                    )}
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEncView("lista")} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
                  <button type="submit" disabled={submitResp} className="bg-primary text-white text-sm px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                    {submitResp ? "Enviando…" : "Enviar respuesta"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
