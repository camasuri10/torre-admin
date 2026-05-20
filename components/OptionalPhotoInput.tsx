"use client";

import { useRef, useState } from "react";

type Props = {
  onFileChange: (file: File | null) => void;
  label?: string;
  className?: string;
};

export default function OptionalPhotoInput({
  onFileChange,
  label = "Foto (opcional)",
  className = "",
}: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function applyFile(file: File | null) {
    if (!file) {
      setPreview(null);
      setFileName(null);
      onFileChange(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onFileChange(file);
  }

  function clear() {
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    applyFile(null);
  }

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          📷 Tomar foto
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          📎 Adjuntar
        </button>
        {(preview || fileName) && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            ✕ Quitar
          </button>
        )}
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />
      {preview && (
        <img
          src={preview}
          alt="Vista previa"
          className="mt-2 h-24 w-auto max-w-full rounded-lg border border-gray-200 object-cover"
        />
      )}
      {fileName && !preview && (
        <p className="mt-1 text-xs text-green-600">✓ {fileName}</p>
      )}
    </div>
  );
}
