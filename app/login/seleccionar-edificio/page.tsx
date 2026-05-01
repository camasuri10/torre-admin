"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import {
  getEdificiosDisponibles,
  getUserTemp,
  setToken,
  clearUserTemp,
  type EdificioBasic,
} from "@/lib/auth";

export default function SeleccionarEdificioPage() {
  const router = useRouter();
  const [edificios, setEdificios] = useState<EdificioBasic[]>([]);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const lista = getEdificiosDisponibles();
    const user = getUserTemp();
    if (!lista.length || !user) {
      router.replace("/login");
      return;
    }
    setEdificios(lista);
  }, [router]);

  async function handleSelect(edificio: EdificioBasic) {
    const user = getUserTemp();
    if (!user) { router.replace("/login"); return; }

    setLoading(edificio.id);
    setError("");
    try {
      const data = await authApi.seleccionarEdificio(user.id, edificio.id);
      setToken(data.access_token);
      clearUserTemp();
      router.push("/dashboard");
    } catch {
      setError("No se pudo acceder al edificio. Intenta de nuevo.");
      setLoading(null);
    }
  }

  if (!edificios.length) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-xl">T</span>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-gray-900">TorreAdmin</div>
              <div className="text-sm text-gray-500">Gestión de Propiedad Horizontal</div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Selecciona un edificio</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tienes acceso a múltiples edificios. ¿A cuál deseas ingresar?
          </p>
        </div>

        {/* Building cards */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          {edificios.map((e) => (
            <button
              key={e.id}
              onClick={() => handleSelect(e)}
              disabled={loading !== null}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 hover:border-primary/40 hover:bg-blue-50/40 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <span className="text-lg">🏢</span>
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                  {e.nombre}
                </div>
              </div>
              {loading === e.id ? (
                <span className="text-xs text-primary font-medium animate-pulse">Ingresando...</span>
              ) : (
                <span className="text-gray-300 group-hover:text-primary transition-colors">→</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        <button
          onClick={() => router.push("/login")}
          className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
        >
          ← Volver al login
        </button>
      </div>
    </div>
  );
}
