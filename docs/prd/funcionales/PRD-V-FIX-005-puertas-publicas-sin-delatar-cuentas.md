# PRD-V-FIX-005 — Las puertas públicas no delatan cuentas, y lo desactivado se cierra al instante

| | |
|---|---|
| **ID** | `PRD-V-FIX-005` (tentativo hasta registrarlo en `docs/prd/README.md`) |
| **Tipo** | `FIX` — seguridad: cinco huecos pequeños que un desconocido puede usar sin credenciales o con una cuenta de prueba |
| **Portales** | Landing público (alta de prueba, formularios comerciales) · **login de los cuatro portales** · `ADMIN` (usuarios operativos) · `SUPERADMIN` (soporte) |
| **Módulo** | Identidad y acceso · Alta de prueba · Soporte |
| **Usuario principal** | El **prospecto** que se da de alta — y el desconocido que usa esa misma puerta para averiguar quién tiene cuenta |
| **Usuarios secundarios** | `tenant_admin` (usuarios operativos, soporte) · el equipo de Vivaru · cualquiera que inicie sesión |
| **Responsable** | David |
| **Estado** | 🟡 **EN STAGING** desde el 12 sep 2026 (02:15–02:25 UTC), rama `trabajo/fix-005-puertas-publicas` en `1f7c098`: functions `createSupportTicket`, `createTenantOperationalUser`, `createTrialWorkspace`, `replyToSupportTicket` y `updateSupportTicketStatus` —la última la cazó resolver un **alias del import** (`updateSupportTicket as updateSupportTicketImpl`): el cierre por nombre no la veía—, con su `updateTime`; front `build-2026-09-12-003` por rollout manual; reglas `9498d3a9`, idénticas al repo; y la migración de soporte hecha y comprobada: 0 uids del equipo a la vista, y los uid en `equipo/`. **Falta mirarlo en pantalla** —login, «Recordar sesión», `/registro`, «Asignármelo»—, y eso pide iniciar sesión: lo hace David. **Antes, en desarrollo** (11 sep 2026 por la noche). **Arrancó sola** tras las ventanas de producción de ese día, por decisión de David. **Hecho: H2** —`tenantMember` exige la membresía activa, con el mismo criterio que las functions—: los tres `CF5` en rojo contra la regla de antes, **482** pruebas de reglas en verde (475 + 7) y dos falsaciones que enrojecen exactamente la suya. **Y H3 en el hilo y en la asignación (H3a)**: el uid del equipo sale del documento del ticket a `supportTickets/{id}/equipo`, que solo lee el superadmin; `CF6` recorre **todo** lo que se escribe en el ticket, y cuatro falsaciones enrojecen exactamente las suyas. Migración en seco: 3 tickets en staging, 0 en producción. **Y H3b**: el correo del superadmin sale del código del navegador —el rol, del claim y del perfil; la cuenta tiene el claim en los dos ambientes, medido antes—, con el guardián `CF9` sobre `src/`, `components/` y `features/` sin comentarios. Ese guardián mira el TEXTO: un correo partido en dos cadenas lo esquivaría y el minificador lo juntaría, así que la prueba de verdad es el paquete de `/login` en producción (§13). **Y H4a**: el login da un solo mensaje para credenciales inválidas —la frase que decía si una cuenta existía estaba en DOS mapas, el del login y el de los toasts; los dos salen ahora de un módulo único (`src/lib/auth/mensajes-de-login.ts`) y una prueba los compara código a código— y ningún error de Auth sale crudo. `CF7` en rojo antes del arreglo, señalando los dos ficheros, y tres falsaciones. **Y H4b**: «Recordar sesión» llega por fin a `login()`, que fija la persistencia antes de entrar —de sesión si la casilla está desmarcada; si no, como siempre—; la prueba fija el cableado y dos falsaciones enrojecen exactamente la suya. **Que la sesión muera de verdad al cerrar el navegador (`CA5`) se mira en staging con los ojos.** **Y H1, con las decisiones de David del 11 sep** (R2, opción A: su R2 chocaba con el paso «Da de alta a tu portería» de la guía): el alta de prueba responde lo mismo exista o no la cuenta y al dueño le llega un correo, sin el nombre del formulario; los intentos tienen límite por correo (5 por hora), mirado ANTES que la cuenta; y en una prueba el alta de usuarios operativos tiene tope (10 en la prueba), contado antes de buscar el correo. `/registro` ya no afirma que creó nada. **Y H3c** (opción A): el equipo sube sus adjuntos a `support/equipo/`, sin tocar `storage.rules`, porque `admin()` ya incluye al superadmin. Nueve falsaciones; la del tope desactivado con `if (false && …)` **pasa en verde, y se buscó así**: el guardián de cableado mira el orden del texto, no si la condición se cumple. **Límites dichos:** el alta con cuenta responde antes que la que crea un ambiente —el tiempo delata lo que el texto ya no—; `limitesDeIntentos` no tiene todavía política de TTL (es configuración del proyecto: se pide con permiso); y los adjuntos que el equipo subió antes siguen en su carpeta con uid, porque la migración del hilo no los mueve. **Falta:** la IP en el límite, que espera a H5 (medir en staging qué posición de `X-Forwarded-For` añade la infraestructura); App Check (`D-CONSOLA`); y desplegar —staging primero, para mirar `CA5`, «Asignármelo» y `/registro`—. **Antes: Lista para desarrollo** (11 sep 2026). Sale de repasar un video sobre cinco errores de las apps hechas con IA y de la auditoría que lo contrastó con el código el mismo día |
| **Dependencias** | **`FIX-004` en producción antes**: cierra la cadena que hacía peligroso el hallazgo H3. Para App Check, **una clave de reCAPTCHA Enterprise y registrar la app en la consola** (`D-CONSOLA`, de David o con su permiso) |
| **Riesgo** | **Medio.** Toca el login de todos y una regla transversal (`tenantMember`), restrictiva. **Radio medido: 0** |
| **Reversibilidad** | **Alta.** Functions y front por rollback; la regla, redesplegando la anterior; App Check se enciende primero en modo de solo medir |
| **Fase comercial** | Todos los planes |

