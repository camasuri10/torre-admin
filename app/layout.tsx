import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TorreAdmin – Gestión de Propiedad Horizontal",
  description:
    "Plataforma SaaS para la administración eficiente de conjuntos residenciales y edificios en Latinoamérica.",
  keywords: "propiedad horizontal, administración, conjuntos residenciales, Colombia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
