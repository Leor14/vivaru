import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import { Providers } from "@/app/providers";
import { EnvironmentBanner } from "@/components/shared/environment-banner";
import { isProduction } from "@/lib/env";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vivaru | Administración de Propiedad Horizontal",
  description: "Plataforma multi-tenant para administración de edificios y conjuntos residenciales.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  // Fuera de producción, ninguna página es indexable — incluido el landing, que
  // en staging sirve el mismo código (ver docs/plan-self-service-trial.md §13).
  ...(isProduction ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${playfairDisplay.variable} antialiased`}>
        <EnvironmentBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
