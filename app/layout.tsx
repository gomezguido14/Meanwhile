import type { Metadata, Viewport } from "next";
import { Inter, Lora, Caveat, Special_Elite, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-hand" });
const specialElite = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-typewriter" });
const cormorant = Cormorant_Garamond({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-cormorant" });

export const viewport: Viewport = {
  themeColor: "#f3eadb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Mientras Tanto",
  description: "Revista familiar mensual hecha con pequeñas escenas de la vida cotidiana.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mientras Tanto",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${lora.variable} ${caveat.variable} ${specialElite.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
