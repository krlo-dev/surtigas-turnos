import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Surtigas Turnos", template: "%s · Surtigas Turnos" },
  description: "Gestión inteligente de turnos y recursos para las oficinas de Surtigas (prototipo con datos simulados).",
};

export const viewport: Viewport = { themeColor: "#E9ECEF", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
