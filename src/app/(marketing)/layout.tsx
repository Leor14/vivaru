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
  title: 'Software de administración de condominios y conjuntos | Vivaru',
  description:
    'Software para administrar condominios y conjuntos residenciales en Latinoamérica: cartera, cuotas, reservas, visitantes y solicitudes.',
  // Con `www`. El apex `grupovivaru.com` devuelve 404 —App Hosting solo tiene
  // configurado el subdominio—, así que apuntar aquí al dominio raíz hacía que
  // todas las URL absolutas de Open Graph y canónicas señalaran a un 404.
  metadataBase: new URL(URL_SITIO),
  /*
   * OJO: aquí NO va `alternates.canonical`, y no es un olvido.
   *
   * Next HEREDA la metadata del layout a todas las rutas hijas, así que un
   * `canonical: '/mx'` puesto aquí se lo comía `/diagnostico` y las tres
   * legales: cuatro páginas declarando ser un duplicado de `/mx`, que es la
   * instrucción de no indexarlas por separado. Verificado en staging antes de
   * promover, con la canónica ya desplegada ahí y todavía no en producción.
   *
   * Cada página declara la suya. Lo mismo vale para `openGraph.url`.
   */
  /*
   * `openGraph` tampoco va aquí, y por la misma familia de motivo que la
   * canónica pero con una trampa peor: no se fusiona en profundidad. Una página
   * hija que declare `openGraph: { url: "…" }` REEMPLAZA este bloque entero y se
   * queda sin imagen ni locale, sin que lo avise nada. Cada página construye el
   * suyo con `openGraphDe(ruta)` de `lib/marketing/sitio.ts`.
   */
  twitter: {
    card: 'summary_large_image',
    title: 'Software de administración de condominios y conjuntos | Vivaru',
    description:
      'Cartera, cuotas de mantenimiento, reservas, visitantes con QR, quejas y solicitudes, en un solo lugar.',
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
