"use client";

import { useCallback, useEffect, useState } from "react";
import { getUser } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
function token() { return localStorage.getItem("torre_auth_token") ?? ""; }
const authHdr = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const TIPO_LABEL: Record<string, string> = {
  familiar: "Familiar",
  aseo: "Personal de aseo",
  otro: "Otro",
};

const TIPO_ICON: Record<string, string> = {
  familiar: "👨‍👩‍👧", aseo: "🧹", otro: "👤",
};

const ESPECIE_ICON: Record<string, string> = {
  perro: "🐕", gato: "🐈", ave: "🦜", otro: "🐾",
};

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function MiAptoPage() {
  const user = getUser();
  const usuarioId = user?.sub ? parseInt(user.sub) : null;

  const [tab, setTab] = useState<"hogar" | "autorizados" | "mascotas" | "vehiculos">("hogar");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Unidad activa (para propietarios con múltiples unidades)
  const [selectedUnidadId, setSelectedUnidadId] = useState<number | null>(null);

  // Convivientes
  const [showAddConviviente, setShowAddConviviente] = useState(false);
  const [savingConviviente, setSavingConviviente] = useState(false);

  // Mascotas
  const [showAddMascota, setShowAddMascota] = useState(false);
  const [savingMascota, setSavingMascota] = useState(false);
  const [editMascota, setEditMascota] = useState<any>(null);

  // Vehículos
  const [showAddVehiculo, setShowAddVehiculo] = useState(false);
  const [savingVehiculo, setSavingVehiculo] = useState(false);
  const [editVehiculo, setEditVehiculo] = useState<any>(null);

  // Personas autorizadas
  const [showAddAutorizado, setShowAddAutorizado] = useState(false);
  const [savingAutorizado, setSavingAutorizado] = useState(false);
  const [editAutorizado, setEditAutorizado] = useState<any>(null);

  const load = useCallback(async () => {
    if (!usuarioId) { setLoading(false); setError("No se encontró tu sesión. Inicia sesión nuevamente."); return; }
    setLoading(true);
    setError(null);
    try {
      let url = `${BASE}/api/usuarios/mi-apto?usuario_id=${usuarioId}`;
      if (selectedUnidadId) url += `&unidad_id=${selectedUnidadId}`;
      const res = await fetch(url, { headers: authHdr() });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Si no hay unidad seleccionada, inicializar con la primera
        if (!selectedUnidadId && json.ocupaciones?.length > 0) {
          setSelectedUnidadId(json.ocupaciones[0].unidad_id);
        }
      } else {
        const text = await res.text().catch(() => "");
        setError(`Error ${res.status}: ${text || "No se pudo cargar la información del apartamento."}`);
      }
    } catch (e: any) {
      setError("Error de conexión. Verifica tu red e intenta de nuevo.");
    } finally { setLoading(false); }
  }, [usuarioId, selectedUnidadId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>;
  if (error) return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-gray-600 font-medium">No se pudo cargar tu apartamento</p>
      <p className="text-sm text-gray-400 mt-1">{error}</p>
      <button onClick={load} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
        Reintentar
      </button>
    </div>
  );
  if (!data) return null;

  const ocupaciones: any[] = data.ocupaciones ?? [];
  const ocupacionActiva = ocupaciones.find((o: any) => o.unidad_id === selectedUnidadId) ?? ocupaciones[0];
  const unidadId = ocupacionActiva?.unidad_id;
  const unidadNum = ocupacionActiva?.unidad_numero;
  const torre = ocupacionActiva?.torre_nombre;

  async function handleSaveMascota(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuarioId) return;
    setSavingMascota(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      usuario_id: usuarioId,
      nombre: fd.get("nombre"),
      especie: fd.get("especie"),
      raza: fd.get("raza") || null,
      color: fd.get("color") || null,
    };
    try {
      if (editMascota) {
        await fetch(`${BASE}/api/mascotas/${editMascota.id}`, { method: "PUT", headers: authHdr(), body: JSON.stringify(body) });
      } else {
        await fetch(`${BASE}/api/mascotas`, { method: "POST", headers: authHdr(), body: JSON.stringify(body) });
      }
      setShowAddMascota(false); setEditMascota(null);
      (e.target as HTMLFormElement).reset();
      load();
    } finally { setSavingMascota(false); }
  }

  async function handleDeleteMascota(id: number) {
    if (!confirm("¿Eliminar mascota?")) return;
    await fetch(`${BASE}/api/mascotas/${id}`, { method: "DELETE", headers: authHdr() });
    load();
  }

  async function handleSaveVehiculo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuarioId) return;
    setSavingVehiculo(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      usuario_id: usuarioId,
      placa: (fd.get("placa") as string)?.toUpperCase(),
      tipo: fd.get("tipo"),
      marca: fd.get("marca") || null,
      modelo: fd.get("modelo") || null,
      color: fd.get("color") || null,
      combustible: fd.get("combustible") || null,
    };
    try {
      if (editVehiculo) {
        await fetch(`${BASE}/api/vehiculos/${editVehiculo.id}`, { method: "PUT", headers: authHdr(), body: JSON.stringify(body) });
      } else {
        await fetch(`${BASE}/api/vehiculos`, { method: "POST", headers: authHdr(), body: JSON.stringify(body) });
      }
      setShowAddVehiculo(false); setEditVehiculo(null);
      (e.target as HTMLFormElement).reset();
      load();
    } finally { setSavingVehiculo(false); }
  }

  async function handleDeleteVehiculo(id: number) {
    if (!confirm("¿Eliminar vehículo?")) return;
    await fetch(`${BASE}/api/vehiculos/${id}`, { method: "DELETE", headers: authHdr() });
    load();
  }

  async function handleAddConviviente(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!unidadId || !usuarioId) return;
    setSavingConviviente(true);
    const fd = new FormData(e.currentTarget);
    const conjuntoId = ocupacionActiva?.conjunto_id;
    try {
      const userRes = await fetch(`${BASE}/api/usuarios`, {
        method: "POST",
        headers: authHdr(),
        body: JSON.stringify({
          nombre: fd.get("nombre"),
          cedula: fd.get("cedula") || null,
          telefono: fd.get("telefono") || null,
          email: fd.get("email") || null,
          rol: fd.get("tipo") as string,
          conjunto_id: conjuntoId || null,
        }),
      });
      if (!userRes.ok) { alert("Error al registrar la persona. Verifica los datos."); return; }
      const newUser = await userRes.json();
      await fetch(`${BASE}/api/usuarios/ocupaciones`, {
        method: "POST",
        headers: authHdr(),
        body: JSON.stringify({
          unidad_id: unidadId,
          usuario_id: newUser.id,
          tipo: fd.get("tipo"),
          fecha_inicio: new Date().toISOString().slice(0, 10),
        }),
      });
      setShowAddConviviente(false);
      (e.target as HTMLFormElement).reset();
      load();
    } finally { setSavingConviviente(false); }
  }

  async function handleRemoveConviviente(ocupacionId: number, nombre: string) {
    if (!confirm(`¿Quitar a ${nombre} de esta unidad?`)) return;
    await fetch(`${BASE}/api/usuarios/ocupaciones/${ocupacionId}`, {
      method: "DELETE",
      headers: authHdr(),
    });
    load();
  }

  async function handleSaveAutorizado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!unidadId) return;
    setSavingAutorizado(true);
    const fd = new FormData(e.currentTarget);
    const body: any = {
      unidad_id: unidadId,
      nombre: fd.get("nombre"),
      cedula: fd.get("cedula") || null,
      telefono: fd.get("telefono") || null,
      tipo: fd.get("tipo"),
    };
    try {
      if (editAutorizado) {
        await fetch(`${BASE}/api/personas-autorizadas/${editAutorizado.id}`, { method: "PUT", headers: authHdr(), body: JSON.stringify(body) });
      } else {
        await fetch(`${BASE}/api/personas-autorizadas`, { method: "POST", headers: authHdr(), body: JSON.stringify(body) });
      }
      setShowAddAutorizado(false); setEditAutorizado(null);
      (e.target as HTMLFormElement).reset();
      load();
    } finally { setSavingAutorizado(false); }
  }

  async function handleDeleteAutorizado(id: number) {
    if (!confirm("¿Eliminar persona autorizada?")) return;
    await fetch(`${BASE}/api/personas-autorizadas/${id}`, { method: "DELETE", headers: authHdr() });
    load();
  }

  const TABS = [
    { key: "hogar",       label: `🏠 Mi Hogar` },
    { key: "autorizados", label: `🔑 Personal Autorizado (${data.personas_autorizadas?.length ?? 0})` },
    { key: "mascotas",    label: `🐾 Mascotas (${data.mascotas?.length ?? 0})` },
    { key: "vehiculos",   label: `🚗 Vehículos (${data.vehiculos?.length ?? 0})` },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mi Apartamento</h2>
          {unidadNum && (
            <p className="text-sm text-gray-500 mt-0.5">
              Apto {unidadNum}{torre ? ` — ${torre}` : ""}
              {ocupacionActiva?.conjunto_nombre ? ` · ${ocupacionActiva.conjunto_nombre}` : ""}
            </p>
          )}
        </div>
        {/* Selector de unidad cuando el propietario tiene más de una */}
        {ocupaciones.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cambiar unidad</label>
            <select
              value={selectedUnidadId ?? ""}
              onChange={(e) => setSelectedUnidadId(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ocupaciones.map((o: any) => (
                <option key={o.unidad_id} value={o.unidad_id}>
                  Apto {o.unidad_numero}{o.torre_nombre ? ` — ${o.torre_nombre}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Mi Hogar ── */}
      {tab === "hogar" && (
        <div className="space-y-4">
          {/* Info de la unidad activa */}
          {ocupacionActiva && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Mi unidad</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-xs text-gray-400">Apto / Unidad</span>
                  <div className="font-medium">{ocupacionActiva.unidad_numero}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Torre</span>
                  <div className="font-medium">{ocupacionActiva.torre_nombre ?? "—"}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Tipo</span>
                  <div className="font-medium capitalize">{ocupacionActiva.tipo}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Conjunto</span>
                  <div className="font-medium">{ocupacionActiva.conjunto_nombre ?? "—"}</div>
                </div>
              </div>
              {/* Listado de todas las unidades si tiene más de una */}
              {ocupaciones.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Todas mis unidades</p>
                  <div className="flex flex-wrap gap-2">
                    {ocupaciones.map((o: any) => (
                      <button
                        key={o.unidad_id}
                        onClick={() => setSelectedUnidadId(o.unidad_id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          o.unidad_id === selectedUnidadId
                            ? "bg-primary text-white border-primary"
                            : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
                        }`}
                      >
                        Apto {o.unidad_numero}{o.torre_nombre ? ` · ${o.torre_nombre}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cohabitantes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Personas que viven en el apto</h3>
              <button
                onClick={() => setShowAddConviviente(true)}
                className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                + Agregar
              </button>
            </div>
            {data.cohabitantes?.length === 0 ? (
              <p className="text-sm text-gray-400">No hay otras personas registradas en tu unidad.</p>
            ) : (
              <div className="space-y-2">
                {data.cohabitantes?.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {c.nombre[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{c.nombre}</div>
                      <div className="text-xs text-gray-400 capitalize">
                        {c.tipo}{c.telefono ? ` · ${c.telefono}` : ""}{c.email ? ` · ${c.email}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveConviviente(c.ocupacion_id, c.nombre)}
                      className="text-xs text-gray-300 hover:text-red-400 px-1"
                      title="Quitar de esta unidad"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal agregar conviviente */}
          {showAddConviviente && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Agregar persona al apto</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Registra a alguien que vive contigo. Podrá tener acceso al sistema con su propia cuenta.
                </p>
                <form onSubmit={handleAddConviviente} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                    <input name="nombre" required className={INPUT} placeholder="Ej: María García" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Relación / Tipo</label>
                    <select name="tipo" defaultValue="inquilino" className={INPUT}>
                      <option value="propietario">Propietario</option>
                      <option value="inquilino">Familiar / Inquilino</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cédula</label>
                      <input name="cedula" className={INPUT} placeholder="Opcional" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                      <input name="telefono" className={INPUT} placeholder="Opcional" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input name="email" type="email" className={INPUT} placeholder="Opcional — para acceso al sistema" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setShowAddConviviente(false)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                    <button type="submit" disabled={savingConviviente}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                      {savingConviviente ? "Registrando…" : "Registrar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Personal Autorizado ── */}
      {tab === "autorizados" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Personal autorizado para acceder a tu unidad (portería podrá verlos como visitas autorizadas).
            </p>
            <button onClick={() => { setEditAutorizado(null); setShowAddAutorizado(true); }}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 shrink-0">
              + Agregar
            </button>
          </div>

          {data.personas_autorizadas?.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">🔑</div>
              <p>No hay personas autorizadas registradas</p>
              <p className="text-xs mt-1">Agrega personal de aseo, familiares frecuentes u otros autorizados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.personas_autorizadas?.map((p: any) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{TIPO_ICON[p.tipo] ?? "👤"}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{p.nombre}</p>
                        <p className="text-xs text-gray-500">{TIPO_LABEL[p.tipo] ?? p.tipo}</p>
                        {p.cedula && <p className="text-xs text-gray-400">CC: {p.cedula}</p>}
                        {p.telefono && <p className="text-xs text-gray-400">📞 {p.telefono}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditAutorizado(p); setShowAddAutorizado(true); }}
                        className="text-xs text-gray-400 hover:text-primary px-2 py-1 rounded hover:bg-gray-50">✏️</button>
                      <button onClick={() => handleDeleteAutorizado(p.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-50">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddAutorizado && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {editAutorizado ? "Editar persona" : "Agregar persona autorizada"}
                </h3>
                <form onSubmit={handleSaveAutorizado} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                    <input name="nombre" required defaultValue={editAutorizado?.nombre ?? ""} className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                    <select name="tipo" defaultValue={editAutorizado?.tipo ?? "aseo"} className={INPUT}>
                      <option value="aseo">Personal de aseo</option>
                      <option value="familiar">Familiar</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cédula</label>
                      <input name="cedula" defaultValue={editAutorizado?.cedula ?? ""} className={INPUT} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                      <input name="telefono" defaultValue={editAutorizado?.telefono ?? ""} className={INPUT} />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => { setShowAddAutorizado(false); setEditAutorizado(null); }}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                    <button type="submit" disabled={savingAutorizado}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                      {savingAutorizado ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mascotas ── */}
      {tab === "mascotas" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditMascota(null); setShowAddMascota(true); }}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
              + Agregar mascota
            </button>
          </div>
          {data.mascotas?.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">🐾</div>
              <p>No tienes mascotas registradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.mascotas?.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ESPECIE_ICON[m.especie] ?? "🐾"}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{m.nombre}</p>
                        <p className="text-xs text-gray-500 capitalize">{m.especie} {m.raza ? `· ${m.raza}` : ""}</p>
                        {m.color && <p className="text-xs text-gray-400">{m.color}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditMascota(m); setShowAddMascota(true); }}
                        className="text-xs text-gray-400 hover:text-primary px-2 py-1 rounded hover:bg-gray-50">✏️</button>
                      <button onClick={() => handleDeleteMascota(m.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-50">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddMascota && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{editMascota ? "Editar mascota" : "Nueva mascota"}</h3>
                <form onSubmit={handleSaveMascota} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                    <input name="nombre" required defaultValue={editMascota?.nombre ?? ""} className={INPUT} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Especie</label>
                      <select name="especie" defaultValue={editMascota?.especie ?? "perro"} className={INPUT}>
                        <option value="perro">Perro</option>
                        <option value="gato">Gato</option>
                        <option value="ave">Ave</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Raza</label>
                      <input name="raza" defaultValue={editMascota?.raza ?? ""} className={INPUT} placeholder="Opcional" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                    <input name="color" defaultValue={editMascota?.color ?? ""} className={INPUT} placeholder="Opcional" />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => { setShowAddMascota(false); setEditMascota(null); }}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                    <button type="submit" disabled={savingMascota}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                      {savingMascota ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vehículos ── */}
      {tab === "vehiculos" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditVehiculo(null); setShowAddVehiculo(true); }}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
              + Agregar vehículo
            </button>
          </div>
          {data.vehiculos?.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">🚗</div>
              <p>No tienes vehículos registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.vehiculos?.map((v: any) => (
                <div key={v.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-primary text-base tracking-wider">{v.placa}</span>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">
                        {v.tipo} {v.marca ? `· ${v.marca}` : ""} {v.modelo ? `${v.modelo}` : ""}
                      </p>
                      {v.color && <p className="text-xs text-gray-400">{v.color}</p>}
                      {v.combustible && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize mt-1 inline-block">
                          {v.combustible}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditVehiculo(v); setShowAddVehiculo(true); }}
                        className="text-xs text-gray-400 hover:text-primary px-2 py-1 rounded hover:bg-gray-50">✏️</button>
                      <button onClick={() => handleDeleteVehiculo(v.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-50">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddVehiculo && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{editVehiculo ? "Editar vehículo" : "Nuevo vehículo"}</h3>
                <form onSubmit={handleSaveVehiculo} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Placa *</label>
                      <input name="placa" required defaultValue={editVehiculo?.placa ?? ""} className={INPUT}
                        style={{ textTransform: "uppercase" }} placeholder="ABC123" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                      <select name="tipo" defaultValue={editVehiculo?.tipo ?? "carro"} className={INPUT}>
                        <option value="carro">Carro</option>
                        <option value="moto">Moto</option>
                        <option value="bicicleta">Bicicleta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                      <input name="marca" defaultValue={editVehiculo?.marca ?? ""} className={INPUT} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
                      <input name="modelo" defaultValue={editVehiculo?.modelo ?? ""} className={INPUT} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                      <input name="color" defaultValue={editVehiculo?.color ?? ""} className={INPUT} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Combustible</label>
                      <select name="combustible" defaultValue={editVehiculo?.combustible ?? "gasolina"} className={INPUT}>
                        <option value="gasolina">Gasolina</option>
                        <option value="electrico">Eléctrico</option>
                        <option value="hibrido">Híbrido</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => { setShowAddVehiculo(false); setEditVehiculo(null); }}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
                    <button type="submit" disabled={savingVehiculo}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">
                      {savingVehiculo ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
