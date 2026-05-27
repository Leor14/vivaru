'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

/**
 * Vivaru — PostHog provider (marketing routes only)
 *
 * Consent-gated per HITL H9 / LFPDPPP basic compliance:
 *   - posthog.init() runs ONLY after the visitor accepts cookies
 *     (localStorage["vivaru.consent"] === "accepted") or after the
 *     CookieBanner dispatches the `vivaru:init_analytics` window event.
 *   - Until consent lands, the provider passes children through but does
 *     not load the SDK or fire any captures.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

const CONSENT_KEY = 'vivaru.consent';
const INIT_EVENT = 'vivaru:init_analytics';

let initialised = false;

function initPosthog() {
  if (initialised || typeof window === 'undefined' || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: 'localStorage+cookie',
    respect_dnt: true,
    autocapture: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug(false);
    },
  });
  initialised = true;
}

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY || !initialised) return;
    if (!pathname) return;
    const url =
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('page_view_landing', {
      $current_url: url,
      referrer: document.referrer || null,
      device_type:
        window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (hasConsent()) {
      initPosthog();
      setReady(true);
      return;
    }
    const onInit = () => {
      initPosthog();
      setReady(true);
    };
    window.addEventListener(INIT_EVENT, onInit);
    return () => window.removeEventListener(INIT_EVENT, onInit);
  }, []);

  if (!POSTHOG_KEY || !ready) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <PageviewTracker />
      {children}
    </PHProvider>
  );
}
