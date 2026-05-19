"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; success: boolean; summary: string }[];
  loading?: boolean;
};

type Props = {
  user: AuthUser;
  edificioId: number | null | undefined;
};

const WELCOME_MSG: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hola 👋 Soy tu asistente IA de TorreAdmin. Puedo ayudarte a consultar información y ejecutar acciones en la plataforma usando lenguaje natural. ¿En qué te puedo ayudar?",
};

const QUICK_ACTIONS: Record<string, string[]> = {
  superadmin: ["Ver estadísticas globales", "Listar conjuntos", "¿Cómo activar un módulo?"],
  administrador: ["Ver cuotas vencidas", "¿Cuántos morosos hay?", "Crear un comunicado"],
  propietario: ["Ver mis cuotas", "Reservar una zona común", "Reportar un problema"],
};

export default function ChatbotBubble({ user, edificioId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickActions = QUICK_ACTIONS[user.rol] ?? QUICK_ACTIONS.propietario;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    const loadingMsg: Message = {
      id: Date.now().toString() + "-load",
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    const history = messages
      .filter((m) => !m.loading && m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.chatbot.sendMessage(content, history);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: res.message, actions: res.actions, loading: false }
            : m
        )
      );
    } catch (err: any) {
      const errText =
        err?.message?.includes("503")
          ? "El asistente IA no está configurado aún. Contacta al administrador."
          : "Ocurrió un error al contactar el asistente. Intenta de nuevo.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id ? { ...m, content: errText, loading: false } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([WELCOME_MSG]);
  }

  return (
    <>
      {/* Floating bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary shadow-lg hover:bg-primary-dark transition-all hover:scale-110 flex items-center justify-center text-white text-2xl"
          title="Abrir asistente IA"
        >
          🤖
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[560px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <p className="font-semibold text-sm leading-none">Asistente TorreAdmin</p>
                <p className="text-xs text-white/70 mt-0.5">Powered by IA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title="Limpiar conversación"
              >
                Limpiar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}
                >
                  {m.loading ? (
                    <span className="flex gap-1 items-center h-5">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.actions.map((a, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                a.success
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-600"
                              }`}
                            >
                              {a.success ? "✓" : "✗"} {a.summary || a.tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Quick actions (only shown when only welcome message) */}
            {messages.length === 1 && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 text-center">Acciones rápidas</p>
                {quickActions.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => send(qa)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-600 hover:text-primary transition-colors"
                  >
                    {qa}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribe tu pregunta… (Enter para enviar)"
                rows={1}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary max-h-24 overflow-y-auto"
                style={{ height: "auto", minHeight: "38px" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 96) + "px";
                }}
                disabled={loading}
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-300 text-center mt-1.5">
              El asistente puede cometer errores. Verifica información importante.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
