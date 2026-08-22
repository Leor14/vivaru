---
tags: [arquitectura, integracion, crm, albert, revops]
tipo: tecnica
fuentes: ["CONSULTA-A-001", "RESPUESTA-A-001", "DECISIONES-A-004", "ESTADO-ALBERT.md"]
fecha_creacion: 2026-08-22
fecha_actualizacion: 2026-08-22
---

# Integración con Albert CRM

**Albert CRM es propiedad de Qintilab, igual que Vivaru. No es un tercero.** Esa frase parece
un detalle de organigrama y es la que decide toda la arquitectura: la decisión de los socios del
17 de agosto de 2026 no fue «conectar Albert con Vivaru», fue **adaptar Albert a las reglas de
negocio de Vivaru**, con Vivaru redactando PRDs (familia `PRD-A-`, ver [[portafolio-prd]]) y
Albert desarrollándolas.

## La bisagra: Vivaru es TENANT de Albert

Es el encuadre que tumba media lista de bloqueos, y **el detalle que más veces se ha olvidado al
leer documentos viejos**.

Siendo tenant, Vivaru no consume una API pública: **entra como un usuario más del tenant
`vivaru`**, con las mismas reglas de [[multi-tenancy]] que Albert aplica a cualquier cliente. De
ahí salen tres consecuencias que no son obvias:

- **Para leer sus deals no hace falta webhook, ni trigger, ni OIDC.** La regla de Albert concede
  lectura a todos los roles del tenant, así que Vivaru se suscribe en vivo con `onSnapshot` a
  `tenants/vivaru/deals` y ve la conversión al instante — el mismo patrón de suscripción que usa
  el producto por dentro ([[firebase-firestore]]).
- **Para escribir tampoco hace falta una Cloud Function intermedia.** Se escribe con el SDK
  cliente, autenticado como un **usuario de servicio** del tenant con rol `sales`, y las reglas
  de Albert son las que gobiernan ([[autenticacion-roles]] describe el patrón equivalente en
  Vivaru).
- **Y por eso la validación del esquema de Albert NO corre sobre nuestras escrituras.** Su
  esquema de Zod vive en su aplicación; lo que nos limita a nosotros son sus reglas. Es una
  distinción con consecuencias y está anotada como pregunta abierta antes de construir el empuje.

## Estado — cerrado el 22 de agosto de 2026

El contrato se negoció en **nueve documentos** (`CONSULTA-A-001` … `DECISIONES-A-004`), y el
último **declara el intercambio cerrado explícitamente**: un intercambio que nadie cierra sigue
por inercia.

| Pieza | Estado |
|---|---|
| Alta del tenant `vivaru` y su usuario de servicio | **Ejecutada.** Es operación, no desarrollo: la corre un superadmin de Albert, igual que en [[superadmin]] de Vivaru |
| Campos propios en el deal (`externalRef`, `estimatedUnits`, `country`) | **Publicados en producción de Albert** |
| Validación de la referencia cruzada `crmRef` | **Construida** del lado de Vivaru |
| Empuje de leads con su freno, y camino de supresión | **Sin construir** |

## Las dos referencias cruzadas, que son DOS y no una

| Dirección | Campo | Formato |
|---|---|---|
| Albert → Vivaru | `crmRef` | `albert:deal:{tenantId}:{dealId}` para deals · `albert:user:{uid}` para comerciales |
| Vivaru → Albert | `externalRef.leadId` | El identificador del lead de Vivaru, dentro del deal |

**Por qué el envoltorio `albert:` y no el identificador pelado.** Albert lo ofrecía como opción
estética. No lo es: **un identificador de 28 caracteres no se distingue de otra referencia de la
misma forma**, así que sin prefijo «validar» se queda en «comprobar que no está vacío». Con
prefijo, pegar la referencia de un deal donde iba la de un comercial **falla al guardar**, que es
cuando hay alguien delante para corregirlo. Es la misma familia de decisión que
[[trampas-conocidas|resolver un `unitId` por doc id y no por slug]].

**Y el `dealId` suelto no sirve:** el deal vive bajo su tenant, así que sin el `tenantId` no
resuelve.

## Una promesa que no vigila ningún esquema

Albert se negó —con razón— a hacer obligatorio el contacto en un deal, porque rompería a sus
usuarios actuales. En su lugar **aceptó la palabra de Vivaru**: crear siempre el contacto antes
del deal, para que el consentimiento tenga dónde vivir.

**Dejó de ser una regla y pasó a ser una promesa.** Falta un freno que la haga fallar — y **va
dentro del empuje de leads, no antes**: hoy Vivaru no crea deals en absoluto, así que
construirlo suelto sería un guardián sin puerta.

## Retención: 12 y 12, con una condición de vigilancia

Un deal sin actividad vive **12 meses**; el registro de auditoría del borrado, **12 meses desde
la fecha del borrado** — dos relojes distintos, y decirlo importa porque el segundo es fácil de
cablear contra el primero.

Albert recomendó alargar el segundo con un buen argumento. **Se midió y su premisa no se cumple
todavía**, así que el número se queda y **el disparador para subirlo es una pieza de código, no
una fecha**: que exista en Vivaru un camino de supresión que borre el lead y avise a Albert en la
misma operación. Está escrito como condición de vigilancia **en las dos casas, con una redacción
por casa**, para que cada uno la compruebe sin depender del otro.

## Lo que nadie tiene, y bloqueará algún día

**El motor de mensajería con opt-out y control de frecuencia.** Sin él, el consentimiento que se
acaba de diseñar **no tiene quién lo respete al enviar**: se construyó el candado y no la puerta.
No está en un roadmap comprometido de ninguno de los dos. No bloquea nada hoy; bloqueará el día
que se manden correos de verdad ([[correos-mensajeria]]).

## La lección que se lleva este expediente

**Una dependencia se cae por dejar de necesitarla, no solo porque alguien la construya.** Tres
documentos de Vivaru decían que la señal de vuelta estaba bloqueada porque «Albert no tiene
webhooks». Era cierto mientras Vivaru fuese un tercero, y **murió al volverse tenant** — pero ese
tipo de muerte no deja commit, ni prueba en rojo, ni error en pantalla. Solo deja una frase
obsoleta que nadie contradice. Ver [[trampas-conocidas]] y [[estado-modulos]].

## Relaciones

- Véase también: [[multi-tenancy]], [[ciclo-de-vida-tenant]], [[banderas-funcionalidad]]
- Se conecta con: [[portafolio-prd]], [[integridad-financiera]], [[log]]

## Fuentes

- Estado vivo del expediente: `docs/prd/albert/ESTADO-ALBERT.md` — **se reescribe, no se acumula**
- Los nueve documentos del intercambio, en `docs/prd/albert/`
- Registro histórico de cómo se decidió: `docs/albert-vivaru-integracion.md` (congelado el 18 de agosto)
