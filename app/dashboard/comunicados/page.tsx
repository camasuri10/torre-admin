"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;

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

type Comunicado = {
  id: number;
  titulo: string;
  contenido: string;
  tipo: string;
  fecha: string;
  created_at: string;
  autor_nombre: string | null;
  edificio_nombre: string | null;
};

type NuevoComunicado = {
  titulo: string;
  contenido: string;
  tipo: string;
};

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [filtro, setFiltro]           = useState("todos");
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState<NuevoComunicado>({ titulo: "", contenido: "", tipo: "informativo" });

  async function load() {
    try {
      const data = await api.comunicados.list({ edificio_id: EDIFICIO_ID });
      setComunicados(data);
    } catch (err) {
      console.error("Error cargando comunicados", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.comunicados.create({
        edificio_id: EDIFICIO_ID,
        titulo:      form.titulo,
        contenido:   form.contenido,
        tipo:        form.tipo,
      });
      setForm({ titulo: "", contenido: "", tipo: "informativo" });
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

  const byTipo = filtro === "todos" ? comunicados : comunicados.filter((c) => c.tipo === filtro);
  const sq = search.trim().toLowerCase();
  const filtrados = sq
    ? byTipo.filter((c) => c.titulo.toLowerCase().includes(sq) || c.contenido.toLowerCase().includes(sq))
    : byTipo;

  function formatFecha(raw: string) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? "Cargando…" : `${filtrados.length} comunicado${filtrados.length !== 1 ? "s" : ""} publicado${filtrados.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "✕ Cancelar" : "+ Nuevo comunicado"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Nuevo comunicado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Contenido</label>
              <textarea
                required
                rows={3}
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                placeholder="Escribe el contenido del comunicado…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
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
              {saving ? "Publicando…" : "Publicar"}
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
          {filtrados.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="text-3xl flex-shrink-0">{TIPO_ICONO[c.tipo] ?? "📄"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="font-semibold text-gray-900 text-base">{c.titulo}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TIPO_BADGE[c.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                        {TIPO_LABELS[c.tipo] ?? c.tipo}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.contenido}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>📅 {formatFecha(c.fecha || c.created_at)}</span>
                      {c.autor_nombre && <span>✍️ {c.autor_nombre}</span>}
                      {c.edificio_nombre && <span>🏢 {c.edificio_nombre}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
