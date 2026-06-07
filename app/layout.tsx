import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mientras Tanto",
  description: "Revista familiar mensual hecha con pequeñas escenas de la vida cotidiana."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
