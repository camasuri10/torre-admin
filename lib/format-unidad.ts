/** Etiqueta de unidad con torre completa (nombre + número). */
export function formatUnidadLabel(u: {
  numero: string;
  piso?: number | null;
  torre_nombre?: string | null;
  torre?: string | null;
  torre_numero?: string | null;
}): string {
  const torreNombre = u.torre_nombre ?? u.torre ?? "";
  const torre = [torreNombre, u.torre_numero].filter(Boolean).join(" ").trim();
  const parts: string[] = [];
  if (torre) parts.push(torre);
  parts.push(u.numero);
  if (u.piso != null) parts.push(`Piso ${u.piso}`);
  return parts.join(" · ");
}