---

## 1. Resumen ejecutivo

El alta de prueba del landing es pública y **le dice a cualquiera si un correo tiene cuenta en Vivaru**, sin límite de intentos. Además, una membresía desactivada **sigue abriendo las reglas** hasta que caduca el token; el hilo de soporte **le enseña al conjunto el uid** de quien responde desde Vivaru; el login conserva un mensaje que delataría cuentas si alguien apagara la protección de Firebase, y la casilla «Recordar sesión» no hace nada. Esta ficha cierra los cinco sin cambiar nada de lo que un usuario legítimo hace a diario. **Lo grave del mismo repaso ya está en `FIX-004`.**

## 2. Problema y baseline

### 2.1 Lo que ya está bien — verificado el 11 sep 2026, no supuesto

| Del video | En Vivaru |
|---|---|
| Clave de servicio en el navegador | **No.** 21 chunks de `/login` en producción (1,5 MB), sin claves privadas ni de Resend; solo la clave web de Firebase, pública por diseño. `FIREBASE_SERVICE_ACCOUNT` no está definida en ningún ambiente: App Hosting usa su propia identidad |
| La API toma el id del usuario de la petición | **No.** Las 82 functions identifican al que llama por `request.auth`; las rutas de Next no sirven datos por usuario; la cookie de sesión solo enruta |
| Tablas sin RLS | **No.** Las reglas deniegan por defecto, no hay ninguna abierta, 475 pruebas |
| Logout que solo borra la cookie | **Hace `signOut`** (`auth-context.tsx:960`). No revoca en el servidor —lo normal en Firebase: un token vive ≤ 1 h— |
| Errores que delatan cuentas | **El login no**: `enableImprovedEmailPrivacy: true` en producción. La recuperación de clave responde igual siempre |

### 2.2 Los cinco hallazgos

