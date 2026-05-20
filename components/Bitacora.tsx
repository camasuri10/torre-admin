"use client"

interface BitacoraEvento {
  id: number
  evento: string
  descripcion?: string
  estado_anterior?: string
  estado_nuevo?: string
  observacion?: string
  usuario_nombre?: string
  created_at: string
}

interface BitacoraProps {
  eventos: BitacoraEvento[]
  loading?: boolean
}

const EVENTO_COLORS: Record<string, string> = {
  cambio_estado: "bg-blue-100 text-blue-700",
  archivo_subido: "bg-green-100 text-green-700",
  hijo_creado: "bg-purple-100 text-purple-700",
  creacion: "bg-gray-100 text-gray-600",
  comentario: "bg-yellow-100 text-yellow-700",
}

const EVENTO_LABELS: Record<string, string> = {
  cambio_estado: "Cambio de estado",
  archivo_subido: "Archivo subido",
  hijo_creado: "Instancia creada",
  creacion: "Creación",
  comentario: "Comentario",
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function Bitacora({ eventos, loading }: BitacoraProps) {
  if (loading) {
    return <p className="text-sm text-gray-400 py-2">Cargando historial...</p>
  }

  if (!eventos || eventos.length === 0) {
    return <p className="text-sm text-gray-400 py-2">Sin eventos registrados.</p>
  }

  return (
    <ol className="relative border-l border-gray-200 space-y-4 pl-4">
      {eventos.map((ev) => {
        const colorClass = EVENTO_COLORS[ev.evento] ?? "bg-gray-100 text-gray-600"
        const label = EVENTO_LABELS[ev.evento] ?? ev.evento

        return (
          <li key={ev.id} className="relative">
            <div className="absolute -left-[22px] w-3 h-3 rounded-full border-2 border-white bg-gray-300 top-1" />
            <div className="flex items-start gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${colorClass}`}>
                {label}
              </span>
              {ev.estado_anterior && ev.estado_nuevo && (
                <span className="text-xs text-gray-500">
                  {ev.estado_anterior} → {ev.estado_nuevo}
                </span>
              )}
            </div>
            {(ev.descripcion || ev.observacion) && (
              <p className="text-sm text-gray-600 mt-1">
                {ev.descripcion ?? ev.observacion}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {ev.usuario_nombre && <span>{ev.usuario_nombre} · </span>}
              {formatDate(ev.created_at)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
