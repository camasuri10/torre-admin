"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

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
  informativo:  "ℹ️",
  urgente:      "🚨",
  convocatoria: "📋",
  recordatorio: "🔔",
};

const TIPOS = ["todos", "informativo", "urgente", "convocatoria", "recordatorio"] as const;

const CANAL_LABELS: Record<string, string> = {
  sistema:   "📱 Notificación en plataforma",
  email:     "📧 Email",
  whatsapp:  "💬 WhatsApp",
};

type Comunicado = {
  id: number;
  titulo: string;
  contenido: string;
  tipo: string;
  fecha: string;
  created_at: string;
  autor_nombre: string | null;
  edificio_nombre: string | null;
  canales: string | null;
  fecha_programada: string | null;
  imagen_url: string | null;
  leido?: boolean;
};

type EnvioRecord = {
  id: number;
  canal: string;
  enviado_at: string;
  leido: boolean;
  usuario_nombre: string;
  usuario_rol: string;
  usuario_email: string;
};

type NuevoComunicado = {
  titulo: string;
  contenido: string;
  tipo: string;
  canales: string[];
  fecha_programada: string;
};

export default function ComunicadosPage() {
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;
  const usuarioId = user ? parseInt(user.sub) : 0;
  const canEdit = ["administrador", "superadmin"].includes(user?.rol ?? "");
  const isResidente = ["propietario", "inquilino"].includes(user?.rol ?? "");

  const [comunicados, setComunicados]   = useState<Comunicado[]>([]);
  const [filtro, setFiltro]             = useState("todos");
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState<NuevoComunicado>({
    titulo: "", contenido: "", tipo: "informativo",
    canales: ["sistema"], fecha_programada: "",
  });
  const [imagenFile, setImagenFile]     = useState<File | null>(null);
  const [auditComunicado, setAuditComunicado] = useState<number | null>(null);
  const [auditData, setAuditData]       = useState<EnvioRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await api.comunicados.list({ edificio_id: edificioId, usuario_id: usuarioId });
      setComunicados(data);
    } catch (err) {
      console.error("Error cargando comunicados", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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
    if (form.canales.length === 0) {
      alert("Selecciona al menos un canal de envío.");
      return;
    }
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
      await api.comunicados.create({
        edificio_id:     edificioId,
        titulo:          form.titulo,
        contenido:       form.contenido,
        tipo:            form.tipo,
        canales:         form.canales,
        fecha_programada: form.fecha_programada || undefined,
        imagen_url,
      });
      setForm({ titulo: "", contenido: "", tipo: "informativo", canales: ["sistema"], fecha_programada: "" });
      setImagenFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("Error creando comunicado", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este comunicado?")) return;
    try {
      await api.comunicados.delete(id);
      await load();
    } catch (err) {
      console.error("Error eliminando comunicado", err);
    }
  }

  async function handleMarcarLeido(id: number) {
    if (!usuarioId) return;
    try {
      await api.comunicados.marcarLeido(id, usuarioId);
      setComunicados((prev) => prev.map((c) => c.id === id ? { ...c, leido: true } : c));
    } catch {
      // ignore
    }
  }

  async function loadAudit(id: number) {
    setAuditComunicado(id);
    setAuditLoading(true);
    try {
      const data = await api.comunicados.envios(id);
      setAuditData(data);
    } catch {
      setAuditData([]);
    } finally {
      setAuditLoading(false);
    }
  }

  const byTipo    = filtro === "todos" ? comunicados : comunicados.filter((c) => c.tipo === filtro);
  const sq        = search.trim().toLowerCase();
  const filtrados = sq
    ? byTipo.filter((c) => c.titulo.toLowerCase().includes(sq) || c.contenido.toLowerCase().includes(sq))
    : byTipo;

  function formatFecha(raw: string) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }

  function parseCanales(raw: string | null): string[] {
    if (!raw) return ["sistema"];
    try { return JSON.parse(raw); } catch { return ["sistema"]; }
  }

  const noLeidos = comunicados.filter((c) => !c.leido).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {isResidente && noLeidos > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full mb-1">
              📬 {noLeidos} sin leer
            </span>
          )}
          <p className="text-sm text-gray-500">
            {loading ? "Cargando…" : `${filtrados.length} comunicado${filtrados.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
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
                required
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Título del comunicado"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
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
                type="datetime-local"
                value={form.fecha_programada}
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
                      type="checkbox"
                      checked={form.canales.includes(canal)}
                      onChange={() => toggleCanal(canal)}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Contenido *</label>
              <textarea
                required
                rows={3}
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                placeholder="Escribe el contenido del comunicado…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Imagen adjunta (opcional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setImagenFile(e.target.files?.[0] ?? null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              {imagenFile && (
                <p className="text-xs text-gray-400 mt-1">📎 {imagenFile.name}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o contenido…"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFiltro(tipo)}
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
                onClick={() => noLeido && handleMarcarLeido(c.id)}
                className={`bg-white rounded-xl border shadow-sm p-6 transition-shadow ${
                  noLeido
                    ? "border-blue-200 hover:shadow-md cursor-pointer"
                    : "border-gray-100 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="text-3xl">{TIPO_ICONO[c.tipo] ?? "📄"}</div>
                      {noLeido && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className={`font-semibold text-base ${noLeido ? "text-gray-900" : "text-gray-700"}`}>
                          {c.titulo}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[c.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                          {TIPO_LABELS[c.tipo] ?? c.tipo}
                        </span>
                        {noLeido && (
                          <span className="text-xs font-medium text-blue-600">Nuevo</span>
                        )}
                        {c.fecha_programada && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                            🕐 Programado: {formatFecha(c.fecha_programada)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.contenido}</p>
                      {c.imagen_url && (
                        <div className="mb-3">
                          <img
                            src={c.imagen_url}
                            alt="Imagen del comunicado"
                            className="max-h-48 rounded-lg border border-gray-100 object-cover"
                          />
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
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            auditComunicado === c.id ? setAuditComunicado(null) : loadAudit(c.id);
                          }}
                          className="text-xs text-gray-400 hover:text-primary"
                        >
                          {auditComunicado === c.id ? "✕ cerrar" : "📊 envíos"}
                        </button>
                      </>
                    )}
                    {isResidente && c.leido && (
                      <span className="text-xs text-gray-300">✓ Leído</span>
                    )}
                  </div>
                </div>

                {/* Audit trail (solo admin) */}
                {canEdit && auditComunicado === c.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Auditoría de envíos</p>
                    {auditLoading ? (
                      <p className="text-xs text-gray-400">Cargando…</p>
                    ) : auditData.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin registros de envío aún.</p>
                    ) : (
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
                                  {env.leido
                                    ? <span className="text-green-600 font-medium">✓ Sí</span>
                                    : <span className="text-gray-300">No</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
  );
}