| # | Hallazgo | Dónde |
|---|---|---|
| **H1** | **El alta de prueba delata cuentas.** `createTrialWorkspace` es pública y sin sesión, y responde «Ya existe una cuenta con ese correo. Inicia sesión o contacta a un asesor.» para CUALQUIER cuenta —residentes, porteros, admins y equipo—. **Sin límite de intentos ni App Check**, aunque su comentario diga que «el llamador» aplica el límite. Y su gemela autenticada: `createTenantOperationalUser` responde «Ya existe un usuario con ese correo.» a cualquier admin, **incluido el de una prueba recién creada**, porque ahí no se aplica la regla B («en prueba no se invita a personas reales») | `trial-workspace.ts:115-130` · `index.ts` (`createTenantOperationalUser`) |
| **H2** | **Una membresía desactivada sigue abriendo las reglas** hasta 1 hora: `tenantMember` concede por EXISTENCIA del documento y desactivar lo deja con `status: "inactive"`. Las functions sí la rechazan al instante | `firestore.rules:16-18` |
| **H3** | **El conjunto ve el uid del equipo de Vivaru, y por DOS campos, no uno** (medido el 11 sep al construir; la ficha contaba solo el primero): cada respuesta de soporte se guarda en el hilo con `authorUid`, **y `assignedTo` lleva el uid de quien atiende el ticket** —lo escriben la autoasignación al primer mensaje del equipo (`marcasSup001`) y la asignación a mano (`updateSupportTicket`)—; el admin lee el documento entero. Es la pieza que hacía explotable desde fuera la cadena de `FIX-004`. Y el correo del superadmin está **escrito en el código del navegador**, que además le da el rol en la interfaz por el correo | `support.ts:394` · `support.ts:345` y `:486` · `firestore.rules` (`supportTickets`) · `auth-context.tsx:200` |
| **H4** | **El login conserva «No existe una cuenta con ese correo.»** para `auth/user-not-found`: hoy no se alcanza —la protección de Firebase está encendida—, pero volvería a delatar el día que alguien la apague; y el resto de errores salen **en inglés, crudos**. La casilla **«Recordar sesión» no hace nada**: la persistencia es siempre local | `auth-context.tsx:141-156` · `login-form.tsx:23, 41, 161-163` · `client.ts:33` |
| **H5** | **El límite de `/api/lead` y `/api/demo` se esquiva**: toma la PRIMERA IP de `X-Forwarded-For`, que la escribe el cliente | `api/lead/route.ts:28-29` · `api/demo/route.ts:41-42` |

### 2.3 Baseline medido — 11 sep 2026, solo lectura

| Medida | `hogaru-1` | `vivaru-staging-02` |
|---|---|---|
| Membresías `inactive` (radio de H2) | **0** de 41 | **0** de 53 |
| Tickets con un uid del equipo a la vista, por el hilo · por `assignedTo` · uids distintos · conjuntos que los ven *(remedido el 11 sep por la noche, con los dos campos)* | 0 · 0 · 0 · 0 (1 ticket) | 3 · 1 · 3 · 1 (5 tickets; el de `assignedTo` es uno de los tres del hilo) |
| Conjuntos de prueba | 3 | 6 |

## 3. Usuarios, roles y permisos

| Rol | Puede | **NO puede** |
|---|---|---|
| Anónimo (landing) | Darse de alta a prueba | **Saber si un correo tiene cuenta.** Repetir el alta sin límite. Llamar al alta sin App Check (cuando se exija) |
| `tenant_admin` de una **prueba** | Crear usuarios operativos, **también su portero real** —la guía lo propone— | Usar el alta de usuarios como oráculo: sus intentos tienen **tope** durante la prueba (R2, decisión de David del 11 sep) |
| `tenant_admin` | Ver en soporte **el nombre** de quien le responde | Ver el **uid** de nadie del equipo de Vivaru |
| Cuenta con membresía `inactive` | — | Leer ni escribir nada del conjunto, **ni durante la hora** que le queda al token |

## 4. Objetivo, alcance y exclusiones

**Entra:** H1 a H5, con App Check **exigido solo en la callable pública del alta**.

