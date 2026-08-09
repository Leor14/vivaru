import type { Metadata } from "next";

/**
 * Las pantallas de acceso no se indexan.
 *
 * `robots.txt` ya las bloquea, pero eso solo le pide al rastreador que no las
 * visite: si alguien enlaza una desde fuera, Google puede indexarla igual. La
 * etiqueta es la que lo impide de verdad, así que van las dos.
 *
 * `/registro` es la excepción y la anula en su propio layout: es la página de
 * conversión de la prueba gratuita y sí interesa que se encuentre.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen w-full items-center justify-center p-4 md:p-8">{children}</main>;
}
