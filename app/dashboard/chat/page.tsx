"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const ROL_COLOR: Record<string, string> = {
  administrador: "bg-blue-500",
  portero:       "bg-green-600",
  propietario:   "bg-purple-500",
  inquilino:     "bg-orange-400",
};
const ROL_LABEL: Record<string, string> = {
  administrador: "Admin",
  portero:       "Portero",
  propietario:   "Propietario",
  inquilino:     "Inquilino",
};

type ConvGrupo = { tipo: "grupo" };
type ConvDM    = { tipo: "dm"; usuarioId: number; nombre: string; rol: string };
type Conv = ConvGrupo | ConvDM;

export default function ChatPage() {
  const authUser   = getUser();
  const usuarioId  = authUser ? parseInt(authUser.sub) : 0;
  const conjuntoId = authUser?.conjunto_id ?? 1;

  const [conv, setConv]                 = useState<Conv>({ tipo: "grupo" });
  const [mensajes, setMensajes]         = useState<any[]>([]);
  const [conversaciones, setConvs]      = useState<any[]>([]);
  const [texto, setTexto]               = useState("");
  const [tipoMensaje, setTipoMensaje]   = useState<"texto" | "alerta">("texto");
  const [loading, setLoading]           = useState(true);
  const [showPicker, setShowPicker]     = useState(false);
  const [usuarios, setUsuarios]         = useState<any[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [showSidebar, setShowSidebar]   = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMensajes = useCallback(async () => {
    try {
      let msgs: any[];
      if (conv.tipo === "grupo") {
        msgs = await api.chat.mensajes(conjuntoId, 100);
        api.chat.marcarLeidos(conjuntoId, usuarioId).catch(() => {});
      } else {
        msgs = await api.chat.mensajesDM(conjuntoId, usuarioId, conv.usuarioId, 100);
        api.chat.marcarLeidos(conjuntoId, usuarioId, conv.usuarioId).catch(() => {});
      }
      setMensajes(msgs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conv, conjuntoId, usuarioId]);

  const loadConvs = useCallback(async () => {
    try {
      const data = await api.chat.conversaciones(conjuntoId, usuarioId);
      setConvs(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, [conjuntoId, usuarioId]);

  useEffect(() => {
    setLoading(true);
    loadMensajes();
    loadConvs();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { loadMensajes(); loadConvs(); }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMensajes, loadConvs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    const payload: any = {
      conjunto_id:  conjuntoId,
      remitente_id: usuarioId,
      contenido:    texto.trim(),
      tipo:         conv.tipo === "dm" ? "texto" : tipoMensaje,
    };
    if (conv.tipo === "dm") payload.receptor_id = conv.usuarioId;
    await api.chat.enviar(payload);
    setTexto("");
    loadMensajes();
    loadConvs();
  };

  const openDM = (u: any) => {
    setConv({ tipo: "dm", usuarioId: u.id, nombre: u.nombre, rol: u.rol });
    setShowPicker(false);
    setPickerSearch("");
    setShowSidebar(false);
  };

  const loadUsuarios = async () => {
    try {
      const data = await api.usuarios.list({ conjunto_id: conjuntoId });
      setUsuarios(
        (Array.isArray(data) ? data : []).filter(
          (u: any) => u.id !== usuarioId && ["administrador","portero","propietario","inquilino"].includes(u.rol ?? "")
        )
      );
    } catch {}
  };

  const isMe = (msg: any) => msg.remitente_id === usuarioId;

  const convLabel =
    conv.tipo === "grupo"
      ? { titulo: "Chat General", sub: "Todos en el conjunto", avatar: "🏢", color: "" }
      : { titulo: conv.nombre, sub: ROL_LABEL[conv.rol] ?? conv.rol, avatar: conv.nombre[0], color: ROL_COLOR[conv.rol] ?? "bg-gray-400" };

  const pickerFiltered = pickerSearch.trim()
    ? usuarios.filter((u: any) =>
        u.nombre.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (u.rol ?? "").toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : usuarios;

  const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className={`${showSidebar ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 border-r border-gray-100 flex-shrink-0`}>
        {/* Sidebar header */}
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">Mensajes</span>
          <button
            onClick={() => { loadUsuarios(); setShowPicker(true); }}
            title="Nueva conversación"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-base font-bold leading-none"
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* General */}
          <button
            onClick={() => { setConv({ tipo: "grupo" }); setShowSidebar(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${conv.tipo === "grupo" ? "bg-primary/5 border-r-2 border-primary" : ""}`}
          >
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-lg flex-shrink-0">🏢</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800">Chat General</div>
              <div className="text-xs text-gray-400 truncate">Todos en el conjunto</div>
            </div>
          </button>

          {/* DMs */}
          {conversaciones.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Directos</p>
            </div>
          )}
          {conversaciones.map((c: any) => {
            const isActive = conv.tipo === "dm" && conv.usuarioId === c.otro_id;
            return (
              <button
                key={c.otro_id}
                onClick={() => { setConv({ tipo: "dm", usuarioId: c.otro_id, nombre: c.otro_nombre, rol: c.otro_rol }); setShowSidebar(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${isActive ? "bg-primary/5 border-r-2 border-primary" : ""}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${ROL_COLOR[c.otro_rol] ?? "bg-gray-400"}`}>
                  {(c.otro_nombre ?? "?")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{c.otro_nombre}</span>
                    {c.no_leidos > 0 && (
                      <span className="flex-shrink-0 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {c.no_leidos}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{c.ultimo_mensaje ?? ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Área de mensajes ─────────────────────────────────────────── */}
      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-col flex-1 min-w-0`}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setShowSidebar(true)} className="md:hidden text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${conv.tipo === "grupo" ? "bg-primary/10 text-lg" : `${convLabel.color} text-white font-bold text-sm`}`}>
            {convLabel.avatar}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">{convLabel.titulo}</div>
            <div className="text-xs text-gray-400">{convLabel.sub}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">En línea</span>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Cargando mensajes…</div>
          ) : mensajes.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-4xl mb-2">{conv.tipo === "grupo" ? "🏢" : "💬"}</div>
              <p className="text-sm">
                {conv.tipo === "grupo"
                  ? "No hay mensajes aún. Inicia la conversación."
                  : `Inicia una conversación con ${conv.nombre}.`}
              </p>
            </div>
          ) : (
            mensajes.map((msg) => (
              <div key={msg.id} className={`flex ${isMe(msg) ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] flex flex-col gap-1 ${isMe(msg) ? "items-end" : "items-start"}`}>
                  {!isMe(msg) && (
                    <div className="flex items-center gap-1.5 px-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${ROL_COLOR[msg.remitente_rol] ?? "bg-gray-400"}`}>
                        {(msg.remitente_nombre ?? "?")[0]}
                      </div>
                      <span className="text-xs text-gray-600 font-medium">{msg.remitente_nombre}</span>
                      <span className="text-[10px] text-gray-400">({ROL_LABEL[msg.remitente_rol] ?? msg.remitente_rol})</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.tipo === "alerta"
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : isMe(msg)
                      ? "bg-primary text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}>
                    {msg.tipo === "alerta" && <span className="font-bold mr-1">🚨</span>}
                    {msg.contenido}
                  </div>
                  <span className="text-[10px] text-gray-400 px-1">
                    {new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 p-4 flex-shrink-0">
          <form onSubmit={handleSend} className="flex gap-3 items-end">
            <div className="flex-1">
              {conv.tipo === "grupo" && (
                <div className="flex gap-2 mb-2">
                  {(["texto", "alerta"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTipoMensaje(t)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        tipoMensaje === t
                          ? t === "alerta" ? "bg-red-500 text-white" : "bg-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      {t === "alerta" ? "🚨 Alerta" : "💬 Mensaje"}
                    </button>
                  ))}
                </div>
              )}
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={
                  conv.tipo === "dm"
                    ? `Mensaje a ${conv.nombre}…`
                    : tipoMensaje === "alerta" ? "Describe la alerta…" : "Escribe un mensaje…"
                }
                className={`${INPUT} ${tipoMensaje === "alerta" && conv.tipo === "grupo" ? "border-red-300 focus:ring-red-200" : ""}`}
              />
            </div>
            <button type="submit" disabled={!texto.trim()}
              className="bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0">
              Enviar
            </button>
          </form>
        </div>
      </div>

      {/* ── Modal: nueva conversación ─────────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Nueva conversación</h3>
              <button onClick={() => { setShowPicker(false); setPickerSearch(""); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar persona…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {pickerFiltered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No se encontraron usuarios</p>
              ) : (
                pickerFiltered.map((u: any) => (
                  <button key={u.id} onClick={() => openDM(u)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${ROL_COLOR[u.rol] ?? "bg-gray-400"}`}>
                      {(u.nombre ?? "?")[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{u.nombre}</div>
                      <div className="text-xs text-gray-400">{ROL_LABEL[u.rol] ?? u.rol}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