| No entra | Por qué |
|---|---|
| «Cerrar sesión en todos los dispositivos» | Funcionalidad nueva, no un hueco. Candidata aparte |
| App Check exigido en Firestore y Storage | Se enciende primero en modo de solo medir; exigirlo es Fase 2, con métricas delante |
| Revocar tokens en el servidor al hacer logout | Lo normal en Firebase; el token muere en ≤ 1 h y H2 cierra el caso que importaba |
| Cloudflare delante de la web | Descartado el 11 sep: no protege lo que el navegador habla con Google directamente |

## 5. Flujo funcional

**Alta de prueba:**

1. Correo **sin cuenta** → como hoy: el enlace de activación.
2. Correo **con cuenta** → **la MISMA pantalla** que el caso 1 («Revisa tu correo para continuar»), y al dueño le llega un correo: «Ya tienes cuenta en Vivaru: inicia sesión o recupera tu contraseña».
3. Más de N intentos por correo o por IP en una hora → rechazo **sin decir por qué es**. *(N: TBD en construcción, recomendado 5.)*

**Login:** credenciales inválidas, sea cual sea la causa → «Correo o contraseña incorrectos.»; cuenta desactivada (con credenciales válidas) → «Tu cuenta está desactivada. Contacta a la administración de tu conjunto.»; demasiados intentos → «Demasiados intentos. Espera unos minutos.»; cualquier otro → un genérico en español. **Ningún mensaje crudo de Firebase.**

**«Recordar sesión»:** marcada → persistencia local (como hoy); desmarcada → la sesión muere al cerrar el navegador.

## 6. Estados y transiciones

Sin estados nuevos. La única transición que cambia es la de la membresía: `inactive` deja de abrir las reglas **en el mismo instante** en que se desactiva.

## 7. Contrato de datos y multi-tenancy

- **`supportTickets`**: una respuesta con `role: "vivaru"` deja de llevar `authorUid`, y **`assignedTo` sale del documento** —se queda `assignedToName`, que es lo que pinta la consola—. El uid va a **`supportTickets/{id}/equipo`**, que solo lee el superadmin y que nadie escribe desde el cliente: `equipo/asignacion` para quién atiende el ticket (lo necesita el «Asignármelo» de la consola) y `equipo/respuesta-{id}` para quién escribió cada respuesta. **Subcolección aparte y no `internal`**: la consola lista `internal` como notas. **Migración** de lo ya escrito: 0 en producción y 3 tickets en staging (uno también con `assignedTo`), con un script en seco primero.
- **Límite del alta**: contadores por correo (con hash, no en claro) y por IP, en una colección **solo de servidor** con caducidad automática. Sin `tenantId`: no son del conjunto.
- **Conjunto suspendido, vencido o en prueba**: H1 se aplica justo a las pruebas; lo demás, a todos por igual.

## 8. Reglas de negocio

| # | Regla |
|---|---|
| **R1** | Una puerta pública responde **lo mismo** exista o no la cuenta |
| **R2** | **Decisión de David del 11 sep (opción A), que sustituye a la regla B aquí:** una prueba SÍ da de alta a su portero real —la guía lo propone: es su personal, no un tercero—, pero el alta de usuarios operativos **no sirve de oráculo**: en un conjunto en prueba los intentos tienen un **tope**, que se cuenta ANTES de buscar el correo. *(Decía: «una prueba no crea usuarios operativos con correos reales», y chocaba con el paso «Da de alta a tu portería» de la guía.)* |
| **R3** | Una membresía `inactive` no abre **ninguna** regla |
| **R4** | Ningún conjunto ve el uid de nadie del equipo de Vivaru |
| **R5** | El login da **un solo** mensaje para credenciales inválidas, con o sin la protección de Firebase |
| **R6** | «Recordar sesión» hace lo que dice |
| **R7** | Un límite por IP usa la IP que añade la infraestructura, no la que manda el cliente |
| **R8** | La callable pública del alta exige App Check y límite por correo e IP |

## 9. Notificaciones y correo

