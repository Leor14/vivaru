"use client";

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

import { auth } from "@/lib/firebase/client";

export function setupAppCheck() {
  if (!auth) return;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY;
  if (!siteKey) return;

  initializeAppCheck(auth.app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
