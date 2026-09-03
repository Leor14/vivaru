import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import { Providers } from "@/app/providers";
import { EnvironmentBanner } from "@/components/shared/environment-banner";
import { isProduction } from "@/lib/env";
import { GUION_ANTI_DESTELLO } from "@/lib/ui/tema";
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
    // `suppressHydrationWarning` porque el guion de abajo pone `data-tema` ANTES
    // de que React hidrate: el servidor no puede saber que tema tiene este
    // navegador, asi que el atributo diverge a proposito y solo en la raiz.
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Bloqueante y antes de pintar. Lee el espejo de `localStorage` para que
            el PRIMER fotograma ya salga en el tema correcto. En la primera visita
            desde un dispositivo el espejo esta vacio y se pinta claro: eso no es
            un defecto, es la unica secuencia posible — el tema canonico vive en
            Firestore y no se puede leer antes de resolver la sesion. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_ANTI_DESTELLO }} />
      </head>
      <body className={`${manrope.variable} ${playfairDisplay.variable} antialiased`}>
        <EnvironmentBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
