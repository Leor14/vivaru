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

  const js = `/* Vivaru — service worker de Web Push (v2, generado por route handler) */

// EL CLICK ES NUESTRO, y se registra ANTES de cargar el SDK a propósito: el
// manejador de FCM busca una ventana con la URL exacta del enlace y, si no la
// hay, hace openWindow — que en una web app INSTALADA de iOS trae la app al
// frente sin navegar (cazado en un iPhone real, 29 ago 2026). Aquí se corta su
// manejador y se navega el cliente existente; openWindow queda de último
// recurso, para cuando no hay ninguno.
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const msg = (event.notification && event.notification.data && event.notification.data.FCM_MSG) || {};
  const link =
    (msg.fcmOptions && msg.fcmOptions.link) ||
    (msg.notification && msg.notification.click_action) ||
    "/";
  event.waitUntil((async () => {
    const abiertos = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abiertos) {
      try {
        await c.focus();
        if ("navigate" in c) await c.navigate(link);
        return;
      } catch (e) { /* siguiente cliente */ }
    }
    await clients.openWindow(link);
  })());
});

importScripts("https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

// El SDK sigue pintando la notificación de fondo; el click ya no es suyo.
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
