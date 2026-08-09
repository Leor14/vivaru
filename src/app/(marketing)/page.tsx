import type { Metadata } from 'next';
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
import { MarquesinaModulos } from '@/components/marketing/MarquesinaModulos';

/**
 * Marketing home — la raíz de grupovivaru.com.
 *
 * Section order: Topbar → Hero → ProductGlimpse → ImpactBand → Pain → Solution →
 * MarquesinaModulos → Perspectives → CasosDeUso → MultiConjunto →
 * Differentiators → TrustOnboarding → FAQ → FinalCTA → Footer. El CookieBanner
 * vive en (marketing)/layout.tsx para que salga también en /diagnostico y
 * /legal/*.
 *
 * HIDDEN: Pricing ocultada a pedido (segmentos/datos de unidades por revisar).
 * Reactivar descomentando el import y <Pricing /> debajo de <TrustOnboarding />.
 *
 * HIDDEN: Pilot removed — decisión comercial pendiente HITL H4 + fee.
 * Reactivar descomentando el import y añadiendo <Pilot /> debajo de <Pricing />.
 */

/**
 * ESTA PÁGINA VIVÍA EN `/mx`, y se movió a la raíz en agosto de 2026.
 *
 * `/mx` nació cuando el objetivo era solo México. Al pasar la estrategia a
 * México, Colombia y Ecuador con **un solo copy neutro**, el país en la ruta
 * dejó de ganarse su sitio y pasó a restar: un directorio `/mx` le dice a Google
 * que la sección es mexicana, y servir el mismo texto neutro bajo tres rutas de
 * país solo fabrica duplicados que se canibalizan.
 *
 * La regla que queda para el futuro: **primero se diferencia el contenido,
 * después se parten las URL.** El día que el copy de Colombia sea distinto del
 * de México, `/co` se justifica sola; antes de eso, no.
 *
 * `/mx` NO desaparece: redirige aquí con 308 (ver `mx/page.tsx`).
 *
 * La canónica se declara aquí y no en el layout — el layout la heredaba a
 * `/diagnostico` y a las tres legales, que acababan declarándose duplicados de
 * la home. El resto de la metadata sí se hereda, que es lo correcto.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

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
        <MarquesinaModulos />
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
