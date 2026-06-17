"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { proyectosApi, api } from "@/lib/api";
import { getUser } from "@/lib/auth";

// ── Constantes ────────────────────────────────────────────────────────────────

const ETAPA_LABEL: Record<string, string> = {
  PENDING: "No iniciado", STARTED: "Inicio", QUOTING: "Cotización",
  APPROVAL: "Aprobación", PLANNING: "Planificación", IN_PROGRESS: "Ejecución",
  MONITORING: "Control", COMPLETED: "Finalizado", CANCELLED: "Cancelado",
};

const ETAPA_COLOR: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-500", STARTED: "bg-blue-100 text-blue-600",
  QUOTING: "bg-amber-100 text-amber-700", APPROVAL: "bg-orange-100 text-orange-700",
  PLANNING: "bg-indigo-100 text-indigo-700", IN_PROGRESS: "bg-teal-100 text-teal-700",
  MONITORING: "bg-cyan-100 text-cyan-700", COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-500",
};

const TIPO_LABEL: Record<string, string> = {
  proyecto_mayor: "Proyecto Mayor", proyecto: "Proyecto", tarea: "Tarea",
};

const FLUJO_PROYECTO = ["PENDING","STARTED","QUOTING","APPROVAL","PLANNING","IN_PROGRESS","MONITORING","COMPLETED"];
const FLUJO_TAREA    = ["PENDING","STARTED","IN_PROGRESS","COMPLETED"];

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const proyectoId = parseInt(id);
  const router = useRouter();
  const user = getUser();
  const isAdmin = user?.rol === "administrador" || user?.rol === "superadmin";
  const isConsejo = user?.rol === "consejo";
  const isResidente = user?.rol === "propietario" || user?.rol === "inquilino";
  const isAccess = isAdmin || isConsejo;

  const [proyecto, setProyecto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"detalles"|"cotizaciones"|"evidencias"|"historial"|"aprobacion">("detalles");

  // Sub-estados
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [votos, setVotos] = useState<any[]>([]);

  // Acciones
  const [showCancelar, setShowCancelar] = useState(false);
  const [justCancelar, setJustCancelar] = useState("");
  const [avanzando, setAvanzando] = useState(false);

  // Cotizaciones
  const [showCotForm, setShowCotForm] = useState(false);
  const [savingCot, setSavingCot] = useState(false);

  // Evidencias
  const evidFileRef = useRef<HTMLInputElement>(null);
  const evidCamRef = useRef<HTMLInputElement>(null);
  const [tipoEvidencia, setTipoEvidencia] = useState("imagen");
  const [evidDescripcion, setEvidDescripcion] = useState("");

  // Modal avanzar
  const [showAvanzar, setShowAvanzar] = useState(false);
  const [avanzarFecha, setAvanzarFecha] = useState("");
  const [avanzarDescControl, setAvanzarDescControl] = useState("");
  const [avanzarGarantia, setAvanzarGarantia] = useState("");
  const [avanzarFechaCierre, setAvanzarFechaCierre] = useState("");
  const [avanzarJustificacion, setAvanzarJustificacion] = useState("");

  // Historial
  const [comentTexto, setComentTexto] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Aprobación
  const [showEnviarApr, setShowEnviarApr] = useState(false);
  const [aprNota, setAprNota] = useState("");
  const [aprFechaLimite, setAprFechaLimite] = useState("");
  const [enviandoApr, setEnviandoApr] = useState(false);
  const [showActa, setShowActa] = useState(false);
  const [votandoDecision, setVotandoDecision] = useState<"aprobado"|"rechazado"|null>(null);
  const [votoComentario, setVotoComentario] = useState("");
  const [guardandoVoto, setGuardandoVoto] = useState(false);

  // Edición
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [torres, setTorres] = useState<any[]>([]);
  const [zonas, setZonas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);

  const loadProyecto = useCallback(async () => {
    setLoading(true);
    try {
      const p = await proyectosApi.get(proyectoId);
      setProyecto(p);
    } catch { router.replace("/dashboard/proyectos"); }
    finally { setLoading(false); }
  }, [proyectoId, router]);

  const loadSubData = useCallback(async () => {
    if (!proyecto) return;
    const [c, e, cm, v] = await Promise.allSettled([
      proyectosApi.cotizaciones.list(proyectoId),
      proyectosApi.evidencias.list(proyectoId),
      proyectosApi.comentarios.list(proyectoId),
      proyectosApi.aprobacion.getVotos(proyectoId),
    ]);
    if (c.status === "fulfilled") setCotizaciones(c.value);
    if (e.status === "fulfilled") setEvidencias(e.value);
    if (cm.status === "fulfilled") setComentarios(cm.value);
    if (v.status === "fulfilled") setVotos(v.value);
  }, [proyecto, proyectoId]);

  useEffect(() => { loadProyecto(); }, [loadProyecto]);
  useEffect(() => { loadSubData(); }, [loadSubData]);

  // Cargar datos para edición
  useEffect(() => {
    if (!editando || !proyecto) return;
    const cid = proyecto.conjunto_id;
    Promise.allSettled([
      fetch(`${process.env.NEXT_PUBLIC_API_URL||""}/api/conjuntos/${cid}/torres`, { headers: { Authorization: `Bearer ${localStorage.getItem("torre_auth_token")||""}` } }).then(r=>r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL||""}/api/zonas-comunes?conjunto_id=${cid}`).then(r=>r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL||""}/api/usuarios?conjunto_id=${cid}`).then(r=>r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL||""}/api/proveedores?conjunto_id=${cid}`).then(r=>r.json()),
    ]).then(([t, z, u, pv]) => {
      if (t.status === "fulfilled") setTorres(Array.isArray(t.value) ? t.value : (t.value?.torres ?? []));
      if (z.status === "fulfilled") setZonas(Array.isArray(z.value) ? z.value : []);
      if (u.status === "fulfilled") setUsuarios(Array.isArray(u.value) ? u.value : (u.value?.usuarios ?? []));
      if (pv.status === "fulfilled") setProveedores(Array.isArray(pv.value) ? pv.value : (pv.value?.proveedores ?? []));
    });
    setEditForm({
      titulo: proyecto.titulo,
      descripcion: proyecto.descripcion || "",
      prioridad: proyecto.prioridad,
      zona_tipo: proyecto.zona_tipo || "",
      zona_id: proyecto.zona_id || "",
      zona_texto: proyecto.zona_texto || "",
      responsable_id: proyecto.responsable_id || "",
      proveedor_id: proyecto.proveedor_id || "",
      fecha_compromiso: proyecto.fecha_compromiso?.slice(0,10) || "",
      fecha_cierre_real: proyecto.fecha_cierre_real?.slice(0,10) || "",
      presupuesto_aprobado: proyecto.presupuesto_aprobado || "",
      costo_final: proyecto.costo_final || "",
      visible_residentes: proyecto.visible_residentes ?? false,
    });
  }, [editando, proyecto]);

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>;
  if (!proyecto) return null;

  const flujo = proyecto.tipo === "tarea" ? FLUJO_TAREA : FLUJO_PROYECTO;
  const etapaIdx = flujo.indexOf(proyecto.etapa);
  const esCancelado = proyecto.etapa === "CANCELLED";
  const esFinalizado = proyecto.etapa === "COMPLETED" || esCancelado;
  const tieneAprobacion = proyecto.tipo !== "tarea" && ["QUOTING","APPROVAL","PLANNING","IN_PROGRESS","MONITORING","COMPLETED"].includes(proyecto.etapa);

  // Voto pendiente de este usuario en la aprobación activa
  const aprobacionActiva = votos.find((a: any) => a.aprobacion_estado === "pendiente");
  const miVoto = aprobacionActiva?.votos?.find((v: any) => v.usuario_id === parseInt(user?.sub ?? "0"));
  const tengoVotoPendiente = isConsejo && miVoto && miVoto.decision === null;

  function handleAvanzarClick() {
    setShowAvanzar(true);
  }

  async function handleAvanzar() {
    if (!avanzarJustificacion.trim()) { alert("La descripción es obligatoria para avanzar"); return; }
    setAvanzando(true);
    setShowAvanzar(false);
    try {
      const body: any = { justificacion: avanzarJustificacion };
      if (avanzarFecha) body.fecha_nueva_entrega = avanzarFecha;
      if (avanzarDescControl) body.descripcion_control = avanzarDescControl;
      if (avanzarGarantia) body.garantia_meses = parseInt(avanzarGarantia);
      if (avanzarFechaCierre) body.fecha_cierre_real = avanzarFechaCierre;
      const res = await proyectosApi.avanzar(proyectoId, body);
      await loadProyecto();
      await loadSubData();
      alert(`✅ Etapa avanzada a: ${ETAPA_LABEL[res.etapa]}`);
    } catch (e: any) {
      alert(`❌ ${e.message}`);
    } finally {
      setAvanzando(false);
      setAvanzarFecha(""); setAvanzarDescControl(""); setAvanzarGarantia(""); setAvanzarFechaCierre(""); setAvanzarJustificacion("");
    }
  }

  async function handleCancelar() {
    if (!justCancelar.trim()) { alert("La justificación es obligatoria"); return; }
    await proyectosApi.cancelar(proyectoId, justCancelar);
    setShowCancelar(false);
    loadProyecto();
  }

  async function handleConvertir() {
    if (!confirm("¿Convertir esta tarea a Proyecto? Podrás agregar cotizaciones y requerir aprobación.")) return;
    await proyectosApi.convertir(proyectoId);
    loadProyecto();
  }

  async function handleGuardarEdicion() {
    const body: any = { ...editForm };
    if (body.zona_id) body.zona_id = parseInt(body.zona_id);
    if (body.responsable_id) body.responsable_id = parseInt(body.responsable_id);
    if (body.proveedor_id) body.proveedor_id = parseInt(body.proveedor_id);
    if (body.presupuesto_aprobado) body.presupuesto_aprobado = parseFloat(body.presupuesto_aprobado);
    if (body.costo_final) body.costo_final = parseFloat(body.costo_final);
    // Limpiar zona si cambió tipo
    if (!body.zona_tipo || body.zona_tipo === "otro") { body.zona_id = null; }
    if (body.zona_tipo !== "otro") body.zona_texto = null;
    await proyectosApi.update(proyectoId, body);
    setEditando(false);
    loadProyecto();
  }

  async function handleCrearCotizacion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingCot(true);
    try {
      const fd = new FormData(e.currentTarget);
      const file = (e.currentTarget.querySelector("input[type=file]") as HTMLInputElement)?.files?.[0];
      let archivo_base64: string | null = null;
      let nombre_archivo: string | null = null;
      if (file) {
        nombre_archivo = file.name;
        const buf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
        archivo_base64 = `data:${file.type || "application/octet-stream"};base64,${b64}`;
      }
      const body: any = {
        monto: parseFloat(fd.get("monto") as string),
        nombre_proveedor: fd.get("nombre_proveedor") || null,
        fecha_cotizacion: fd.get("fecha_cotizacion") || null,
        archivo_base64, nombre_archivo,
      };
      const pid = fd.get("proveedor_id");
      if (pid) body.proveedor_id = parseInt(pid as string);
      await proyectosApi.cotizaciones.create(proyectoId, body);
      setShowCotForm(false);
      (e.target as HTMLFormElement).reset();
      loadSubData();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    } finally { setSavingCot(false); }
  }

  async function handleUploadEvidencia(file: File) {
    await proyectosApi.evidencias.upload(proyectoId, file, tipoEvidencia, evidDescripcion || undefined);
    setEvidDescripcion("");
    loadSubData();
  }

  async function handleAddComentario() {
    if (!comentTexto.trim()) return;
    setSavingComment(true);
    try {
      await proyectosApi.comentarios.create(proyectoId, { texto: comentTexto });
      setComentTexto("");
      loadSubData();
    } finally { setSavingComment(false); }
  }

  async function handleEnviarAprobacion() {
    setEnviandoApr(true);
    try {
      await proyectosApi.aprobacion.enviar(proyectoId, {
        nota_admin: aprNota || undefined,
        fecha_limite: aprFechaLimite || undefined,
      });
      setShowEnviarApr(false);
      await loadProyecto();
      await loadSubData();
      setTab("aprobacion");
    } catch (e: any) { alert(`❌ ${e.message}`); }
    finally { setEnviandoApr(false); }
  }

  async function handleVotar(decision: "aprobado" | "rechazado") {
    if (decision === "rechazado" && !votoComentario.trim()) {
      alert("El comentario es obligatorio al rechazar"); return;
    }
    setGuardandoVoto(true);
    try {
      const res = await proyectosApi.aprobacion.votar(proyectoId, decision, votoComentario || undefined);
      setVotandoDecision(null);
      setVotoComentario("");
      await loadProyecto();
      await loadSubData();
      if (res.resultado === "rechazado") alert("❌ Has rechazado el proyecto. Pasa a CANCELADO.");
      else if (res.resultado === "aprobado_unanimidad") alert("✅ ¡Aprobado por unanimidad! El proyecto avanza a Planificación.");
      else alert(`✅ Voto registrado. Faltan ${res.pendientes} voto(s).`);
    } catch (e: any) { alert(`❌ ${e.message}`); }
    finally { setGuardandoVoto(false); }
  }

  async function handleAprobarPorActa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = (e.currentTarget.querySelector("input[type=file]") as HTMLInputElement)?.files?.[0];
    if (!file) { alert("El PDF del acta es obligatorio"); return; }
    const buf = await file.arrayBuffer();
    const b64 = `data:application/pdf;base64,` + btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
    await proyectosApi.aprobacion.aprobarPorActa(proyectoId, {
      acta_numero: fd.get("acta_numero"),
      acta_fecha: fd.get("acta_fecha"),
      acta_descripcion: fd.get("acta_descripcion"),
      archivo_base64: b64,
      nombre_archivo: file.name,
    });
    setShowActa(false);
    await loadProyecto();
    await loadSubData();
    alert("✅ Aprobado por acta. El proyecto avanza a Planificación.");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Volver</button>
          <h2 className="text-xl font-bold text-gray-900">{proyecto.titulo}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ETAPA_COLOR[proyecto.etapa]}`}>
              {ETAPA_LABEL[proyecto.etapa]}
            </span>
            <span className="text-xs text-gray-400">{TIPO_LABEL[proyecto.tipo]}</span>
            <span className="text-xs text-gray-400 capitalize">Prioridad: {proyecto.prioridad}</span>
          </div>
        </div>
        {isAdmin && !esFinalizado && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditando(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">✏️ Editar</button>
            <button onClick={handleAvanzarClick} disabled={avanzando}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
              {avanzando ? "…" : "Avanzar →"}
            </button>
            <button onClick={() => setShowCancelar(true)}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
              ✕ Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {flujo.map((etapa, i) => {
            const done = etapaIdx > i;
            const active = etapaIdx === i;
            return (
              <div key={etapa} className="flex items-center gap-1">
                <div className={`flex flex-col items-center gap-1 ${done ? "opacity-60" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${active ? "bg-primary text-white ring-2 ring-primary/30" :
                      done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-gray-400"}`}>
                    {ETAPA_LABEL[etapa]}
                  </span>
                </div>
                {i < flujo.length - 1 && (
                  <div className={`h-0.5 w-8 mt-[-10px] ${done ? "bg-green-300" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
          {esCancelado && (
            <span className="ml-4 text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-medium">CANCELADO</span>
          )}
        </div>
      </div>

      {/* Alerta voto pendiente */}
      {tengoVotoPendiente && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-800 mb-3">⏳ Tienes un voto pendiente para este proyecto</p>
          <p className="text-xs text-orange-700 mb-3">{proyecto.descripcion}</p>
          {votandoDecision === null ? (
            <div className="flex gap-2">
              <button onClick={() => setVotandoDecision("aprobado")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                ✓ Aprobar
              </button>
              <button onClick={() => setVotandoDecision("rechazado")}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                ✗ Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-800">
                {votandoDecision === "rechazado" ? "❌ Rechazar — comentario obligatorio:" : "✓ Confirmar aprobación:"}
              </p>
              <textarea
                value={votoComentario}
                onChange={(e) => setVotoComentario(e.target.value)}
                placeholder={votandoDecision === "rechazado" ? "Indique el motivo del rechazo…" : "Comentario opcional…"}
                rows={2}
                className={INPUT}
              />
              <div className="flex gap-2">
                <button onClick={() => handleVotar(votandoDecision)} disabled={guardandoVoto}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-60 ${votandoDecision === "aprobado" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                  {guardandoVoto ? "Enviando…" : "Confirmar"}
                </button>
                <button onClick={() => { setVotandoDecision(null); setVotoComentario(""); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(["detalles","historial","cotizaciones","evidencias","aprobacion"] as const)
          .filter((t) => t !== "cotizaciones" || proyecto.tipo !== "tarea")
          .filter((t) => t !== "aprobacion" || tieneAprobacion)
          .map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t === "detalles" ? "📋 Detalles" :
               t === "historial" ? `📝 Historial (${comentarios.length})` :
               t === "cotizaciones" ? `💼 Cotizaciones (${cotizaciones.length})` :
               t === "evidencias" ? `📎 Evidencias (${evidencias.length})` :
               `🗳️ Aprobación`}
            </button>
          ))}
      </div>

      {/* ── Tab Detalles ── */}
      {tab === "detalles" && !editando && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {proyecto.descripcion && (
              <div className="sm:col-span-2">
                <span className="text-gray-400 text-xs">Descripción</span>
                <p className="text-gray-900 mt-0.5">{proyecto.descripcion}</p>
              </div>
            )}
            <div><span className="text-gray-400 text-xs">Responsable</span><div className="font-medium">{proyecto.responsable_nombre ?? "—"}</div></div>
            <div><span className="text-gray-400 text-xs">Contratista / Proveedor</span><div className="font-medium">{proyecto.proveedor_nombre ?? "—"}</div></div>
            <div><span className="text-gray-400 text-xs">Zona</span>
              <div className="font-medium">
                {proyecto.zona_tipo === "torre" ? `🏗️ ${proyecto.zona_torre_nombre ?? "—"}` :
                 proyecto.zona_tipo === "zona_comun" ? `🌳 ${proyecto.zona_comun_nombre ?? "—"}` :
                 proyecto.zona_texto || "—"}
              </div>
            </div>
            <div><span className="text-gray-400 text-xs">Fecha compromiso</span>
              <div className="font-medium">{proyecto.fecha_compromiso ? new Date(proyecto.fecha_compromiso).toLocaleDateString("es-CO") : "—"}</div>
            </div>
            {proyecto.fecha_cierre_real && (
              <div><span className="text-gray-400 text-xs">Fecha cierre real</span>
                <div className="font-medium">{new Date(proyecto.fecha_cierre_real).toLocaleDateString("es-CO")}</div>
              </div>
            )}
            {proyecto.presupuesto_aprobado != null && (
              <div><span className="text-gray-400 text-xs">Presupuesto aprobado</span>
                <div className="font-medium">${Number(proyecto.presupuesto_aprobado).toLocaleString("es-CO")}</div>
              </div>
            )}
            {proyecto.costo_final != null && (
              <div><span className="text-gray-400 text-xs">Costo final</span>
                <div className="font-medium">${Number(proyecto.costo_final).toLocaleString("es-CO")}</div>
              </div>
            )}
            {proyecto.garantia_meses != null && (
              <div><span className="text-gray-400 text-xs">Garantía</span>
                <div className="font-medium">{proyecto.garantia_meses} {proyecto.garantia_meses === 1 ? "mes" : "meses"}</div>
              </div>
            )}
            {proyecto.descripcion_control && (
              <div className="sm:col-span-2"><span className="text-gray-400 text-xs">Descripción del control</span>
                <p className="text-gray-900 mt-0.5">{proyecto.descripcion_control}</p>
              </div>
            )}
            <div><span className="text-gray-400 text-xs">Creado por</span><div className="font-medium">{proyecto.creado_por_nombre ?? "—"}</div></div>
            <div><span className="text-gray-400 text-xs">Fecha registro</span>
              <div className="font-medium">{new Date(proyecto.created_at).toLocaleDateString("es-CO")}</div>
            </div>
            {isAdmin && (
              <div><span className="text-gray-400 text-xs">Visible para residentes</span>
                <div className={`font-medium text-sm ${proyecto.visible_residentes ? "text-green-600" : "text-gray-400"}`}>
                  {proyecto.visible_residentes ? "✓ Sí" : "No"}
                </div>
              </div>
            )}
          </div>
          {isAdmin && proyecto.tipo === "tarea" && proyecto.etapa !== "CANCELLED" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={handleConvertir}
                className="text-sm px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                🔄 Convertir a Proyecto
              </button>
              <p className="text-xs text-gray-400 mt-1">Si esta tarea creció en complejidad, conviértela a Proyecto para habilitar cotizaciones.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Detalles (edición) ── */}
      {tab === "detalles" && editando && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Editar proyecto</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input value={editForm.titulo} onChange={(e) => setEditForm({...editForm, titulo: e.target.value})} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea rows={3} value={editForm.descripcion} onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
              <select value={editForm.prioridad} onChange={(e) => setEditForm({...editForm, prioridad: e.target.value})} className={INPUT}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha compromiso</label>
              <input type="date" value={editForm.fecha_compromiso} onChange={(e) => setEditForm({...editForm, fecha_compromiso: e.target.value})} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de cierre real</label>
              <input type="date" value={editForm.fecha_cierre_real} onChange={(e) => setEditForm({...editForm, fecha_cierre_real: e.target.value})} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Zona / Ubicación</label>
            <select value={editForm.zona_tipo} onChange={(e) => setEditForm({...editForm, zona_tipo: e.target.value, zona_id: "", zona_texto: ""})} className={INPUT}>
              <option value="">Sin zona específica</option>
              <option value="torre">Torre</option>
              <option value="zona_comun">Zona Común</option>
              <option value="otro">Otro</option>
            </select>
            {editForm.zona_tipo === "torre" && (
              <select className={`${INPUT} mt-2`} value={editForm.zona_id} onChange={(e) => setEditForm({...editForm, zona_id: e.target.value})}>
                <option value="">Seleccionar torre…</option>
                {torres.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            )}
            {editForm.zona_tipo === "zona_comun" && (
              <select className={`${INPUT} mt-2`} value={editForm.zona_id} onChange={(e) => setEditForm({...editForm, zona_id: e.target.value})}>
                <option value="">Seleccionar zona…</option>
                {zonas.map((z: any) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            )}
            {editForm.zona_tipo === "otro" && (
              <input className={`${INPUT} mt-2`} placeholder="Describir ubicación…" value={editForm.zona_texto} onChange={(e) => setEditForm({...editForm, zona_texto: e.target.value})} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsable interno</label>
              <select value={editForm.responsable_id} onChange={(e) => setEditForm({...editForm, responsable_id: e.target.value})} className={INPUT}>
                <option value="">Sin responsable</option>
                {usuarios.filter((u: any) => ["administrador","servicios"].includes(u.rol)).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contratista / Proveedor</label>
              <select value={editForm.proveedor_id} onChange={(e) => setEditForm({...editForm, proveedor_id: e.target.value})} className={INPUT}>
                <option value="">Sin contratista</option>
                {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Presupuesto aprobado</label>
              <input type="number" step="0.01" min="0" value={editForm.presupuesto_aprobado} onChange={(e) => setEditForm({...editForm, presupuesto_aprobado: e.target.value})} className={INPUT} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Costo final</label>
              <input type="number" step="0.01" min="0" value={editForm.costo_final} onChange={(e) => setEditForm({...editForm, costo_final: e.target.value})} className={INPUT} placeholder="0.00" />
            </div>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!editForm.visible_residentes}
                onChange={(e) => setEditForm({...editForm, visible_residentes: e.target.checked})}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Visible para residentes</span>
            </label>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setEditando(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
            <button onClick={handleGuardarEdicion} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Guardar</button>
          </div>
        </div>
      )}

      {/* ── Tab Cotizaciones ── */}
      {tab === "cotizaciones" && (
        <div className="space-y-4">
          {isAdmin && !esFinalizado && (
            <div className="flex justify-end">
              <button onClick={() => setShowCotForm(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                + Agregar cotización
              </button>
            </div>
          )}
          {cotizaciones.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">💼</div>
              <p>No hay cotizaciones registradas</p>
              {proyecto.tipo === "proyecto_mayor" && <p className="text-xs mt-1">Se requieren mínimo 3 cotizaciones de proveedores distintos</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {cotizaciones.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{c.proveedor_cat_nombre || c.nombre_proveedor || "Proveedor sin nombre"}</p>
                      <p className="text-lg font-bold text-primary mt-0.5">${Number(c.monto).toLocaleString("es-CO")}</p>
                      {c.fecha_cotizacion && <p className="text-xs text-gray-400 mt-0.5">Fecha: {new Date(c.fecha_cotizacion).toLocaleDateString("es-CO")}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.estado === "seleccionada" ? "bg-green-100 text-green-700" :
                        c.estado === "descartada" ? "bg-red-100 text-red-500" :
                        "bg-gray-100 text-gray-500"
                      }`}>{c.estado}</span>
                      {isAdmin && c.archivo_url && (
                        <a href={c.archivo_url} target="_blank" rel="noreferrer"
                          className="text-xs text-primary hover:underline">📄 Ver</a>
                      )}
                    </div>
                  </div>
                  {isAdmin && !esFinalizado && c.estado !== "seleccionada" && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => proyectosApi.cotizaciones.updateEstado(proyectoId, c.id, "seleccionada").then(loadSubData)}
                        className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                        ✓ Seleccionar
                      </button>
                      {c.estado !== "descartada" && (
                        <button onClick={() => proyectosApi.cotizaciones.updateEstado(proyectoId, c.id, "descartada").then(loadSubData)}
                          className="text-xs px-3 py-1 bg-red-100 text-red-500 rounded-lg hover:bg-red-200">
                          ✕ Descartar
                        </button>
                      )}
                      <button onClick={() => proyectosApi.cotizaciones.delete(proyectoId, c.id).then(loadSubData)}
                        className="text-xs px-3 py-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100">
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formulario nueva cotización */}
          {showCotForm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Agregar cotización</h3>
                <form onSubmit={handleCrearCotizacion} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del proveedor *</label>
                    <input name="nombre_proveedor" required className={INPUT} placeholder="Razón social o nombre" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                      <input name="monto" type="number" step="0.01" min="0" required className={INPUT} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha cotización</label>
                      <input name="fecha_cotizacion" type="date" className={INPUT} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Adjunto (PDF/imagen)</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm text-gray-600" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setShowCotForm(false)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                    <button type="submit" disabled={savingCot}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                      {savingCot ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Evidencias ── */}
      {tab === "evidencias" && (
        <div className="space-y-4">
          {(isAccess || isResidente) && !esFinalizado && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <select value={tipoEvidencia} onChange={(e) => setTipoEvidencia(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="imagen">Imagen</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="documento">Documento</option>
                  <option value="acta">Acta</option>
                </select>
                <input ref={evidFileRef} type="file" className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadEvidencia(e.target.files[0]); }} />
                <input ref={evidCamRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadEvidencia(e.target.files[0]); }} />
                <button onClick={() => evidCamRef.current?.click()}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  📷 Tomar foto
                </button>
                <button onClick={() => evidFileRef.current?.click()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                  📎 Adjuntar archivo
                </button>
              </div>
              <input
                value={evidDescripcion}
                onChange={(e) => setEvidDescripcion(e.target.value)}
                placeholder="Descripción opcional del archivo…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          {evidencias.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">📎</div>
              <p>No hay evidencias adjuntas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {evidencias.map((ev: any) => (
                <div key={ev.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.nombre_archivo}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{ev.tipo_evidencia} · {ev.etapa_carga}</p>
                    {ev.descripcion && <p className="text-xs text-gray-600 mt-0.5 italic">{ev.descripcion}</p>}
                    <p className="text-xs text-gray-400">{ev.subido_por_nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={ev.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver</a>
                    {isAdmin && (
                      <button onClick={() => proyectosApi.evidencias.delete(proyectoId, ev.id).then(loadSubData)}
                        className="text-xs text-gray-400 hover:text-red-500">🗑️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Historial ── */}
      {tab === "historial" && (
        <div className="space-y-4">
          {isAccess && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <textarea
                value={comentTexto}
                onChange={(e) => setComentTexto(e.target.value)}
                placeholder="Agregar comentario de seguimiento…"
                rows={2}
                className={INPUT}
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleAddComentario} disabled={savingComment || !comentTexto.trim()}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  {savingComment ? "Enviando…" : "Agregar"}
                </button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {comentarios.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Sin entradas en el historial</div>
            ) : comentarios.map((c: any) => (
              <div key={c.id} className={`bg-white rounded-xl border p-4 ${c.es_sistema ? "border-blue-100 bg-blue-50/30" : "border-gray-100"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {c.es_sistema ? "🤖 Sistema" : (c.usuario_nombre ?? "Usuario")}
                    {c.usuario_rol && !c.es_sistema && <span className="ml-1 text-gray-400 capitalize">({c.usuario_rol})</span>}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString("es-CO")}</span>
                </div>
                <p className="text-sm text-gray-800">{c.texto}</p>
                {c.archivo_url && (
                  <a href={c.archivo_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                    📎 {c.nombre_archivo || "Adjunto"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Aprobación ── */}
      {tab === "aprobacion" && tieneAprobacion && (
        <div className="space-y-4">
          {/* Estado actual de votos */}
          {votos.length > 0 && votos.map((apr: any) => (
            <div key={apr.aprobacion_id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {apr.aprobacion_estado === "aprobado_por_acta" ? "📜 Aprobado por Acta de Asamblea" : "🗳️ Proceso de votación"}
                </h4>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  apr.aprobacion_estado === "pendiente" ? "bg-orange-100 text-orange-700" :
                  apr.aprobacion_estado === "aprobado" ? "bg-green-100 text-green-700" :
                  apr.aprobacion_estado === "rechazado" ? "bg-red-100 text-red-500" :
                  "bg-blue-100 text-blue-600"
                }`}>{apr.aprobacion_estado === "aprobado_por_acta" ? "Aprobado" : apr.aprobacion_estado}</span>
              </div>
              {apr.nota_admin && <p className="text-xs text-gray-600 mb-3 bg-gray-50 rounded p-2">📝 {apr.nota_admin}</p>}
              {apr.fecha_limite && <p className="text-xs text-gray-400 mb-3">Fecha límite: {new Date(apr.fecha_limite).toLocaleDateString("es-CO")}</p>}

              {/* Info del acta (cuando fue aprobado por acta sin votos individuales) */}
              {apr.aprobacion_estado === "aprobado_por_acta" && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-1 mb-3">
                  {apr.acta_numero && <p className="text-xs text-blue-800"><span className="font-medium">Acta:</span> {apr.acta_numero}</p>}
                  {apr.acta_fecha && <p className="text-xs text-blue-800"><span className="font-medium">Fecha asamblea:</span> {new Date(apr.acta_fecha).toLocaleDateString("es-CO")}</p>}
                  {apr.acta_descripcion && <p className="text-xs text-blue-700 mt-1">{apr.acta_descripcion}</p>}
                  {apr.cerrado_at && <p className="text-xs text-gray-400">Registrado: {new Date(apr.cerrado_at).toLocaleDateString("es-CO")}</p>}
                </div>
              )}

              {/* Tabla de votos individuales */}
              {(apr.votos || []).length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 text-left font-medium">Miembro</th>
                      <th className="pb-2 text-left font-medium">Cargo</th>
                      <th className="pb-2 text-left font-medium">Decisión</th>
                      <th className="pb-2 text-left font-medium">Comentario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(apr.votos || []).map((v: any) => (
                      <tr key={v.voto_id}>
                        <td className="py-2 font-medium text-gray-900">{v.miembro_nombre}</td>
                        <td className="py-2 text-gray-500 capitalize">{v.miembro_cargo}</td>
                        <td className="py-2">
                          {v.decision === null ? (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏳ Pendiente</span>
                          ) : v.decision === "aprobado" ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Aprobado</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">✗ Rechazado</span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-gray-500">{v.comentario || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}

          {/* Acciones admin */}
          {isAdmin && !esFinalizado && proyecto.etapa === "QUOTING" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Enviar a aprobación del Consejo</h4>
              {!showEnviarApr ? (
                <button onClick={() => setShowEnviarApr(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                  📨 Enviar al Consejo
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nota explicativa (opcional)</label>
                    <textarea value={aprNota} onChange={(e) => setAprNota(e.target.value)} rows={2} className={INPUT}
                      placeholder="Resumen ejecutivo o contexto para los miembros del consejo…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha límite de votación</label>
                    <input type="date" value={aprFechaLimite} onChange={(e) => setAprFechaLimite(e.target.value)} className={INPUT} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEnviarAprobacion} disabled={enviandoApr}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-60">
                      {enviandoApr ? "Enviando…" : "Confirmar envío"}
                    </button>
                    <button onClick={() => setShowEnviarApr(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && !esFinalizado && proyecto.etapa === "APPROVAL" && (
            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Aprobación por Acta de Asamblea</h4>
              <p className="text-xs text-gray-500 mb-3">Alternativa a la votación digital. Sube el acta firmada para aprobar sin votación individual.</p>
              {!showActa ? (
                <button onClick={() => setShowActa(true)}
                  className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50">
                  📜 Aprobar por Acta
                </button>
              ) : (
                <form onSubmit={handleAprobarPorActa} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">N.° de acta *</label>
                      <input name="acta_numero" required className={INPUT} placeholder="Ej: Acta-2026-05" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha asamblea *</label>
                      <input name="acta_fecha" type="date" required className={INPUT} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción de la decisión *</label>
                    <textarea name="acta_descripcion" required rows={2} className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PDF del acta firmada *</label>
                    <input type="file" accept=".pdf" required className="text-sm text-gray-600" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Registrar y aprobar</button>
                    <button type="button" onClick={() => setShowActa(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {votos.length === 0 && !isAdmin && (
            <div className="text-center py-8 text-gray-400 text-sm">No hay solicitudes de aprobación activas</div>
          )}
        </div>
      )}

      {/* Modal avanzar — campos contextuales */}
      {showAvanzar && (() => {
        const flujoActual = proyecto.tipo === "tarea" ? FLUJO_TAREA : FLUJO_PROYECTO;
        const idx = flujoActual.indexOf(proyecto.etapa);
        const siguiente = flujoActual[idx + 1];
        const esPLANNING = siguiente === "PLANNING";
        const esMONITORING = siguiente === "MONITORING";
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">
                Avanzar a: <span className="text-primary">{ETAPA_LABEL[siguiente]}</span>
              </h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Nota *</label>
                <textarea rows={3} value={avanzarJustificacion} onChange={(e) => setAvanzarJustificacion(e.target.value)}
                  className={INPUT} placeholder="Describe el motivo o estado del avance…" />
                <p className="text-xs text-red-500 mt-0.5">Obligatorio</p>
              </div>
              {esPLANNING && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nueva fecha de entrega estimada (opcional)</label>
                  <input type="date" value={avanzarFecha} onChange={(e) => setAvanzarFecha(e.target.value)} className={INPUT} />
                  <p className="text-xs text-gray-400 mt-1">Si se deja vacío, se mantiene la fecha actual.</p>
                </div>
              )}
              {esMONITORING && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de entrega final (opcional)</label>
                    <input type="date" value={avanzarFechaCierre} onChange={(e) => setAvanzarFechaCierre(e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tiempo de garantía (meses, opcional)</label>
                    <input type="number" min="0" max="120" value={avanzarGarantia} onChange={(e) => setAvanzarGarantia(e.target.value)}
                      className={INPUT} placeholder="Ej: 12" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción del control (opcional)</label>
                    <textarea rows={2} value={avanzarDescControl} onChange={(e) => setAvanzarDescControl(e.target.value)}
                      className={INPUT} placeholder="Observaciones sobre el cierre y control de calidad…" />
                  </div>
                </>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { setShowAvanzar(false); setAvanzarJustificacion(""); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                <button onClick={handleAvanzar} disabled={avanzando} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {avanzando ? "…" : "Confirmar →"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal cancelar */}
      {showCancelar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">¿Cancelar este proyecto?</h3>
            <p className="text-sm text-gray-500 mb-4">Esta acción es irreversible. El proyecto pasará a estado CANCELADO.</p>
            <textarea
              value={justCancelar}
              onChange={(e) => setJustCancelar(e.target.value)}
              placeholder="Motivo de cancelación (obligatorio)…"
              rows={3}
              className={INPUT}
            />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowCancelar(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Volver</button>
              <button onClick={handleCancelar} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                Cancelar proyecto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
