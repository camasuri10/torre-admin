"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

const ROL_LABEL: Record<string, string> = {
  superadmin: "Super Administrador",
  administrador: "Administrador",
  propietario: "Propietario",
  inquilino: "Inquilino",
  portero: "Portero",
  servicios: "Servicios Generales",
};

interface NotifPrefs {
  notif_sistema: boolean;
  notif_email: boolean;
  notif_whatsapp: boolean;
}

export default function PerfilPage() {
  const jwtUser = getUser();
  const userId = jwtUser ? parseInt(jwtUser.sub) : null;

  const [perfil, setPerfil] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notif, setNotif] = useState<NotifPrefs>({
    notif_sistema: true,
    notif_email: false,
    notif_whatsapp: false,
  });

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.usuarios.get(userId)
      .then((u) => {
        setPerfil(u);
        setNotif({
          notif_sistema: u.notif_sistema ?? true,
          notif_email: u.notif_email ?? false,
          notif_whatsapp: u.notif_whatsapp ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSaveNotif = async () => {
    if (!userId) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.usuarios.update(userId, notif);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando…</div>;
  }

  const displayName = perfil?.nombre ?? jwtUser?.nombre ?? "—";
  const displayEmail = perfil?.email ?? jwtUser?.email ?? "—";
  const displayRol = perfil?.rol ?? jwtUser?.rol ?? "—";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Mi cuenta</h2>
        <p className="text-sm text-gray-500 mt-0.5">Información de tu perfil y preferencias</p>
      </div>

      {/* Perfil info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Información personal</h3>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{displayName}</div>
            <div className="text-sm text-gray-500">{displayEmail}</div>
            <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {ROL_LABEL[displayRol] ?? displayRol}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-50">
          {perfil?.edificio_nombre && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Edificio / Torre</div>
              <div className="font-medium text-gray-800">{perfil.edificio_nombre}</div>
            </div>
          )}
          {perfil?.unidad_numero && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Unidad</div>
              <div className="font-medium text-gray-800">Apto {perfil.unidad_numero}</div>
            </div>
          )}
          {perfil?.telefono && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Teléfono</div>
              <div className="font-medium text-gray-800">{perfil.telefono}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-400 mb-0.5">ID de usuario</div>
            <div className="font-mono text-xs text-gray-500">#{userId}</div>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Preferencias de notificación</h3>
          <p className="text-xs text-gray-400 mt-0.5">Elige cómo quieres recibir notificaciones del edificio</p>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Notificaciones en el sistema"
            description="Alertas y avisos dentro de la plataforma TorreAdmin"
            emoji="🔔"
            checked={notif.notif_sistema}
            onChange={(v) => setNotif({ ...notif, notif_sistema: v })}
          />
          <ToggleRow
            label="Notificaciones por correo"
            description="Recibe resúmenes y avisos en tu correo electrónico"
            emoji="📧"
            checked={notif.notif_email}
            onChange={(v) => setNotif({ ...notif, notif_email: v })}
          />
          <ToggleRow
            label="Notificaciones por WhatsApp"
            description="Mensajes directos al número registrado en tu perfil"
            emoji="💬"
            checked={notif.notif_whatsapp}
            onChange={(v) => setNotif({ ...notif, notif_whatsapp: v })}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          {saved ? (
            <span className="text-sm text-green-600 font-medium">✓ Preferencias guardadas</span>
          ) : (
            <span className="text-xs text-gray-400">Los cambios se aplican inmediatamente</span>
          )}
          <button
            onClick={handleSaveNotif}
            disabled={saving}
            className="bg-primary text-white text-sm px-5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? "Guardando…" : "Guardar preferencias"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label, description, emoji, checked, onChange,
}: {
  label: string;
  description: string;
  emoji: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="text-xl">{emoji}</span>
        <div>
          <div className="text-sm font-medium text-gray-800">{label}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-primary" : "bg-gray-300"}`}
        role="switch"
        aria-checked={checked}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
