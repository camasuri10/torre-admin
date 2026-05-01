"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

interface Stats {
  total_edificios: number;
  total_admins: number;
  total_usuarios: number;
  total_modulos: number;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") {
      router.replace("/dashboard");
      return;
    }
    superadminApi.stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Cargando estadísticas…</p>
      </div>
    );
  }

  const cards = [
    { label: "Edificios registrados", value: stats?.total_edificios ?? 0, icon: "🏢", href: "/dashboard/superadmin/edificios", color: "bg-blue-50 border-blue-100" },
    { label: "Administradores",        value: stats?.total_admins ?? 0,    icon: "👤", href: "/dashboard/superadmin/admins",    color: "bg-green-50 border-green-100" },
    { label: "Usuarios totales",        value: stats?.total_usuarios ?? 0,  icon: "👥", href: null,                              color: "bg-purple-50 border-purple-100" },
    { label: "Módulos disponibles",     value: stats?.total_modulos ?? 0,   icon: "🧩", href: null,                              color: "bg-orange-50 border-orange-100" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Panel Super Admin</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestión global de la plataforma TorreAdmin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const inner = (
            <div className={`border rounded-2xl p-5 ${c.color} ${c.href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-3xl font-bold text-gray-900">{c.value}</div>
              <div className="text-sm text-gray-500 mt-1">{c.label}</div>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/superadmin/edificios"
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-blue-50/40 transition-all group"
          >
            <span className="text-xl">🏢</span>
            <div>
              <div className="text-sm font-medium text-gray-800 group-hover:text-primary">Gestionar edificios</div>
              <div className="text-xs text-gray-400">Crear, editar y configurar módulos</div>
            </div>
          </Link>
          <Link
            href="/dashboard/superadmin/admins"
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-blue-50/40 transition-all group"
          >
            <span className="text-xl">👤</span>
            <div>
              <div className="text-sm font-medium text-gray-800 group-hover:text-primary">Gestionar administradores</div>
              <div className="text-xs text-gray-400">Crear admins y asignar edificios</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
