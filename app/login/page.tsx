"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { setToken, setEdificiosDisponibles, setUserTemp } from "@/lib/auth";

const DEMO_CREDENTIALS = [
  { rol: "Super Admin",   email: "superadmin@torreadmin.co", password: "Super123!" },
  { rol: "Administrador", email: "admin@torreadmin.co",      password: "Admin123!" },
  { rol: "Propietario",   email: "c.martinez@gmail.com",     password: "Prop123!" },
  { rol: "Portero",       email: "guardia1@torreadmin.co",   password: "Guardia123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login(email, password);

      if (data.requires_building_selection) {
        setEdificiosDisponibles(data.edificios);
        setUserTemp(data.user_temp);
        router.push("/login/seleccionar-edificio");
        return;
      }

      setToken(data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Credenciales inválidas. Verifica tu email y contraseña.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(cred: typeof DEMO_CREDENTIALS[0]) {
    setEmail(cred.email);
    setPassword(cred.password);
    setError("");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
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
          <p className="text-gray-600 text-sm">Ingresa tus credenciales para acceder al panel</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@torreadmin.co"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Credenciales de prueba
          </p>
          <div className="space-y-2">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.email}
                onClick={() => fillDemo(cred)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">
                    {cred.rol}
                  </div>
                  <div className="text-xs text-gray-400">{cred.email}</div>
                </div>
                <div className="text-xs text-gray-300 font-mono group-hover:text-gray-400 transition-colors">
                  {cred.password}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
