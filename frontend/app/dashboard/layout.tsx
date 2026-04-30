"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Resumen", icon: "📊", exact: true },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/dashboard/residentes", label: "Residentes", icon: "👥", exact: false },
      { href: "/dashboard/finanzas", label: "Finanzas", icon: "💰", exact: false },
      { href: "/dashboard/mantenimiento", label: "Mantenimiento", icon: "🔧", exact: false },
      { href: "/dashboard/comunicados", label: "Comunicados", icon: "📢", exact: false },
      { href: "/dashboard/zonas-comunes", label: "Zonas Comunes", icon: "🏊", exact: false },
    ],
  },
  {
    label: "Seguridad",
    items: [
      { href: "/dashboard/accesos", label: "Control de Accesos", icon: "🔐", exact: false },
      { href: "/dashboard/paquetes", label: "Paquetería", icon: "📦", exact: false },
      { href: "/dashboard/chat", label: "Chat Seguridad", icon: "💬", exact: false },
      { href: "/dashboard/guardias", label: "Guardias / Turnos", icon: "👮", exact: false },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/dashboard/reportes", label: "Reportes", icon: "📈", exact: false },
    ],
  },
];

// Flat list for active detection
const navItems = navGroups.flatMap((g) => g.items);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (item: { href: string; exact: boolean }) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

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
          {navGroups.map((group) => (
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
              <span className="text-white font-bold text-sm">JR</span>
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">Juan Rodríguez</div>
              <div className="text-blue-300 text-xs">Administrador</div>
            </div>
            <button className="ml-auto text-blue-300 hover:text-white transition-colors text-lg" title="Cerrar sesión">
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
            <h1 className="text-lg font-semibold text-gray-900">
              {navItems.find((i) => isActive(i))?.label ?? "Dashboard"}
            </h1>
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
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Notificaciones">
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
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