Un correo nuevo: «Ya tienes cuenta en Vivaru», para el alta con un correo existente. Sale por `functions/src/email.ts` con el remitente verificado. Sin promesas de plazo.

## 10. Criterios de aceptación

**Deben pasar:**

| # | Criterio |
|---|---|
| CA1 | Alta con correo nuevo → como hoy |
| CA2 | Alta con correo existente → la misma pantalla que CA1, y el dueño recibe «Ya tienes cuenta» |
| CA3 | Una membresía `active` sigue exactamente igual: las 475 pruebas de reglas en verde |
| CA4 | El admin sigue viendo en soporte **el nombre** de quien le responde |
| CA5 | «Recordar sesión» desmarcada → al cerrar el navegador hay que volver a entrar; marcada → como hoy |

**Deben fallar:**

| # | Criterio |
|---|---|
| CF1 | La respuesta de CA2 **se distingue** de la de CA1 en código, texto o forma |
| CF2 | Más de N altas en una hora con el mismo correo o la misma IP → rechazadas |
| CF3 | Una llamada al alta sin App Check válido → rechazada |
| CF4 | El admin de una prueba pasa del **tope de intentos** de alta de usuarios operativos → rechazado **sin buscar el correo** (R2, opción A). *(Decía «crea un usuario operativo con correo real → rechazado».)* |
| CF5 | Una membresía `inactive` con la cuenta aún habilitada lee algo del conjunto |
| CF6 | El documento del ticket que lee el admin contiene el uid de alguien del equipo |
| CF7 | Login con correo inexistente y con clave incorrecta dan textos distintos, **aun con la protección de Firebase apagada** |
| CF8 | Un `X-Forwarded-For` falso esquiva el límite de `/api/lead` |
| CF9 | El paquete del navegador contiene el correo del superadmin |

**CF1, CF5 y CF6 van en rojo contra el código de hoy** antes de escribir la corrección.

## 11. Arquitectura y dependencias

