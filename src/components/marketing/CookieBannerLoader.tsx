"use client";

/**
 * Client-side loader for CookieBanner.
 * Wraps next/dynamic { ssr: false } in a Client Component so it can be
 * imported from the (marketing) Server Component layout without errors.
 */
import dynamic from "next/dynamic";

const CookieBanner = dynamic(
  () =>
    import("@/components/marketing/CookieBanner").then((m) => m.CookieBanner),
  { ssr: false },
);

export function CookieBannerLoader() {
  return <CookieBanner />;
}
