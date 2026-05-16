"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const PROVEEDORES = [
  { value: "claude",      label: "Claude (Anthropic)",   needsKey: true,  needsUrl: false, defaultUrl: "" },
  { value: "openai",      label: "OpenAI (GPT)",         needsKey: true,  needsUrl: false, defaultUrl: "" },
  { value: "gemini",      label: "Gemini (Google)",      needsKey: true,  needsUrl: false, defaultUrl: "" },
  { value: "openrouter",  label: "OpenRouter",           needsKey: true,  needsUrl: true,  defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "ollama",      label: "Ollama (local)",       needsKey: false, needsUrl: true,  defaultUrl: "http://localhost:11434/v1" },
];

const OPENROUTER_FREE_MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "arcee-ai/trinity-large-thinking:free",
];

const OPENROUTER_PAID_MODELS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-pro-1.5",
];

const MODELOS_DEFAULT: Record<string, string[]> = {
  claude:     ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini:     ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  openrouter: [...OPENROUTER_FREE_MODELS, ...OPENROUTER_PAID_MODELS],
  ollama:     ["llama3.1", "llama3.2", "mistral", "gemma2"],
};

const EMPTY_FORM = {
  nombre: "",
  proveedor: "claude",
  api_key: "",
  modelo: "",
  base_url: "",
  temperatura: 0.3,
};

type FormState = typeof EMPTY_FORM;
type TestResult = { ok: boolean; message: string; latencia_ms: number };

