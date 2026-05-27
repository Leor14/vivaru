"use client";

import dynamic from "next/dynamic";

/**
 * Client-side lazy boundary for the Perspectives section.
 *
 * Reasoning: Perspectives is the only section that imports framer-motion
 * (~25 kB after LazyMotion trimming). It lives below the fold, so we drop
 * it from the initial chunk via `dynamic(..., { ssr: false })`. This file
 * is a `"use client"` boundary because `ssr: false` is illegal in server
 * components in Next 14. SEO impact is acceptable: the section is mid-page
 * marketing content, not primary keyword copy (those live in Hero/Solution
 * which remain server-rendered).
 */
export const PerspectivesLazy = dynamic(
  () =>
    import("@/components/marketing/Perspectives").then((m) => m.Perspectives),
  {
    ssr: false,
    loading: () => (
      <section
        id="perspectivas"
        aria-hidden="true"
        className="container scroll-mt-24 py-xxl"
      >
        <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
      </section>
    ),
  },
);
