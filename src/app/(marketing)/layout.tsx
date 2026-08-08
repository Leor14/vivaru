import type { Metadata } from 'next';
import { AnalyticsProvider } from '@/components/marketing/providers/AnalyticsProvider';
import { CookieBannerLoader } from '@/components/marketing/CookieBannerLoader';
import { DatosEstructurados } from '@/components/marketing/DatosEstructurados';
import { URL_SITIO } from '@/lib/marketing/sitio';

/**
 * Metadata del landing — reescrita tras la auditoría de agosto de 2026
 * (`docs/auditoria-seo-y-llm.md`).
 *
 * Qué había y por qué no funcionaba: el título era
 * «Vivaru — Control residencial, vida más simple.» Gastaba el espacio más
 * valioso del sitio en la marca, que es justo lo único por lo que ya se
 * posicionaba, y seguía con una frase que nadie escribe en un buscador. El
 * cuerpo del landing tenía 1.264 palabras y `software` aparecía CERO veces,
 * `propiedad horizontal` CERO, `México` CERO.
 *
 * Ahora la categoría va primero y la marca al final, que es el orden que Google
 * recorta mejor y el que responde a la consulta.
 */
export const metadata: Metadata = {
  title: 'Software de administración de condominios en México | Vivaru',
  description:
    'Software para administrar condominios, conjuntos residenciales y fraccionamientos: cartera, cuotas, reservas, visitantes y PQRS en un solo lugar.',
  // Con `www`. El apex `grupovivaru.com` devuelve 404 —App Hosting solo tiene
  // configurado el subdominio—, así que apuntar aquí al dominio raíz hacía que
  // todas las URL absolutas de Open Graph y canónicas señalaran a un 404.
  metadataBase: new URL(URL_SITIO),
  alternates: { canonical: '/mx' },
  openGraph: {
    title: 'Software de administración de condominios y conjuntos | Vivaru',
    description:
      'Cartera, cuotas de mantenimiento, reservas, visitantes con QR y PQRS. Cada conjunto opera aislado, con sus propios datos y accesos.',
    type: 'website',
    locale: 'es_MX',
    siteName: 'Vivaru',
    url: '/mx',
    images: [
      {
        url: '/og-vivaru.jpg',
        width: 1200,
        height: 630,
        alt: 'Centro de control de Vivaru: cartera, recaudo y alertas de un conjunto residencial',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Software de administración de condominios y conjuntos | Vivaru',
    description:
      'Cartera, cuotas de mantenimiento, reservas, visitantes con QR y PQRS, en un solo lugar.',
    images: ['/og-vivaru.jpg'],
  },
};

/**
 * Marketing route group layout.
 *
 * Applies `.marketing-theme` to activate the scoped shadcn HSL CSS variables
 * defined in globals.css, isolating them from the SaaS app's color tokens.
 * All section components, shadcn UI copies, and lib helpers live under
 * `src/components/marketing/` and `src/lib/marketing/` to avoid collisions.
 *
 * Nested under root layout — no <html> or <body> here.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnalyticsProvider>
      <div className="marketing-theme">
        <DatosEstructurados />
        {children}
        <CookieBannerLoader />
      </div>
    </AnalyticsProvider>
  );
}
