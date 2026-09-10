// Fija la contraseña de una cuenta de acceso **SOLO EN STAGING**, para poder
// entrar con el rol de un residente y mirar una pantalla con sus ojos.
//
// Existe porque validar con el navegador es lo que ha cazado la mayoría de los
// defectos de este producto, y el portal del residente **no se puede mirar desde
// la sesión del administrador**. El «Enviar acceso» del padrón no sirve para
// esto: manda un enlace por correo, y los conjuntos de demostración usan
// dominios que no reciben nada.
//
// ⚠️ **El proyecto va clavado a staging y no se puede pasar por argumento.**
// Ponerlo como parámetro sería dejar a un descuido la distancia entre cambiarle
// la clave a una cuenta de prueba y cambiársela a alguien de producción.
//
// Uso:  node functions/scripts/poner-clave-en-staging.mjs <correo> <clave>
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const PROYECTO = "vivaru-staging-02";
const [email, clave] = process.argv.slice(2);

if (!email || !clave) {
  console.error("Uso: node functions/scripts/poner-clave-en-staging.mjs <correo> <clave>");
  process.exit(1);
}
if (clave.length < 8) {
  console.error("La clave necesita al menos 8 caracteres.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
const auth = getAuth();

const usuario = await auth.getUserByEmail(email).catch(() => null);
if (!usuario) {
  console.error(`No existe ninguna cuenta con ${email} en ${PROYECTO}.`);
  process.exit(1);
}

await auth.updateUser(usuario.uid, { password: clave });
console.log(`✅ Clave actualizada en ${PROYECTO}`);
console.log(`   ${email}  ·  uid ${usuario.uid}`);
console.log(`\nEntra en:`);
console.log(`   https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app/login`);
