"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import Bitacora from "@/components/Bitacora";

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

const PERIODICIDAD_LABEL: Record<string, string> = {
  diario: "Diario", semanal: "Semanal", mensual: "Mensual",
  trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};

const FLUJO_ESTADOS = ["pendiente", "en_proceso", "resuelto"];

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function calcDiasVencimiento(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha); venc.setHours(0, 0, 0, 0);
  return Math.floor((venc.getTime() - hoy.getTime()) / 86400000);
}

export default function MantenimientoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const mantenimientoId = parseInt(id);
  const router = useRouter();
  const user = getUser();
  const canEdit = !["servicios", "propietario", "inquilino"].includes(user?.rol ?? "");

  const [mant, setMant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"detalles" | "archivos" | "historial" | "ocurrencias">("detalles");
  const [bitacora, setBitacora] = useState<any[]>([]);
  const [loadingBit, setLoadingBit] = useState(false);
  const [ocurrencias, setOcurrencias] = useState<any[]>([]);
  const [loadingOcurr, setLoadingOcurr] = useState(false);

  // Estado/acciones
  const [avanzando, setAvanzando] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal avanzar
  const [showAvanzar, setShowAvanzar] = useState(false);
  const [avanzarDesc, setAvanzarDesc] = useState("");

  // Modal cancelar
  const [showCancelar, setShowCancelar] = useState(false);
  const [cancelarDesc, setCancelarDesc] = useState("");

  // Comentarios en historial
  const [comentTexto, setComentTexto] = useState("");
  const [savingComent, setSavingComent] = useState(false);

  // Ciclo de vida (Doc 2)
  const [showDesactivar, setShowDesactivar] = useState(false);
  const [desactivarMotivo, setDesactivarMotivo] = useState("");
  const [showCerrar, setShowCerrar] = useState(false);
  const [cerrarMotivo, setCerrarMotivo] = useState("");
  const [procesandoCiclo, setProcesandoCiclo] = useState(false);

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

  const reloadBitacora = useCallback(() => {
    setLoadingBit(true);
    fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/bitacora`)
      .then((r) => r.json())
      .then((d) => setBitacora(Array.isArray(d) ? d : []))
      .catch(() => setBitacora([]))
      .finally(() => setLoadingBit(false));
  }, [mantenimientoId]);

  useEffect(() => { loadMant(); }, [loadMant]);

  useEffect(() => {
    if (!mant) return;
    reloadBitacora();
  }, [mant?.id, reloadBitacora]);

  // Cargar ocurrencias cuando se abre el tab
  useEffect(() => {
    if (tab !== "ocurrencias" || !mant?.es_programado) return;
    setLoadingOcurr(true);
    // Buscar el ID raíz (padre_id o el propio id)
    const raizId = mant.padre_id ?? mant.id;
    fetch(`${BASE}/api/mantenimientos/${raizId}/ocurrencias`)
      .then((r) => r.json())
      .then((d) => setOcurrencias(Array.isArray(d) ? d : []))
      .catch(() => setOcurrencias([]))
      .finally(() => setLoadingOcurr(false));
  }, [tab, mant?.id, mant?.es_programado, mant?.padre_id]);

  async function handleAvanzar() {
    if (!avanzarDesc.trim()) { alert("La descripción es obligatoria"); return; }
    const etapaIdx = FLUJO_ESTADOS.indexOf(mant.estado);
    if (etapaIdx < 0 || etapaIdx >= FLUJO_ESTADOS.length - 1) return;
    const siguiente = FLUJO_ESTADOS[etapaIdx + 1];
    setAvanzando(true);
    setShowAvanzar(false);
    try {
      // Usar el nuevo endpoint /avanzar si existe, si no el PATCH clásico
      const res = await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/avanzar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: siguiente,
          descripcion: avanzarDesc,
          usuario_id: parseInt(user?.sub ?? "0"),
          usuario_nombre: user?.nombre ?? user?.email ?? "",
        }),
      });
      if (!res.ok) {
        // Fallback a PATCH + bitácora manual si el endpoint no existe aún
        await api.mantenimientos.update(mantenimientoId, { estado: siguiente });
        await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/bitacora`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evento: "comentario",
            descripcion: avanzarDesc,
            usuario_id: parseInt(user?.sub ?? "0"),
            usuario_nombre: user?.nombre ?? user?.email ?? "",
          }),
        });
      }
      setAvanzarDesc("");
      await loadMant();
      reloadBitacora();
    } finally { setAvanzando(false); }
  }

  async function handleCancelar() {
    if (!cancelarDesc.trim()) { alert("El motivo de cancelación es obligatorio"); return; }
    setAvanzando(true);
    setShowCancelar(false);
    try {
      await api.mantenimientos.update(mantenimientoId, { estado: "cancelado" });
      await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/bitacora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "cambio_estado",
          descripcion: `Cancelado. Motivo: ${cancelarDesc}`,
          usuario_id: parseInt(user?.sub ?? "0"),
          usuario_nombre: user?.nombre ?? user?.email ?? "",
        }),
      });
      setCancelarDesc("");
      await loadMant();
      reloadBitacora();
    } finally { setAvanzando(false); }
  }

  async function handleAgregarComentario() {
    if (!comentTexto.trim()) return;
    setSavingComent(true);
    try {
      await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/bitacora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "comentario",
          descripcion: comentTexto,
          usuario_id: parseInt(user?.sub ?? "0"),
          usuario_nombre: user?.nombre ?? user?.email ?? "",
        }),
      });
      setComentTexto("");
      reloadBitacora();
    } finally { setSavingComent(false); }
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

  // Ciclo de vida handlers
  async function handleDesactivarCiclo() {
    setProcesandoCiclo(true);
    setShowDesactivar(false);
    try {
      await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/desactivar-ciclo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: desactivarMotivo || null,
          usuario_id: parseInt(user?.sub ?? "0"),
          usuario_nombre: user?.nombre ?? "",
        }),
      });
      setDesactivarMotivo("");
      await loadMant();
      reloadBitacora();
    } finally { setProcesandoCiclo(false); }
  }

  async function handleReactivarCiclo() {
    if (!confirm("¿Reactivar el ciclo de este mantenimiento?")) return;
    setProcesandoCiclo(true);
    try {
      await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/reactivar-ciclo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: parseInt(user?.sub ?? "0"), usuario_nombre: user?.nombre ?? "" }),
      });
      await loadMant();
      reloadBitacora();
    } finally { setProcesandoCiclo(false); }
  }

  async function handleCerrarCiclo() {
    if (!cerrarMotivo.trim()) { alert("El motivo de cierre es obligatorio"); return; }
    setProcesandoCiclo(true);
    setShowCerrar(false);
    try {
      await fetch(`${BASE}/api/mantenimientos/${mantenimientoId}/cerrar-definitivo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: cerrarMotivo,
          usuario_id: parseInt(user?.sub ?? "0"),
          usuario_nombre: user?.nombre ?? "",
        }),
      });
      setCerrarMotivo("");
      await loadMant();
      reloadBitacora();
    } finally { setProcesandoCiclo(false); }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>;
  if (!mant) return null;

  const etapaIdx = FLUJO_ESTADOS.indexOf(mant.estado);
  const esFinalizado = mant.estado === "resuelto" || mant.estado === "cancelado";
  const puedeAvanzar = canEdit && !esFinalizado && etapaIdx < FLUJO_ESTADOS.length - 1;
  const puedeCancelar = canEdit && mant.estado !== "cancelado" && mant.estado !== "resuelto";
  const archivos: any[] = mant.archivos ?? [];
  const diasVenc = calcDiasVencimiento(mant.fecha_vencimiento);
  const tabs = mant.es_programado
    ? (["detalles", "archivos", "historial", "ocurrencias"] as const)
    : (["detalles", "archivos", "historial"] as const);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Volver</button>
          <h2 className="text-xl font-bold text-gray-900 truncate">{mant.titulo}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[mant.estado]}`}>
              {ESTADO_LABEL[mant.estado]}
            </span>
            <span className="text-xs text-gray-400 capitalize">{mant.categoria}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORIDAD_COLOR[mant.prioridad]}`}>
              {mant.prioridad}
            </span>
            {mant.es_programado && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                mant.ciclo_cerrado ? "bg-gray-100 text-gray-400" :
                mant.ciclo_activo === false ? "bg-gray-100 text-gray-500" :
                "bg-teal-100 text-teal-700"
              }`}>
                📅 {mant.ciclo_cerrado ? "Prog. cerrado" : mant.ciclo_activo === false ? "Prog. inactivo" : `Prog. · ${mant.periodicidad ?? ""}`}
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción en el header */}
        {canEdit && (
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            {!esFinalizado && <button onClick={() => setShowEditar(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">✏️ Editar</button>}
            {puedeAvanzar && (
              <button onClick={() => setShowAvanzar(true)} disabled={avanzando}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                {avanzando ? "…" : "Avanzar →"}
              </button>
            )}
            {puedeCancelar && !esFinalizado && (
              <button onClick={() => setShowCancelar(true)}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                ✕ Cancelar
              </button>
            )}
            {/* Botones ciclo (Doc 2) */}
            {mant.es_programado && !mant.ciclo_cerrado && (
              <>
                {mant.ciclo_activo !== false
                  ? <button onClick={() => setShowDesactivar(true)} disabled={procesandoCiclo}
                      className="px-3 py-1.5 text-sm border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 disabled:opacity-60">
                      ⏸ Desactivar ciclo
                    </button>
                  : <button onClick={handleReactivarCiclo} disabled={procesandoCiclo}
                      className="px-3 py-1.5 text-sm border border-teal-300 text-teal-600 rounded-lg hover:bg-teal-50 disabled:opacity-60">
                      ▶ Reactivar ciclo
                    </button>
                }
                <button onClick={() => setShowCerrar(true)} disabled={procesandoCiclo}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60">
                  🔒 Cerrar definitivo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chips (solo si es programado) */}
      {mant.es_programado && (
        <div className="flex gap-2 flex-wrap">
          {mant.periodicidad && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium border border-teal-100">
              🔄 {PERIODICIDAD_LABEL[mant.periodicidad] ?? mant.periodicidad}
            </span>
          )}
          {mant.fecha_vencimiento && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              diasVenc !== null && diasVenc < 0 ? "bg-red-50 text-red-700 border-red-100" :
              diasVenc !== null && diasVenc <= 7 ? "bg-amber-50 text-amber-700 border-amber-100" :
              "bg-gray-50 text-gray-600 border-gray-100"
            }`}>
              ⏰ Vence: {new Date(mant.fecha_vencimiento).toLocaleDateString("es-CO")}
            </span>
          )}
          {mant.fecha_proxima_ejecucion && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
              📅 Próxima: {new Date(mant.fecha_proxima_ejecucion).toLocaleDateString("es-CO")}
            </span>
          )}
          {mant.presupuesto != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
              💰 ${Number(mant.presupuesto).toLocaleString("es-CO")}
            </span>
          )}
          {mant.ciclo_cerrado && mant.motivo_cierre && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100">
              🔒 Cerrado: {mant.motivo_cierre}
            </span>
          )}
        </div>
      )}

      {/* Banner alerta vencimiento */}
      {mant.es_programado && diasVenc !== null && diasVenc <= 7 && mant.estado !== "resuelto" && mant.estado !== "cancelado" && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
          diasVenc < 0
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          <span className="text-xl">{diasVenc < 0 ? "🔴" : "🟡"}</span>
          <p className="text-sm font-medium">
            {diasVenc < 0
              ? `Ocurrencia vencida hace ${Math.abs(diasVenc)} día(s). Requiere atención inmediata.`
              : `Ocurrencia vence en ${diasVenc} día(s).`}
          </p>
        </div>
      )}

      {/* Stepper de estados (sin botones internos — los botones están en el header) */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {FLUJO_ESTADOS.map((estado, i) => {
            const done = etapaIdx > i;
            const active = etapaIdx === i;
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "detalles" ? "📋 Detalles" :
             t === "archivos" ? `📎 Archivos (${archivos.length})` :
             t === "historial" ? `📝 Historial (${bitacora.length})` :
             "🔄 Ocurrencias"}
          </button>
        ))}
      </div>

      {/* ── Tab Detalles (vista) ── */}
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
            <div><span className="text-gray-400 text-xs">Prioridad</span>
              <div><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORIDAD_COLOR[mant.prioridad]}`}>{mant.prioridad}</span></div>
            </div>
            <div><span className="text-gray-400 text-xs">¿Es programado?</span>
              <div className="font-medium">{mant.es_programado ? "✓ Sí" : "No"}</div>
            </div>
            {mant.es_programado && mant.periodicidad && (
              <div><span className="text-gray-400 text-xs">Periodicidad</span>
                <div className="font-medium capitalize">{PERIODICIDAD_LABEL[mant.periodicidad] ?? mant.periodicidad}</div>
              </div>
            )}
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
                <div className={`font-medium ${mant.presupuesto && mant.costo > mant.presupuesto ? "text-red-600" : ""}`}>
                  ${Number(mant.costo).toLocaleString("es-CO")}
                </div>
              </div>
            )}
            <div><span className="text-gray-400 text-xs">Fecha de solicitud</span>
              <div className="font-medium">{new Date(mant.created_at).toLocaleDateString("es-CO")}</div>
            </div>
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
        <div className="space-y-4">
          {/* Agregar comentario */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">Agregar comentario al historial</label>
            <textarea
              value={comentTexto}
              onChange={(e) => setComentTexto(e.target.value)}
              rows={2}
              placeholder="Escribe una nota o comentario sobre esta solicitud…"
              className={INPUT}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAgregarComentario}
                disabled={!comentTexto.trim() || savingComent}
                className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {savingComent ? "Guardando…" : "💬 Agregar comentario"}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <Bitacora eventos={bitacora} loading={loadingBit} />
          </div>
        </div>
      )}

      {/* ── Tab Ocurrencias (Doc 2, solo para programados) ── */}
      {tab === "ocurrencias" && mant.es_programado && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900 text-sm">Historial de ocurrencias</h4>
            <p className="text-xs text-gray-400 mt-0.5">Todas las ejecuciones de este mantenimiento programado</p>
          </div>
          {loadingOcurr ? (
            <div className="px-5 py-8 text-center text-gray-400">Cargando…</div>
          ) : ocurrencias.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">No hay ocurrencias registradas aún</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["#","Vencimiento","Resolución","Estado","Quién resolvió"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ocurrencias.map((o: any, i: number) => (
                    <tr key={o.id}
                      onClick={() => router.push(`/dashboard/mantenimiento/${o.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 ${o.id === mantenimientoId ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        #{o.numero_ocurrencia ?? i + 1}
                        {o.id === mantenimientoId && <span className="ml-1 text-primary font-semibold">← actual</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {o.fecha_vencimiento ? new Date(o.fecha_vencimiento).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {o.fecha_resolucion ? new Date(o.fecha_resolucion).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[o.estado]}`}>
                          {ESTADO_LABEL[o.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{o.asignado_nombre ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Avanzar ── */}
      {showAvanzar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">
              Avanzar a: <span className="text-primary">{ESTADO_LABEL[FLUJO_ESTADOS[etapaIdx + 1]] ?? ""}</span>
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Nota *</label>
              <textarea
                rows={3}
                value={avanzarDesc}
                onChange={(e) => setAvanzarDesc(e.target.value)}
                placeholder="Describe el estado actual o motivo del avance…"
                className={INPUT}
              />
              <p className="text-xs text-red-500 mt-0.5">Obligatorio — se registrará en el historial</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => { setShowAvanzar(false); setAvanzarDesc(""); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAvanzar} disabled={avanzando}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                {avanzando ? "…" : "Confirmar →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cancelar ── */}
      {showCancelar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">¿Cancelar esta solicitud?</h3>
            <p className="text-sm text-gray-500">Esta acción pasará la solicitud a estado Cancelado.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de cancelación *</label>
              <textarea
                rows={3}
                value={cancelarDesc}
                onChange={(e) => setCancelarDesc(e.target.value)}
                placeholder="Explica el motivo de la cancelación…"
                className={INPUT}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCancelar(false); setCancelarDesc(""); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Volver</button>
              <button onClick={handleCancelar} disabled={avanzando}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                {avanzando ? "…" : "Cancelar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Desactivar Ciclo ── */}
      {showDesactivar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Desactivar ciclo recurrente</h3>
            <p className="text-sm text-gray-500">No se generarán más ocurrencias hasta que se reactive el ciclo. El historial se conserva.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo (opcional)</label>
              <textarea rows={2} value={desactivarMotivo} onChange={(e) => setDesactivarMotivo(e.target.value)}
                placeholder="Ej: Elemento fuera de servicio temporalmente…" className={INPUT} />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDesactivar(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={handleDesactivarCiclo} disabled={procesandoCiclo}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60">
                {procesandoCiclo ? "…" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cerrar Definitivo ── */}
      {showCerrar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Cerrar ciclo definitivamente</h3>
            <p className="text-sm text-gray-500">Esta acción es irreversible. No se generarán más ocurrencias y no se puede reactivar.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de cierre *</label>
              <select value={cerrarMotivo} onChange={(e) => setCerrarMotivo(e.target.value)} className={INPUT}>
                <option value="">Seleccionar motivo…</option>
                <option value="Elemento dado de baja">Elemento dado de baja</option>
                <option value="Reemplazado por nuevo elemento">Reemplazado por nuevo elemento</option>
                <option value="Ya no aplica">Ya no aplica</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCerrar(false); setCerrarMotivo(""); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={handleCerrarCiclo} disabled={procesandoCiclo || !cerrarMotivo}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-60">
                {procesandoCiclo ? "…" : "Cerrar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
