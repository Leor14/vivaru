/**
 * El service worker de FCM, servido por route handler (PRD-V-PLAT-005 §11).
 *
 * Es una ruta y no un fichero de `public/` porque el SW necesita la config de
 * Firebase, que vive en variables `NEXT_PUBLIC_*` distintas por ambiente — un
 * fichero estático la llevaría clavada y staging empujaría contra producción.
 * El SDK de FCM registra por convención `/firebase-messaging-sw.js`, y el
 * matcher del middleware ignora rutas con punto, así que llega hasta aquí.
 *
 * El compat de gstatic es el camino documentado por FCM para el SW; la versión
 * va anclada a la del `firebase` de package.json para no divergir en silencio.
 */

const VERSION_FIREBASE = "12.10.0";

export function GET(): Response {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const js = `/* Vivaru — service worker de Web Push (generado por route handler) */
importScripts("https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

// El SDK pinta la notificación de fondo y maneja el click con fcmOptions.link.
firebase.messaging();
`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Corto a propósito: un SW cacheado eterno es una versión vieja eterna.
      "Cache-Control": "public, max-age=300",
      "Service-Worker-Allowed": "/",
    },
  });
}
