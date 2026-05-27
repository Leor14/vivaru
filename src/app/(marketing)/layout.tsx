import type { Metadata } from 'next';
import { PostHogProvider } from '@/components/marketing/providers/PostHogProvider';
import { CookieBannerLoader } from '@/components/marketing/CookieBannerLoader';

export const metadata: Metadata = {
  title: 'Vivaru — Control residencial, vida más simple.',
  description:
    'La plataforma para operar conjuntos, condominios y fraccionamientos con orden, trazabilidad y autoservicio. Activación en 72 horas. Soporte en español.',
  metadataBase: new URL('https://grupovivaru.com'),
  openGraph: {
    title: 'Vivaru — Control residencial, vida más simple.',
    description:
      'Operar conjuntos residenciales con orden, trazabilidad y autoservicio.',
    type: 'website',
    locale: 'es_MX',
    siteName: 'Vivaru',
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
    <PostHogProvider>
      <div className="marketing-theme">
        {children}
        <CookieBannerLoader />
      </div>
    </PostHogProvider>
  );
}
