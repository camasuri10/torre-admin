"use client"
import { useState, useRef } from "react"

interface Archivo {
  id?: number
  url: string
  nombre_archivo?: string
  nombre?: string
  tipo?: string
}

interface FileUploadGenericoProps {
  endpoint: string
  archivos: Archivo[]
  onUploaded: () => void
  label?: string
  multiple?: boolean
  disabled?: boolean
  extraFields?: Record<string, string | number>
}

export default function FileUploadGenerico({
  endpoint,
  archivos,
  onUploaded,
  label = "Subir archivo",
  multiple = false,
  disabled = false,
  extraFields = {},
}: FileUploadGenericoProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)

    const API = process.env.NEXT_PUBLIC_API_URL || ""

    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("nombre_archivo", file.name)
      fd.append("tipo", "otro")
      for (const [k, v] of Object.entries(extraFields)) {
        fd.append(k, String(v))
      }

      try {
        const res = await fetch(`${API}${endpoint}`, { method: "POST", body: fd })
        if (!res.ok) throw new Error(await res.text())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al subir")
        break
      }
    }

    setUploading(false)
    onUploaded()
    if (inputRef.current) inputRef.current.value = ""
  }

  function getDisplayName(a: Archivo) {
    return a.nombre_archivo || a.nombre || "Archivo"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : label}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {archivos.length > 0 && (
        <ul className="space-y-1">
          {archivos.map((a, i) => (
            <li key={a.id ?? i} className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">📎</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-xs"
              >
                {getDisplayName(a)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
