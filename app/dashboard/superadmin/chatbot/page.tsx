"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const PROVEEDORES = [
  { value: "claude",      label: "Claude (Anthropic)",   needsKey: true,  needsUrl: false },
  { value: "openai",      label: "OpenAI (GPT)",         needsKey: true,  needsUrl: false },
  { value: "gemini",      label: "Gemini (Google)",      needsKey: true,  needsUrl: false },
  { value: "openrouter",  label: "OpenRouter",           needsKey: true,  needsUrl: true  },
  { value: "ollama",      label: "Ollama (local)",       needsKey: false, needsUrl: true  },
];

const MODELOS_DEFAULT: Record<string, string[]> = {
  claude:     ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini:     ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  openrouter: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro-1.5"],
  ollama:     ["llama3.1", "llama3.2", "mistral", "gemma2"],
};

export default function ChatbotConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencia_ms: number } | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    proveedor: "claude",
    api_key: "",
    modelo: "",
    base_url: "",
    temperatura: 0.3,
  });

  const proveedor = PROVEEDORES.find((p) => p.value === form.proveedor) ?? PROVEEDORES[0];
  const modelosDisponibles = MODELOS_DEFAULT[form.proveedor] ?? [];

  useEffect(() => {
    api.chatbot.getConfig()
      .then((data) => {
        setForm({
          proveedor: data.proveedor ?? "claude",
          api_key: "",  // Never pre-fill the real key
          modelo: data.modelo ?? "",
          base_url: data.base_url ?? "",
          temperatura: data.temperatura ?? 0.3,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.chatbot.updateConfig({
        proveedor: form.proveedor,
        api_key: form.api_key || undefined,
        modelo: form.modelo || undefined,
        base_url: form.base_url || undefined,
        temperatura: form.temperatura,
      });
      setSaved(true);
      setForm((f) => ({ ...f, api_key: "" })); // Clear key field after save
    } catch (e: any) {
      setError("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.chatbot.testConnection();
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: "Error al conectar con el servidor.", latencia_ms: 0 });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Cargando configuración…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Configuración del Asistente IA</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configura el proveedor de inteligencia artificial para el chatbot de la plataforma. Esta configuración aplica a todos los edificios que tengan el módulo &quot;Asistente IA&quot; activado.
        </p>
      </div>

      <div className="bg-white border rounded-2xl p-6 space-y-5">
        {/* Proveedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor de IA</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVEEDORES.map((p) => (
              <button
                key={p.value}
                onClick={() => setForm((f) => ({ ...f, proveedor: p.value, modelo: "", api_key: "", base_url: "" }))}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                  form.proveedor === p.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        {proveedor.needsKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Key <span className="text-gray-400 font-normal">(déjala vacía para no cambiarla)</span>
            </label>
            <input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder="sk-... / ant-..."
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
        )}

        {/* URL Base (Ollama / OpenRouter) */}
        {proveedor.needsUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              URL Base
              {form.proveedor === "ollama" && (
                <span className="text-gray-400 font-normal ml-1">(ej: http://localhost:11434/v1)</span>
              )}
            </label>
            <input
              type="url"
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              placeholder={form.proveedor === "ollama" ? "http://localhost:11434/v1" : "https://openrouter.ai/api/v1"}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
        )}

        {/* Modelo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo</label>
          <div className="flex gap-2">
            <select
              value={modelosDisponibles.includes(form.modelo) ? form.modelo : ""}
              onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— Default del proveedor —</option>
              {modelosDisponibles.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              value={modelosDisponibles.includes(form.modelo) ? "" : form.modelo}
              onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
              placeholder="Modelo personalizado"
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Usa el selector o escribe un ID de modelo personalizado.</p>
        </div>

        {/* Temperatura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Temperatura: <span className="text-primary font-semibold">{form.temperatura.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.temperatura}
            onChange={(e) => setForm((f) => ({ ...f, temperatura: parseFloat(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0.0 — Más preciso</span>
            <span>1.0 — Más creativo</span>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-xl">
            ✓ Configuración guardada correctamente.
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className={`border text-sm px-4 py-2.5 rounded-xl ${
            testResult.ok
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {testResult.ok ? "✓" : "✗"} {testResult.message}
            {testResult.latencia_ms > 0 && (
              <span className="ml-2 opacity-70">({testResult.latencia_ms}ms)</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? "Probando…" : "Probar conexión"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="px-5 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1.5">
        <p className="font-semibold">¿Cómo activar el asistente en un edificio?</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Guarda la configuración del proveedor aquí.</li>
          <li>Ve a <strong>Edificios → [Edificio] → Módulos</strong>.</li>
          <li>Activa el módulo <strong>&quot;Asistente IA&quot;</strong>.</li>
          <li>Los administradores y propietarios del edificio verán la burbuja 🤖.</li>
        </ol>
      </div>
    </div>
  );
}
