"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats]       = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }
    Promise.all([superadminApi.stats(), superadminApi.analytics()])
      .then(([s, a]) => { setStats(s); setAnalytics(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Cargando…</p></div>;
  }

  const statCards = [
    { label: "Conjuntos",          value: stats?.total_conjuntos ?? 0,  icon: "🏘️", href: "/dashboard/superadmin/conjuntos", color: "bg-sky-50 border-sky-100" },
    { label: "Edificios/Torres",   value: stats?.total_edificios ?? 0,  icon: "🏢", href: "/dashboard/superadmin/edificios", color: "bg-blue-50 border-blue-100" },
    { label: "Administradores",    value: stats?.total_admins ?? 0,     icon: "👤", href: "/dashboard/superadmin/admins",    color: "bg-green-50 border-green-100" },
    { label: "Staff Servicios",    value: stats?.total_staff ?? 0,      icon: "🧹", href: "/dashboard/superadmin/admins",    color: "bg-teal-50 border-teal-100" },
    { label: "Usuarios totales",   value: stats?.total_usuarios ?? 0,   icon: "👥", href: null,                              color: "bg-purple-50 border-purple-100" },
    { label: "Módulos disponibles",value: stats?.total_modulos ?? 0,    icon: "🧩", href: null,                              color: "bg-orange-50 border-orange-100" },
  ];

  const topModulos: any[] = analytics?.top_modulos ?? [];

  const maxUsos = topModulos.reduce((m: number, x: any) => Math.max(m, x.total_usos), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Panel Super Admin</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestión global de la plataforma TorreAdmin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((c) => {
          const inner = (
            <div className={`border rounded-2xl p-5 h-full ${c.color} ${c.href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-3xl font-bold text-gray-900">{c.value}</div>
              <div className="text-sm text-gray-500 mt-1">{c.label}</div>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="h-full block">{inner}</Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analytics: módulos más usados */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Módulos más usados</h3>
          {topModulos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos de uso aún. El uso se registra automáticamente al navegar por los módulos.</p>
          ) : (
            <div className="space-y-3">
              {topModulos.slice(0, 5).map((m: any) => (
                <div key={m.modulo_clave} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{m.modulo_nombre ?? m.modulo_clave}</span>
                    <span className="text-gray-500 text-xs">{m.total_usos} usos · {m.usuarios_unicos} usuarios</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((m.total_usos / maxUsos) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { href: "/dashboard/superadmin/conjuntos", icon: "🏘️", label: "Gestionar conjuntos", desc: "Agrupar torres bajo un conjunto" },
              { href: "/dashboard/superadmin/edificios", icon: "🏢", label: "Gestionar edificios",  desc: "Crear, editar y configurar módulos" },
              { href: "/dashboard/superadmin/admins",    icon: "👤", label: "Gestionar personal",   desc: "Admins, porteros y staff de servicios" },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-blue-50/40 transition-all group">
                <span className="text-xl">{a.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800 group-hover:text-primary">{a.label}</div>
                  <div className="text-xs text-gray-400">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
