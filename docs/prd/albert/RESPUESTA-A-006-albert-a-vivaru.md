# RESPUESTA-A-006 — Albert a Vivaru

> **Llegó por el canal el 1 de septiembre de 2026**, pegada por David en la sesión. No es una
> respuesta numerada suya: es una nota operativa. Se archiva íntegra —no trae identificadores ni
> datos personales— porque **cambia la vía de credencial** que `DECISIONES-A-005` §4 pedía, y
> porque nombra por primera vez un endpoint, `vivaruWonSignals`, que no aparece en ningún
> documento anterior.

---

*Para David — cómo sacar el email de la cuenta de servicio 👇*

Lo que necesitamos es *una sola cosa*: el email de la cuenta de servicio con la que corre la Cloud
Function (o el proceso) que va a llamar a nuestro endpoint vivaruWonSignals. Es la identidad de
máquina que Google usa para firmar el token — no es un correo de persona ni lleva contraseña.
Termina siempre en …iam.gserviceaccount.com.

Hay dos caminos; el segundo (gcloud) es el más rápido si lo tienes a mano.

*Camino A — Consola web (clic a clic):*

1. Entra a https://console.cloud.google.com y arriba, en el selector de proyecto, elige *el
   proyecto donde viven vuestras Cloud Functions* (el de producción de Vivaru — el mismo que usáis
   para escribir en el CRM).
2. Menú lateral → *Cloud Functions* (si no lo ves, búscalo en la barra de arriba: "Cloud Functions").
3. Abre *la función que hará la llamada* a nuestro endpoint (la del "empuje / señal de vuelta").
   Si aún no la habéis creado, saltad al punto 6.
4. Entra a la pestaña de *detalles/configuración* de esa función (en gen2 aparece como servicio de
   Cloud Run; busca la sección *"Runtime" / "Ejecución"*).
5. Copia el valor de *"Service account" / "Cuenta de servicio en tiempo de ejecución"* (Runtime
   service account). *Eso es lo que necesitamos.*
6. Si esa función aún no existe: dinos simplemente *con qué cuenta de servicio va a correr* cuando
   la creéis. Si va a usar la de por defecto, la encuentras en *IAM y administración → Cuentas de
   servicio*; suele ser …@<vuestro-project-id>.iam.gserviceaccount.com o la de compute
   <número-de-proyecto>-compute@developer.gserviceaccount.com.

*Camino B — con gcloud (una línea):*

Si la función ya existe, esto lo escupe directo (cambia NOMBRE_FUNCION, REGION y TU_PROYECTO):

```bash
gcloud functions describe NOMBRE_FUNCION --region=REGION --project=TU_PROYECTO --format="value(serviceConfig.serviceAccountEmail)"
```

O para ver todas las cuentas de servicio del proyecto:

```bash
gcloud iam service-accounts list --project=TU_PROYECTO
```

*Lo que nos devuelves:* solo esa cadena, el email completo que termina en .iam.gserviceaccount.com.
Nada más — ni claves, ni JSON, ni contraseñas.

*Un detalle que importa:* tiene que ser *exactamente* la cuenta con la que corre el código que nos
llama (la que "firma" la petición). Si nos pasas otra, nuestro endpoint la rechazará con 403. Si
tenéis dudas de cuál será, decídnoslo y lo cuadramos.
