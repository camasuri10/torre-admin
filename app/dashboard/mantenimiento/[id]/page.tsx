"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Bitacora from "@/components/Bitacora";
import FileUploadGenerico from "@/components/FileUploadGenerico";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  en_proceso: "bg-blue-100 text-blue-700",
  resuelto: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};

const CAT_ICON: Record<string, string> = {
  plomeria: "🚿", electricidad: "⚡", estructura: "🏗️",
  ascensor: "🛗", zonas_comunes: "🌳", piscina: "🏊", otro: "🔧",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-orange-100 text-orange-700",
  baja: "bg-gray-100 text-gray-600",
};

// Flujo de estados (sin cancelado)
const FLUJO_ESTADOS = ["pendiente", "en_proceso", "resuelto"];

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function MantenimientoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const mantenimientoId = parseInt(id);
  const router = useRouter();
  const user = getUser();
  const canEdit = !["servicios", "propietario", "inquilino"].includes(user?.rol ?? "");

  const [mant, setMant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"detalles" | "archivos" | "historial">("detalles");
  const [bitacora, setBitacora] = useState<any[]>([]);
  const [loadingBit, setLoadingBit] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [saving, setSaving] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMant = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.mantenimientos.get(mantenimientoId);
      setMant(data);
    } catch { router.replace("/dashboard/mantenimiento"); }
    finally { setLoading(false); }
  }, [mantenimientoId, router]);

  useEffect(() => { loadMant(); }, [loadMant]);

  useEffect(() => {
    if (!mant) return;
    setLoadingBit(true);
    fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/bitacora`)
      .then((r) => r.json())
      .then((d) => setBitacora(Array.isArray(d) ? d : []))
      .catch(() => setBitacora([]))
      .finally(() => setLoadingBit(false));
  }, [mant?.id, mantenimientoId]);

  async function handleCambiarEstado(nuevoEstado: string) {
    if (!confirm(`¿Cambiar estado a "${ESTADO_LABEL[nuevoEstado]}"?`)) return;
    setAvanzando(true);
    try {
      await api.mantenimientos.update(mantenimientoId, { estado: nuevoEstado });
      await loadMant();
    } finally { setAvanzando(false); }
  }

  async function handleUploadArchivo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("nombre_archivo", file.name);
    fd.append("tipo", "otro");
    await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/archivos`, { method: "POST", body: fd });
    loadMant();
  }

  async function handleEditar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      titulo: fd.get("titulo"),
      descripcion: fd.get("descripcion") || null,
      categoria: fd.get("categoria"),
      prioridad: fd.get("prioridad"),
    };
    const venc = fd.get("fecha_vencimiento");
    if (venc) body.fecha_vencimiento = venc;
    try {
      await api.mantenimientos.update(mantenimientoId, body);
      setShowEditar(false);
      loadMant();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>;
  if (!mant) return null;

  const etapaIdx = FLUJO_ESTADOS.indexOf(mant.estado);
  const esFinalizado = mant.estado === "resuelto" || mant.estado === "cancelado";
  const archivos: any[] = mant.archivos ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Volver</button>
          <h2 className="text-xl font-bold text-gray-900">{mant.titulo}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[mant.estado]}`}>
              {ESTADO_LABEL[mant.estado]}
            </span>
            <span className="text-xs text-gray-400 capitalize">{mant.categoria}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORIDAD_COLOR[mant.prioridad]}`}>
              {mant.prioridad}
            </span>
            {mant.es_programado && (
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                📅 Programado {mant.periodicidad ? `· ${mant.periodicidad}` : ""}
              </span>
            )}
          </div>
        </div>
        {canEdit && !esFinalizado && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowEditar(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">✏️ Editar</button>
          </div>
        )}
      </div>

      {/* Stepper de estados */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {FLUJO_ESTADOS.map((estado, i) => {
            const done = etapaIdx > i;
            const active = etapaIdx === i;
            const siguiente = i === etapaIdx && i < FLUJO_ESTADOS.length - 1 ? FLUJO_ESTADOS[i + 1] : null;
            return (
              <div key={estado} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${active ? "bg-[#2e86c1] text-white ring-2 ring-[#2e86c1]/30" :
                      done ? "bg-[#1e8449] text-white" : "bg-gray-100 text-gray-400"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? "text-[#2e86c1]" : done ? "text-[#1e8449]" : "text-gray-400"}`}>
                    {ESTADO_LABEL[estado]}
                  </span>
                  {/* Botón de avance */}
                  {canEdit && active && siguiente && (
                    <button
                      onClick={() => handleCambiarEstado(siguiente)}
                      disabled={avanzando}
                      className="text-[10px] px-2 py-0.5 bg-[#2e86c1] text-white rounded hover:bg-[#1a5276] disabled:opacity-50 mt-1"
                    >
                      {avanzando ? "…" : "→ Avanzar"}
                    </button>
                  )}
                </div>
                {i < FLUJO_ESTADOS.length - 1 && (
                  <div className={`h-0.5 w-10 mt-[-22px] ${done ? "bg-[#1e8449]" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
          {mant.estado === "cancelado" && (
            <span className="ml-4 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-medium">Cancelado</span>
          )}
          {canEdit && mant.estado === "en_proceso" && (
            <button
              onClick={() => handleCambiarEstado("cancelado")}
              className="ml-4 text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
            >
              ✕ Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["detalles", "archivos", "historial"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "detalles" ? "📋 Detalles" :
             t === "archivos" ? `📎 Archivos (${archivos.length})` :
             "📝 Historial"}
          </button>
        ))}
      </div>

      {/* ── Tab Detalles ── */}
      {tab === "detalles" && !showEditar && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {mant.descripcion && (
              <div className="sm:col-span-2">
                <span className="text-gray-400 text-xs">Descripción</span>
                <p className="text-gray-900 mt-0.5">{mant.descripcion}</p>
              </div>
            )}
            <div><span className="text-gray-400 text-xs">Categoría</span>
              <div className="font-medium capitalize">{CAT_ICON[mant.categoria] ?? "🔧"} {mant.categoria?.replace("_", " ")}</div>
            </div>
            <div><span className="text-gray-400 text-xs">Solicitante</span>
              <div className="font-medium">{mant.solicitante_nombre ?? "—"}</div>
            </div>
            <div><span className="text-gray-400 text-xs">Unidad</span>
              <div className="font-medium">{mant.unidad_numero ?? "General"}</div>
            </div>
            <div><span className="text-gray-400 text-xs">Torre</span>
              <div className="font-medium">{mant.torre_nombre ?? "—"}</div>
            </div>
            {mant.inventario_nombre && (
              <div><span className="text-gray-400 text-xs">Elemento</span>
                <div className="font-medium">{mant.inventario_nombre}</div>
              </div>
            )}
            {mant.proveedor_nombre && (
              <div><span className="text-gray-400 text-xs">Proveedor</span>
                <div className="font-medium">{mant.proveedor_nombre}</div>
              </div>
            )}
            {mant.presupuesto != null && (
              <div><span className="text-gray-400 text-xs">Presupuesto</span>
                <div className="font-medium">${Number(mant.presupuesto).toLocaleString("es-CO")}</div>
              </div>
            )}
            {mant.costo != null && (
              <div><span className="text-gray-400 text-xs">Costo real</span>
                <div className="font-medium">${Number(mant.costo).toLocaleString("es-CO")}</div>
              </div>
            )}
            {mant.fecha_vencimiento && (
              <div><span className="text-gray-400 text-xs">Vencimiento</span>
                <div className="font-medium">{new Date(mant.fecha_vencimiento).toLocaleDateString("es-CO")}</div>
              </div>
            )}
            {mant.fecha_proxima_ejecucion && (
              <div><span className="text-gray-400 text-xs">Próxima ejecución</span>
                <div className="font-medium">{new Date(mant.fecha_proxima_ejecucion).toLocaleDateString("es-CO")}</div>
              </div>
            )}
            {mant.contrato_descripcion && (
              <div className="sm:col-span-2"><span className="text-gray-400 text-xs">Contrato</span>
                <div className="font-medium">{mant.contrato_descripcion}
                  {mant.contrato_archivo_url && (
                    <a href={mant.contrato_archivo_url} target="_blank" rel="noreferrer" className="ml-2 text-primary text-xs hover:underline">Ver contrato</a>
                  )}
                </div>
              </div>
            )}
            <div><span className="text-gray-400 text-xs">Registro</span>
              <div className="font-medium">{new Date(mant.created_at).toLocaleDateString("es-CO")}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Detalles (edición) ── */}
      {tab === "detalles" && showEditar && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Editar solicitud</h3>
          <form onSubmit={handleEditar} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
              <input name="titulo" required defaultValue={mant.titulo} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <textarea name="descripcion" rows={3} defaultValue={mant.descripcion ?? ""} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select name="categoria" defaultValue={mant.categoria} className={INPUT}>
                  {["plomeria","electricidad","estructura","ascensor","zonas_comunes","piscina","otro"].map((c) => (
                    <option key={c} value={c}>{CAT_ICON[c]} {c.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
                <select name="prioridad" defaultValue={mant.prioridad} className={INPUT}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha vencimiento</label>
              <input name="fecha_vencimiento" type="date" defaultValue={mant.fecha_vencimiento?.slice(0,10) ?? ""} className={INPUT} />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowEditar(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab Archivos ── */}
      {tab === "archivos" && (
        <div className="space-y-4">
          {canEdit && !esFinalizado && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-3">Adjunta fotos o documentos relacionados con esta solicitud.</p>
              <div className="flex gap-2 flex-wrap">
                <input ref={camRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadArchivo(e.target.files[0]); }} />
                <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf,.doc,.docx"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadArchivo(e.target.files[0]); }} />
                <button onClick={() => camRef.current?.click()}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  📷 Tomar foto
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
                  📎 Adjuntar archivo
                </button>
              </div>
            </div>
          )}
          {archivos.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">📎</div>
              <p>No hay archivos adjuntos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {archivos.map((a: any, i: number) => (
                <a key={a.id ?? i} href={a.url} target="_blank" rel="noreferrer"
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-primary/30 transition-colors">
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.nombre_archivo ?? a.nombre ?? "Archivo"}</p>
                    <p className="text-xs text-gray-400 capitalize">{a.tipo ?? "documento"}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Historial ── */}
      {tab === "historial" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <Bitacora eventos={bitacora} loading={loadingBit} />
        </div>
      )}
    </div>
  );
}
