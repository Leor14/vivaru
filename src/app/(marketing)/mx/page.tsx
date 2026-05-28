import { Topbar } from '@/components/marketing/Topbar';
import { Footer } from '@/components/marketing/Footer';
import { Hero } from '@/components/marketing/Hero';
import { ImpactBand } from '@/components/marketing/ImpactBand';
import { Pain } from '@/components/marketing/Pain';
import { Solution } from '@/components/marketing/Solution';
import { MultiConjunto } from '@/components/marketing/MultiConjunto';
import { PerspectivesLazy } from '@/components/marketing/PerspectivesLazy';
import { Differentiators } from '@/components/marketing/Differentiators';
import { Pricing } from '@/components/marketing/Pricing';
// import { Pilot } from '@/components/marketing/Pilot';
import { FAQ } from '@/components/marketing/FAQ';
import { FinalCTA } from '@/components/marketing/FinalCTA';

/**
 * Marketing home — grupovivaru.com /
 *
 * Section order: Topbar → Hero → ImpactBand → Pain → Solution →
 * Perspectives → MultiConjunto → Differentiators → Pricing →
 * FAQ → FinalCTA → Footer. CookieBanner lives in (marketing)/layout.tsx
 * so it also appears on /diagnostico and /legal/*.
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
        <ImpactBand />
        <Pain />
        <Solution />
        <PerspectivesLazy />
        <MultiConjunto />
        <Differentiators />
        <Pricing />
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
