"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import {
  getOrgsDisponibles,
  getUserTemp,
  setToken,
  clearUserTemp,
  type OrgBasic,
} from "@/lib/auth";

export default function SeleccionarOrganizacionPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgBasic[]>([]);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const lista = getOrgsDisponibles();
    const user = getUserTemp();
    if (!lista.length || !user) {
      router.replace("/login");
      return;
    }
    setOrgs(lista);
  }, [router]);

  async function handleSelect(org: OrgBasic) {
    const user = getUserTemp();
    if (!user) { router.replace("/login"); return; }

    setLoading(org.id);
    setError("");
    try {
      const data = await authApi.seleccionarOrganizacion(user.id, org.id);
      setToken(data.access_token);
      clearUserTemp();
      router.push("/dashboard/superadmin");
    } catch {
      setError("No se pudo acceder a la organización. Intenta de nuevo.");
      setLoading(null);
    }
  }

  if (!orgs.length) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
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
          <h2 className="text-lg font-semibold text-gray-800">Selecciona una organización</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tienes acceso a múltiples organizaciones. ¿A cuál deseas ingresar?
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelect(org)}
              disabled={loading !== null}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 hover:border-primary/40 hover:bg-blue-50/40 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <span className="text-lg">🏢</span>
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                  {org.nombre}
                </div>
              </div>
              {loading === org.id ? (
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