- **Callable, como ya es.** El alta responde uniforme y manda el correo del caso 2 desde el servidor; `enforceAppCheck` en `createTrialWorkspace`; límite en Firestore solo de servidor.
- **`createTenantOperationalUser`**: en un conjunto en prueba **cuenta el intento contra un tope ANTES de buscar el correo** —R2, opción A de David del 11 sep—; **no** aplica `assertCanInviteRealPeople`, que rompería el paso «Da de alta a tu portería». El contador es `limitesDeIntentos`, una colección que solo escribe el servidor, con la clave en hash; el mismo que usa el límite del alta.
- **Reglas**: `tenantMember` pasa de «existe» a «existe **y** está activa», conservando la lectura de `status` ausente como activa, igual que las functions. Es la base de `tenantRole`, así que **la cambia en todas**; por eso el radio se midió antes (0) y va la última. **Hecho el 11 sep:** también el `status` **nulo** cuenta como activa, porque las functions usan `??`. **Lo que esta regla NO cierra, dicho:** Storage decide por el claim y no puede leer la membresía —se midió en `PLAT-002`: las reglas entre servicios no funcionan en el servicio real—, así que una membresía `inactive` cuyo claim aún apunte a ese conjunto sigue abriendo Storage hasta que el token caduque (≤ 1 h). Y hay un gemelo **más estricto**, no más laxo: `visita-no-anunciada.ts` exige `status === "active"` y trata la ausencia como inactiva; no se toca aquí.
- **Soporte**: la respuesta del equipo sin `authorUid` en el hilo, y la asignación sin uid en el ticket; el uid a `supportTickets/{id}/equipo` (§7). **H3c, abierta y medida el 11 sep:** la ruta de un adjunto que sube el equipo es `tenants/{t}/support/{uid}/…` —la exigen `storage.rules` (`duenoUid == request.auth.uid`) y la callable (`validateAttachments`)— y viaja en `thread[].attachments[].path` y en su `url`: una **tercera** vía al uid. Dos salidas: un segmento neutro para el equipo (toca `storage.rules`, `upload.ts` y la callable) o copiar el archivo en el servidor al guardar la respuesta. **Hoy no expone nada**: producción no tiene ni una respuesta del equipo.
- **Front**: el login con el mapa único y `setPersistence` según la casilla; el correo del superadmin fuera de `auth-context.tsx` —el rol sale solo del claim—; `/registro` con el texto uniforme.
- **`/api/lead` y `/api/demo`**: la IP de la posición que añade Google. **`TBD` en construcción:** comprobar en staging qué posición de `X-Forwarded-For` es la de la infraestructura en App Hosting. **Medido el 12 sep en las CALLABLES** (una llamada a `createTrialWorkspace` con un `X-Forwarded-For` falso): llega «lo que mandó el cliente, la IP que vio Google», con la real **al final**; y `request.rawRequest.ip` devuelve **la falsa**, porque Express se fía del primer valor. La buena es la última (`ipQueAnadioGoogle`), y el alta de prueba ya la cuenta en su límite. App Hosting va detrás de otro balanceador y se mide aparte. **Y en App Hosting, medido el mismo día** con una petición a `/api/lead` con cuerpo inválido: llega «lo que mandó el cliente, la IP real, y DOS saltos de Google», así que la del cliente es la **tercera empezando por el final** (`ipDelCliente`, `SALTOS_DE_APP_HOSTING = 2`) —copiar la regla de las callables habría contado una IP de Google, la misma para todos, y el límite habría frenado a todo el mundo—. Con menos entradas de las esperadas no se adivina: no hay límite por IP y queda un aviso en el registro. Las dos medidas se hicieron con un registro temporal, solo en staging, que ya no está en el código.
- **`D-CONSOLA`**: clave de reCAPTCHA Enterprise y la app registrada en App Check. **La hace David o se hace con su permiso.**

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación | Señal |
|---|---|---|
| App Check rechaza a un prospecto legítimo | Modo de solo medir antes de exigir; exigir solo en una callable | Métricas de App Check en la consola |
| La regla de membresía activa deja fuera a alguien | Radio medido: 0 en los dos ambientes; reglas las últimas | Denegaciones tras desplegar |
| Un prospecto que ya tenía cuenta no entiende la pantalla | El correo le explica qué hacer | Tickets de soporte |
| Un comentario que miente otra vez | Los comentarios de `trial-workspace.ts:115-116` se reescriben con lo que de verdad hay | Revisión de la ficha |

## 13. Despliegue, rollback y validación

**Orden:** functions → front → **reglas** (restringen). App Check: registrar y medir → exigir en la callable.
**Rollback:** functions y front por rollback; reglas, el ruleset anterior; App Check se apaga en la consola.
**Validación:** emulador para reglas (CF5) y functions (CF1, CF2, CF4, CF6); staging con los ojos para el login, «Recordar sesión» y el alta; producción: `updateTime`, diferencia de reglas y **el paquete de `/login` sin el correo del superadmin** (CF9), con el mismo barrido del 11 sep.

## 14. Puertas

| Puerta | Estado |
|---|---|
| **G0 Necesidad** | ✅ Cinco hallazgos leídos en el código y H1 comprobable desde fuera |
| **G1 Valor** | ✅ Baseline del 11 sep (§2.3). Métrica: **cero puertas públicas que distingan una cuenta existente** |
| **G2 Datos y permisos** | ✅ Una colección de servidor para el límite; un campo que sale del hilo |
| **G3 Riesgo** | ✅ Radio medido; reglas al final; App Check medido antes de exigir |
| **G4 Aceptación** | ✅ 5 que pasan y 9 que deben fallar; tres en rojo antes del arreglo |
| **G5 Operación** | ✅ Nadie lo opera a diario; App Check se mira una vez tras encenderlo |
| **G6 Escala** | ✅ Una lectura más en el alta; `tenantMember` ya leía la membresía |

**Decisiones tomadas por recomendación, confirmables por David:** respuesta uniforme más correo al dueño (y no solo un límite); que «Recordar sesión» funcione (y no quitarla); App Check exigido solo en el alta en esta entrega.
