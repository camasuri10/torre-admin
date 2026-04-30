"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;
const USUARIO_ID = 1; // TODO: from auth context
const USUARIO_NOMBRE = "Juan Rodríguez";

const TIPO_COLORS: Record<string, string> = {
  alerta: "bg-red-100 border-red-300",
  texto: "",
  imagen: "",
};

export default function ChatPage() {
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"texto" | "alerta">("texto");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const msgs = await api.chat.mensajes(EDIFICIO_ID, 100);
      setMensajes(msgs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Poll every 5 seconds for new messages
    pollRef.current = setInterval(load, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    await api.chat.enviar({
      edificio_id: EDIFICIO_ID,
      remitente_id: USUARIO_ID,
      contenido: texto.trim(),
      tipo: tipoMensaje,
    });
    setTexto("");
    load();
  };

  const isMe = (msg: any) => msg.remitente_id === USUARIO_ID;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="bg-white rounded-t-xl border border-gray-200 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-xl">💬</div>
        <div>
          <div className="font-semibold text-gray-900">Chat de Seguridad</div>
          <div className="text-xs text-gray-400">Torres del Norte · Personal de portería y administración</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-gray-500">En línea</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x border-gray-200 p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Cargando mensajes...</div>
        ) : mensajes.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No hay mensajes aún. Inicia la conversación.</p>
          </div>
        ) : mensajes.map((msg) => (
          <div key={msg.id} className={`flex ${isMe(msg) ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] ${isMe(msg) ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {!isMe(msg) && (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {msg.remitente_nombre?.[0] ?? "?"}
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{msg.remitente_nombre}</span>
                  <span className="text-xs text-gray-400 capitalize">({msg.remitente_rol})</span>
                </div>
              )}
              <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm border ${
                msg.tipo === "alerta"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : isMe(msg)
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-800 border-gray-200"
              }`}>
                {msg.tipo === "alerta" && <span className="font-bold mr-1">🚨 ALERTA:</span>}
                {msg.contenido}
              </div>
              <span className="text-[10px] text-gray-400 px-1">
                {new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-b-xl border border-gray-200 p-4">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              {(["texto", "alerta"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoMensaje(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    tipoMensaje === t
                      ? t === "alerta" ? "bg-red-500 text-white" : "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t === "alerta" ? "🚨 Alerta" : "💬 Mensaje"}
                </button>
              ))}
            </div>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={tipoMensaje === "alerta" ? "Describe la alerta de seguridad..." : "Escribe un mensaje..."}
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                tipoMensaje === "alerta"
                  ? "border-red-300 focus:ring-red-200"
                  : "border-gray-300 focus:ring-primary/20"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={!texto.trim()}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            Enviar
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Enviando como: <strong>{USUARIO_NOMBRE}</strong> · Los mensajes se actualizan automáticamente cada 5 segundos
        </p>
      </div>
    </div>
  );
}
