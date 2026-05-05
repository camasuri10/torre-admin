"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getUser, clearToken, setToken, getEdificiosDisponibles, type AuthUser } from "@/lib/auth";
import { authApi, api } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact: boolean;
  roles: AuthUser["rol"][];
  modulo?: string;
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
    label: "Super Admin",
    items: [
      { href: "/dashboard/superadmin",            label: "Panel SA",         icon: "⚙️",  exact: true,  roles: ["superadmin"] },
      { href: "/dashboard/superadmin/conjuntos",  label: "Conjuntos",        icon: "🏘️",  exact: false, roles: ["superadmin"] },
      { href: "/dashboard/superadmin/edificios",  label: "Edificios",        icon: "🏢",  exact: false, roles: ["superadmin"] },
      { href: "/dashboard/superadmin/admins",     label: "Administradores",  icon: "👤",  exact: false, roles: ["superadmin"] },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/dashboard/residentes",    label: "Residentes",    icon: "👥", exact: false, roles: ["administrador"] },
      { href: "/dashboard/finanzas",      label: "Finanzas",      icon: "💰", exact: false, roles: ["administrador", "propietario", "inquilino"],                        modulo: "finanzas" },
      { href: "/dashboard/mantenimiento", label: "Mantenimiento", icon: "🔧", exact: false, roles: ["administrador", "propietario", "inquilino", "servicios"],           modulo: "mantenimiento" },
      { href: "/dashboard/proveedores",   label: "Proveedores",   icon: "🏭", exact: false, roles: ["administrador", "superadmin"] },
      { href: "/dashboard/comunicados",   label: "Comunicados",   icon: "📢", exact: false, roles: ["administrador", "propietario", "inquilino"],                        modulo: "comunicados" },
      { href: "/dashboard/zonas-comunes", label: "Zonas Comunes", icon: "🏊", exact: false, roles: ["administrador", "propietario", "inquilino"],                        modulo: "zonas_comunes" },
    ],
  },
  {
    label: "Seguridad",
    items: [
      { href: "/dashboard/accesos",  label: "Control de Accesos", icon: "🔐", exact: false, roles: ["administrador", "portero"],                        modulo: "accesos" },
      { href: "/dashboard/paquetes", label: "Paquetería",         icon: "📦", exact: false, roles: ["administrador", "portero"],                        modulo: "paquetes" },
      { href: "/dashboard/chat",     label: "Chat Seguridad",     icon: "💬", exact: false, roles: ["administrador", "propietario", "portero"],         modulo: "chat" },
      { href: "/dashboard/guardias", label: "Guardias / Turnos",  icon: "👮", exact: false, roles: ["administrador", "portero"],                        modulo: "guardias" },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/dashboard/reportes", label: "Reportes", icon: "📈", exact: false, roles: ["administrador"], modulo: "reportes" },
    ],
  },
  {
    label: "Mi Cuenta",
    items: [
      { href: "/dashboard/perfil", label: "Mi Perfil", icon: "👤", exact: false, roles: ["superadmin","administrador","propietario","inquilino","portero","servicios"] },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const ROL_LABELS: Record<string, string> = {
  superadmin:    "Super Administrador",
  administrador: "Administrador",
  propietario:   "Propietario",
  inquilino:     "Inquilino",
  portero:       "Portero / Seguridad",
  servicios:     "Servicios Generales",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [user, setUser]                     = useState<AuthUser | null>(null);
  const [activeModules, setActiveModules]   = useState<string[]>([]);
  const [edificios, setEdificios]           = useState<{ id: number; nombre: string }[]>([]);
  const [showSwitcher, setShowSwitcher]     = useState(false);
  const [switching, setSwitching]           = useState(false);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const switcherRef                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);

    // Load active modules for this building (skip for superadmin — they see all)
    if (u.rol !== "superadmin" && u.edificio_id) {
      api.edificios.getModulos(u.edificio_id)
        .then((data) => {
          const claves = data.modulos
            .filter((m: any) => m.activo)
            .map((m: any) => m.clave);
          setActiveModules(claves);
        })
        .catch(() => {
          // On error, show all modules (fail-open for better UX)
          setActiveModules(["finanzas","mantenimiento","comunicados","zonas_comunes","accesos","paquetes","chat","guardias","reportes"]);
        });
    }

    // Load available buildings for switcher
    authApi.misEdificios()
      .then((data) => setEdificios(data.edificios))
      .catch(() => {});
  }, [router]);

  // Close switcher on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const visibleGroups = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (!user) return false;
        if (!item.roles.includes(user.rol)) return false;
        // Superadmin and items without a module requirement are always visible
        if (!item.modulo || user.rol === "superadmin") return true;
        return activeModules.includes(item.modulo);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const currentLabel = ALL_ITEMS.find((i) => isActive(i))?.label ?? "Dashboard";

  const initials = user?.nombre
    ? user.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "…";

  const edificioNombre = user?.edificio_id
    ? edificios.find((e) => e.id === user.edificio_id)?.nombre ?? "Cargando…"
    : user?.rol === "superadmin" ? "Todos los edificios" : "—";

  const isSuperAdmin = user?.rol === "superadmin";
  // SA always can switch (they need the "Todos" option); others need >1 building
  const canSwitch = isSuperAdmin || edificios.length > 1;

  function handleNavClick() {
    setSidebarOpen(false);
  }

  async function handleSwitchBuilding(edificioId: number) {
    if (!user) return;
    setSwitching(true);
    setShowSwitcher(false);
    try {
      const data = await authApi.seleccionarEdificio(parseInt(user.sub), edificioId);
      setToken(data.access_token);
      window.location.href = "/dashboard";
    } catch {
      setSwitching(false);
    }
  }

  async function handleSwitchToTodos() {
    setSwitching(true);
    setShowSwitcher(false);
    try {
      const data = await authApi.seleccionarTodos();
      setToken(data.access_token);
      window.location.href = "/dashboard/superadmin";
    } catch {
      setSwitching(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-primary flex flex-col flex-shrink-0
        transform transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3" onClick={handleNavClick}>
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
        <div className="px-4 py-3 border-b border-white/10" ref={switcherRef}>
          <button
            onClick={() => canSwitch && setShowSwitcher((v) => !v)}
            disabled={switching || !canSwitch}
            className={`w-full bg-white/10 rounded-lg px-3 py-2 text-left transition-colors ${canSwitch ? "hover:bg-white/20 cursor-pointer" : "cursor-default"}`}
          >
            <div className="text-blue-300 text-xs mb-0.5">Edificio activo</div>
            <div className="text-white text-sm font-medium flex items-center justify-between">
              <span className="truncate">
                {switching ? "Cambiando…" : edificioNombre}
              </span>
              {canSwitch && (
                <span className={`text-blue-300 text-xs ml-2 transition-transform ${showSwitcher ? "rotate-180" : ""}`}>▼</span>
              )}
            </div>
          </button>

          {showSwitcher && (
            <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
              {isSuperAdmin && (
                <button
                  onClick={handleSwitchToTodos}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                    !user?.edificio_id ? "font-semibold text-primary bg-blue-50" : "text-gray-700"
                  }`}
                >
                  <span>🌐</span>
                  <span className="truncate">Todos los edificios</span>
                  {!user?.edificio_id && <span className="ml-auto text-primary text-xs">✓</span>}
                </button>
              )}
              {edificios.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSwitchBuilding(e.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                    e.id === user?.edificio_id ? "font-semibold text-primary bg-blue-50" : "text-gray-700"
                  }`}
                >
                  <span>🏢</span>
                  <span className="truncate">{e.nombre}</span>
                  {e.id === user?.edificio_id && <span className="ml-auto text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
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
                    onClick={handleNavClick}
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger button — mobile only */}
            <button
              className="lg:hidden p-2 -ml-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-gray-900">{currentLabel}</h1>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString("es-CO", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Notificaciones"
            >
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <Link
              href="/"
              className="hidden sm:block text-sm text-gray-500 hover:text-primary transition-colors font-medium"
            >
              ← Ir al sitio
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
