"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, clearToken, type AuthUser } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact: boolean;
  roles: AuthUser["rol"][];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Resumen", icon: "📊", exact: true, roles: ["administrador", "propietario", "inquilino", "portero"] },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/dashboard/residentes",   label: "Residentes",    icon: "👥", exact: false, roles: ["administrador"] },
      { href: "/dashboard/finanzas",     label: "Finanzas",      icon: "💰", exact: false, roles: ["administrador", "propietario", "inquilino"] },
      { href: "/dashboard/mantenimiento",label: "Mantenimiento", icon: "🔧", exact: false, roles: ["administrador", "propietario", "inquilino"] },
      { href: "/dashboard/comunicados",  label: "Comunicados",   icon: "📢", exact: false, roles: ["administrador", "propietario", "inquilino"] },
      { href: "/dashboard/zonas-comunes",label: "Zonas Comunes", icon: "🏊", exact: false, roles: ["administrador", "propietario", "inquilino"] },
    ],
  },
  {
    label: "Seguridad",
    items: [
      { href: "/dashboard/accesos",  label: "Control de Accesos", icon: "🔐", exact: false, roles: ["administrador", "portero"] },
      { href: "/dashboard/paquetes", label: "Paquetería",         icon: "📦", exact: false, roles: ["administrador", "portero"] },
      { href: "/dashboard/chat",     label: "Chat Seguridad",     icon: "💬", exact: false, roles: ["administrador", "portero"] },
      { href: "/dashboard/guardias", label: "Guardias / Turnos",  icon: "👮", exact: false, roles: ["administrador", "portero"] },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/dashboard/reportes", label: "Reportes", icon: "📈", exact: false, roles: ["administrador"] },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const ROL_LABELS: Record<AuthUser["rol"], string> = {
  administrador: "Administrador",
  propietario:   "Propietario",
  inquilino:     "Inquilino",
  portero:       "Portero / Seguridad",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/login");
    } else {
      setUser(u);
    }
  }, [router]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const visibleGroups = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !user || item.roles.includes(user.rol)),
    }))
    .filter((g) => g.items.length > 0);

  const currentLabel = ALL_ITEMS.find((i) => isActive(i))?.label ?? "Dashboard";

  const initials = user?.nombre
    ? user.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "…";

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-primary flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-extrabold text-base">T</span>
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-none">TorreAdmin</div>
              <div className="text-blue-300 text-xs mt-0.5">Panel de Administración</div>
            </div>
          </Link>
        </div>

        {/* Building selector */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <div className="text-blue-300 text-xs mb-0.5">Edificio activo</div>
            <div className="text-white text-sm font-medium flex items-center justify-between">
              Torres del Norte
              <span className="text-blue-300 text-xs">▼</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive(item)
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-blue-200 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">
                {user?.nombre ?? "Cargando…"}
              </div>
              <div className="text-blue-300 text-xs">
                {user ? ROL_LABELS[user.rol] : ""}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="ml-auto text-blue-300 hover:text-white transition-colors text-lg"
              title="Cerrar sesión"
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{currentLabel}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("es-CO", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Notificaciones"
            >
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-primary transition-colors font-medium"
            >
              ← Ir al sitio
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