function ConfigForm({
  form, setForm, onSave, onCancel, saving, isEdit, error, onTest, testing, testResult,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
  error: string;
  onTest: () => void;
  testing: boolean;
  testResult: TestResult | null;
}) {
  const proveedor = PROVEEDORES.find((p) => p.value === form.proveedor) ?? PROVEEDORES[0];
  const modelosDisponibles = MODELOS_DEFAULT[form.proveedor] ?? [];

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la configuración</label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Ej: Claude Producción, OpenRouter Testing…"
          className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor de IA</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVEEDORES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                if (form.proveedor === p.value) return;
                setForm((f) => ({ ...f, proveedor: p.value, modelo: "", api_key: "", base_url: p.defaultUrl }));
              }}
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

      {proveedor.needsKey && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            API Key{isEdit && <span className="text-gray-400 font-normal ml-1">(vacía = sin cambios)</span>}
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

      {proveedor.needsUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            URL Base
            {form.proveedor === "openrouter" && (
              <span className="text-gray-400 font-normal ml-1">— pre-configurada</span>
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo</label>
        <div className="flex gap-2">
          <select
            value={modelosDisponibles.includes(form.modelo) ? form.modelo : ""}
            onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— Default del proveedor —</option>
            {form.proveedor === "openrouter" ? (
              <>
                <optgroup label="Modelos gratuitos">
                  {OPENROUTER_FREE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Modelos de pago">
                  {OPENROUTER_PAID_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              </>
            ) : (
              modelosDisponibles.map((m) => <option key={m} value={m}>{m}</option>)
            )}
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Temperatura: <span className="text-primary font-semibold">{form.temperatura.toFixed(1)}</span>
        </label>
        <input
          type="range" min={0} max={1} step={0.1}
          value={form.temperatura}
          onChange={(e) => setForm((f) => ({ ...f, temperatura: parseFloat(e.target.value) }))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0.0 — Más preciso</span>
          <span>1.0 — Más creativo</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
      )}
      {testResult && (
        <div className={`border text-sm px-4 py-2.5 rounded-xl ${
          testResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {testResult.ok ? "✓" : "✗"} {testResult.message}
          {testResult.latencia_ms > 0 && <span className="ml-2 opacity-70">({testResult.latencia_ms}ms)</span>}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onTest} disabled={testing || saving}
          className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {testing ? "Probando…" : "Probar conexión"}
        </button>
        <button type="button" onClick={onSave} disabled={saving || testing}
          className="px-5 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium">
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear configuración"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function BoChatbotPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  const [createForm, setCreateForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState<FormState>({ ...EMPTY_FORM });

  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [createTesting, setCreateTesting] = useState(false);
  const [editTesting, setEditTesting] = useState(false);
  const [createTestResult, setCreateTestResult] = useState<TestResult | null>(null);
  const [editTestResult, setEditTestResult] = useState<TestResult | null>(null);
  const [createError, setCreateError] = useState("");
  const [editError, setEditError] = useState("");

  async function loadConfigs() {
    try {
      const data = await api.chatbot.listConfigs();
      setConfigs(data);
    } catch {
      // ignore on first load
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConfigs(); }, []);

  async function handleCreate() {
    if (!createForm.nombre.trim()) { setCreateError("El nombre es obligatorio."); return; }
    if (!createForm.api_key && PROVEEDORES.find(p => p.value === createForm.proveedor)?.needsKey) {
      setCreateError("La API key es obligatoria para este proveedor."); return;
    }
    setCreateSaving(true); setCreateError("");
    try {
      await api.chatbot.createConfig({
        nombre: createForm.nombre.trim(),
        proveedor: createForm.proveedor,
        api_key: createForm.api_key,
        modelo: createForm.modelo || undefined,
        base_url: createForm.base_url || undefined,
        temperatura: createForm.temperatura,
      });
      setShowCreate(false);
      setCreateForm({ ...EMPTY_FORM });
      setCreateTestResult(null);
      await loadConfigs();
    } catch (e: any) {
      setCreateError(e?.message ?? "Error al crear la configuración.");
    } finally { setCreateSaving(false); }
  }

  async function handleUpdate() {
    if (!editForm.nombre.trim()) { setEditError("El nombre es obligatorio."); return; }
    setEditSaving(true); setEditError("");
    try {
      await api.chatbot.updateConfig(editingConfig.id, {
        nombre: editForm.nombre.trim(),
        proveedor: editForm.proveedor,
        api_key: editForm.api_key || undefined,
        modelo: editForm.modelo || undefined,
        base_url: editForm.base_url || undefined,
        temperatura: editForm.temperatura,
      });
      setEditingConfig(null);
      setEditTestResult(null);
      await loadConfigs();
    } catch (e: any) {
      setEditError(e?.message ?? "Error al guardar los cambios.");
    } finally { setEditSaving(false); }
  }

  async function handleActivate(id: number) {
    try { await api.chatbot.activateConfig(id); await loadConfigs(); }
    catch (e: any) { alert(e?.message ?? "Error al activar."); }
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la configuración "${nombre}"?`)) return;
    try { await api.chatbot.deleteConfig(id); await loadConfigs(); }
    catch (e: any) { alert(e?.message ?? "Error al eliminar."); }
  }

  function openEdit(cfg: any) {
    setEditingConfig(cfg);
    setEditForm({ nombre: cfg.nombre ?? "", proveedor: cfg.proveedor ?? "claude", api_key: "", modelo: cfg.modelo ?? "", base_url: cfg.base_url ?? "", temperatura: cfg.temperatura ?? 0.3 });
    setEditError(""); setEditTestResult(null);
  }

  async function testForm(form: FormState, setTesting: (v: boolean) => void, setResult: (v: TestResult | null) => void) {
    setTesting(true); setResult(null);
    try {
      const result = await api.chatbot.testConnection({ proveedor: form.proveedor, api_key: form.api_key || undefined, modelo: form.modelo || undefined, base_url: form.base_url || undefined, temperatura: form.temperatura });
      setResult(result);
    } catch {
      setResult({ ok: false, message: "Error al conectar con el servidor.", latencia_ms: 0 });
    } finally { setTesting(false); }
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">Cargando configuraciones…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Asistente IA — Configuración Global</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            La configuración <strong>Activa</strong> aplica a <strong>todos los tenants</strong> de la plataforma.
            Centraliza el proveedor aquí para optimizar costos y negociación de tokens.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => { setShowCreate(true); setCreateForm({ ...EMPTY_FORM }); setCreateTestResult(null); setCreateError(""); }}
            className="ml-4 flex-shrink-0 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary/90 transition-colors font-medium"
          >
            + Nueva configuración
          </button>
        )}
      </div>

      {configs.length === 0 && !showCreate && (
        <div className="bg-white border rounded-2xl p-8 text-center text-gray-400 text-sm">
          No hay configuraciones. Crea la primera para activar el asistente IA en toda la plataforma.
        </div>
      )}

      {configs.length > 0 && (
        <div className="bg-white border rounded-2xl divide-y divide-gray-100">
          {configs.map((cfg) => (
            <div key={cfg.id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{cfg.nombre ?? "Sin nombre"}</span>
                  {cfg.activo && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ Activa (global)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {PROVEEDORES.find(p => p.value === cfg.proveedor)?.label ?? cfg.proveedor}
                  {cfg.modelo ? ` · ${cfg.modelo}` : " · modelo default"}
                  {" · "}T: {cfg.temperatura?.toFixed(1)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!cfg.activo && (
                  <button onClick={() => handleActivate(cfg.id)}
                    className="text-xs px-3 py-1.5 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors">
                    Usar esta
                  </button>
                )}
                <button onClick={() => openEdit(cfg)}
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:border-gray-300 transition-colors">
                  Editar
                </button>
                <button onClick={() => handleDelete(cfg.id, cfg.nombre ?? "esta config")}
                  className="text-xs px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border rounded-2xl p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-5">Nueva configuración</h3>
          <ConfigForm
            form={createForm} setForm={setCreateForm}
            onSave={handleCreate} onCancel={() => { setShowCreate(false); setCreateTestResult(null); }}
            saving={createSaving} isEdit={false} error={createError}
            onTest={() => testForm(createForm, setCreateTesting, setCreateTestResult)}
            testing={createTesting} testResult={createTestResult}
          />
        </div>
      )}

      {editingConfig && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Editar configuración</h3>
              <button onClick={() => setEditingConfig(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5">
              <ConfigForm
                form={editForm} setForm={setEditForm}
                onSave={handleUpdate} onCancel={() => setEditingConfig(null)}
                saving={editSaving} isEdit={true} error={editError}
                onTest={() => testForm(editForm, setEditTesting, setEditTestResult)}
                testing={editTesting} testResult={editTestResult}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 space-y-1.5">
        <p className="font-semibold">Ventaja del modelo centralizado</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Una sola API key para todos los tenants — mejor poder de negociación.</li>
          <li>Monitoreo y control de uso de tokens desde un solo proveedor.</li>
          <li>Cambios de proveedor aplican instantáneamente a toda la plataforma.</li>
        </ul>
      </div>
    </div>
  );
}
