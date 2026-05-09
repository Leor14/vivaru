"use client";

import { getToken, onMessage } from "firebase/messaging";

import { getMessagingIfSupported } from "@/lib/firebase/client";

export async function registerWebPush(vapidKey: string) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const token = await getToken(messaging, { vapidKey });
  return token;
}

export async function subscribeForegroundMessages(onPayload: (payload: unknown) => void) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  return onMessage(messaging, onPayload);
}
