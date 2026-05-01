"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { superadminApi } from "@/lib/api";

interface Modulo {
  clave: string;
  nombre: string;
  icono: string;
  activo: boolean;
}

export default function EdificioModulosPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const edificioId = parseInt(id);

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (!user || user.rol !== "superadmin") { router.replace("/dashboard"); return; }

    superadminApi.edificios.getModulos(edificioId)
      .then((data) => {
        setModulos(data.modulos);
        // Get building name from list
        return superadminApi.edificios.list();
      })
      .then((data) => {
        const ed = data.edificios.find((e: any) => e.id === edificioId);
        if (ed) setNombre(ed.nombre);
      })
      .catch(() => setError("Error al cargar datos del edificio"))
      .finally(() => setLoading(false));
  }, [router, edificioId]);

  function toggleModulo(clave: string) {
    setModulos((prev) =>
      prev.map((m) => m.clave === clave ? { ...m, activo: !m.activo } : m)
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await superadminApi.edificios.updateModulos(
        edificioId,
        modulos.map((m) => ({ clave: m.clave, activo: m.activo }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Error al guardar los módulos");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  const activos = modulos.filter((m) => m.activo).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/superadmin/edificios" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
          ← Edificios
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">{nombre || `Edificio #${edificioId}`}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {activos} de {modulos.length} módulos activos
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Módulos disponibles</h3>
        <div className="space-y-3">
          {modulos.map((m) => (
            <label
              key={m.clave}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{m.icono}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{m.nombre}</div>
                  <div className="text-xs text-gray-400">{m.clave}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleModulo(m.clave)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  m.activo ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    m.activo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-red-600 text-xs">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-medium">✓ Guardado correctamente</span>
          )}
        </div>
      </div>
    </div>
  );
}
