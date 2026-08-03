import { Topbar } from '@/components/marketing/Topbar';
import { Footer } from '@/components/marketing/Footer';
import { Hero } from '@/components/marketing/Hero';
import { ProductGlimpse } from '@/components/marketing/ProductGlimpse';
import { ImpactBand } from '@/components/marketing/ImpactBand';
import { Pain } from '@/components/marketing/Pain';
import { Solution } from '@/components/marketing/Solution';
import { MultiConjunto } from '@/components/marketing/MultiConjunto';
import { PerspectivesLazy } from '@/components/marketing/PerspectivesLazy';
import { CasosDeUso } from '@/components/marketing/CasosDeUso';
import { Differentiators } from '@/components/marketing/Differentiators';
import { TrustOnboarding } from '@/components/marketing/TrustOnboarding';
// import { Pricing } from '@/components/marketing/Pricing';
// import { Pilot } from '@/components/marketing/Pilot';
import { FAQ } from '@/components/marketing/FAQ';
import { FinalCTA } from '@/components/marketing/FinalCTA';

/**
 * Marketing home — grupovivaru.com /
 *
 * Section order: Topbar → Hero → ImpactBand → Pain → Solution →
 * Perspectives → CasosDeUso → MultiConjunto → Differentiators →
 * TrustOnboarding → FAQ → FinalCTA → Footer. CookieBanner lives
 * in (marketing)/layout.tsx so it also appears on /diagnostico and /legal/*.
 *
 * HIDDEN: Pricing ocultada a pedido (segmentos/datos de unidades por revisar).
 * Reactivar descomentando el import y <Pricing /> debajo de <TrustOnboarding />.
 *
 * HIDDEN: Pilot removed — decisión comercial pendiente HITL H4 + fee.
 * Reactivar descomentando el import y añadiendo <Pilot /> debajo de <Pricing />.
 */
export default function Home() {
  return (
    <>
      <Topbar />
      <main className="bg-background text-foreground">
        <Hero />
        <ProductGlimpse />
        <ImpactBand />
        <Pain />
        <Solution />
        <PerspectivesLazy />
        <CasosDeUso />
        <MultiConjunto />
        <Differentiators />
        <TrustOnboarding />
        {/* HIDDEN — sección de planes ocultada a pedido (datos de unidades por revisar) */}
        {/* <Pricing /> */}
        {/* HIDDEN — HITL H4 + fee pendiente */}
        {/* <Pilot /> */}
        <FAQ />
        <FinalCTA />

        {/* Spacer so the fixed mobile bottom CTA doesn't clip the last section. */}
        <div className="h-24 md:hidden" aria-hidden="true" />
      </main>
      <Footer />
    </>
  );
}
