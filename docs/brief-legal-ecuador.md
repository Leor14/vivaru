# Brief para asesoría legal — cobertura de Ecuador

**Para:** asesoría legal con competencia en Ecuador
**De:** equipo Vivaru (Qintilab S.A.S.)
**Fecha:** 8 de agosto de 2026

> Este documento lo preparó el equipo técnico. **No contiene ni sustituye
> asesoría legal.** Su único objetivo es que el abogado no tenga que leerse tres
> documentos completos para descubrir qué falta: aquí está localizado el hueco,
> cláusula por cláusula, con el texto vigente de las dos jurisdicciones ya
> cubiertas como referencia.

---

## 1. Qué es Vivaru y quién trata qué

Plataforma SaaS multi-tenant de administración de propiedad horizontal. Dos
portales operativos y uno de portería. Cada conjunto opera aislado.

- **Responsable del tratamiento:** el Administrador, es decir el conjunto o la
  administradora que contrata. Así lo define `datos.md` §1.1.
- **Encargado del tratamiento:** Qintilab S.A.S., domiciliada en Bogotá D.C.,
  Colombia (NIT 902060869-1).
- **Sub-encargado principal:** Google LLC (infraestructura, Firebase / Google
  Cloud). Los datos residen en la infraestructura de Google.
- **Categorías de titulares:** administradores, residentes propietarios e
  inquilinos, personal de portería, y **visitantes** — estos últimos son
  terceros que no contratan con nadie y de los que se registran datos de
  identificación y de acceso.
- **Categorías de datos:** identificación, contacto, unidad, estados de cuenta y
  pagos, comprobantes, registros de acceso y visitas, paquetería, solicitudes
  (PQRS), reservas de zonas comunes, y datos de navegación.

## 2. El hueco, en una frase

Los tres documentos legales están construidos como **pares Colombia / México**.
Ecuador se comercializa —aparece en el sitio público y en sus datos
estructurados, y el producto lo soporta técnicamente— pero **no aparece en
ninguno de los tres**.

Medición: 99 referencias de jurisdicción en 28 secciones, todas bilaterales.

## 3. Dónde falta, exactamente

### 3.1 Política de Privacidad (`src/content/legal/privacidad.md`)

| Sección | Qué hace hoy | Qué falta |
|---|---|---|
| Cabecera | Declara redacción conforme a Ley 1581/2012, Decreto 1377/2013 y Decreto 090/2018 (Colombia), y reconoce derechos de titulares en México conforme a LFPDPPP | Añadir el marco ecuatoriano |
| 6. Transferencia Internacional de Datos | Cubre el régimen colombiano (SIC, Circular Externa 05 de 2017) y el mexicano | Régimen ecuatoriano de transferencia internacional |
| **7. Derechos de los Titulares — Colombia (Habeas Data)** | Sección propia, con su procedimiento y su autoridad de control (SIC) | **Sección paralela para Ecuador**: qué derechos, cómo se ejercen, ante quién se reclama |
| **8. Derechos de los Titulares — México (Derechos ARCO)** | Sección propia, con su procedimiento | *(referencia de estructura para la anterior)* |
| 12. Menores de Edad | Se apoya en Ley 1581 | Tratamiento de menores bajo norma ecuatoriana |
| Contacto | Menciona Habeas Data y ARCO | Añadir la vía ecuatoriana |

### 3.2 Anexo de Tratamiento de Datos (`src/content/legal/datos.md`)

Es el documento **que el cliente firma** y el que más importa: es la pieza con la
que el Administrador, como responsable, sostiene su propia cadena de
cumplimiento.

| Sección | Qué hace hoy | Qué falta |
|---|---|---|
| Cabecera | Se declara conforme al Art. 25 del Decreto 1377/2013 y a la Circular Externa 002 de 2015 de la SIC (Colombia), y a los Arts. 50-59 de la LFPDPPP (México) | Base normativa ecuatoriana equivalente |
| 4. Instrucciones del Responsable | Enmarcadas en Ley 1581 y LFPDPPP | Encaje ecuatoriano |
| 5. Obligaciones del Encargado | §5.7 asiste en derechos de Habeas Data (Colombia) o ARCO (México) | Derechos equivalentes en Ecuador |
| 6. Obligaciones del Responsable | Referencia a SIC y a la norma mexicana | Autoridad de control ecuatoriana |
| 8. Transferencia Internacional | Bilateral | Régimen ecuatoriano |
| 11. Notificación de Incidentes | Plazos y destinatario según SIC / norma mexicana | **Plazo y autoridad en Ecuador** — es la cláusula con reloj, y por eso la más sensible |
| 14. Jerarquía Normativa | Resuelve conflicto entre Ley 1581 y LFPDPPP | Cómo entra Ecuador en esa jerarquía |

### 3.3 Términos y Condiciones (`src/content/legal/terminos.md`)

| Sección | Qué hace hoy | Qué falta |
|---|---|---|
| 1. Partes del Contrato | Qintilab S.A.S., sociedad colombiana | Verificar si contratar con un conjunto ecuatoriano exige algo más |
| 5. Pagos | Menciona Colombia y México | Tratamiento fiscal en Ecuador |
| 7. Obligaciones del Administrador | Le atribuye deberes bajo Ley 1581 o LFPDPPP | Deber equivalente en Ecuador |
| **15. Ley Aplicable y Resolución de Disputas** | **Ley colombiana y foro colombiano** | **La pregunta central:** ¿es oponible a un cliente ecuatoriano, o hay normas de orden público que lo desplacen? |

## 4. Las tres preguntas que decidimos que decida el abogado

1. **¿Se puede cubrir Ecuador añadiendo un tercer carril a estos documentos, o
   pide un juego propio?** La estructura actual es bilateral y añadir una tercera
   columna a cada cláusula puede volverla ilegible.
2. **§15, ley aplicable.** Hoy es Colombia. ¿Se sostiene frente a un contratante
   ecuatoriano, o hay que prever foro o ley distintos por país del cliente?
3. **§11, notificación de incidentes.** Es la única cláusula con plazo. Necesita
   el plazo ecuatoriano y la autoridad a la que se notifica.

## 5. Lo que el sistema hace de verdad

Para que las obligaciones que se redacten sean sostenibles, esto es lo
implementado y verificable en el código:

| Compromiso | Estado real |
|---|---|
| Aislamiento por conjunto | Reglas de Firestore, no configuración |
| Registro de operaciones sensibles | Colección `auditLogs` |
| Respaldos | Diarios |
| Acceso por rol | Tres perfiles + reglas |
| Exportación tras cancelar | 90 días (`datos.md` §10.2) |
| Borrado definitivo y certificado | Implementado como procedimiento, ver §10.2 |
| Suspensión por falta de pago | **Acción manual desde la consola. No hay automatismo.** |
| Efecto de `suspended` | El sistema deja el conjunto en **solo lectura** |

⚠️ **Dos desajustes entre contrato y sistema, para corregir en la misma pasada:**

1. `terminos.md` §5.5 dice que durante la suspensión «el acceso a la plataforma
   queda inhabilitado». El sistema no inhabilita: deja **solo lectura**
   (`assertTenantOperable`). El cliente recibe más de lo prometido, así que el
   riesgo es bajo, pero el contrato describe algo que no ocurre.
2. La escalera de mora de §5.5 **no la ejecuta ningún proceso automático**.
   Alguien tiene que entrar a la consola y suspender. Si nadie lo hace, la
   cláusula es letra muerta.

## 6. Decisión mientras tanto

Hasta que Ecuador esté cubierto hay dos caminos, y son excluyentes:

- **Sacar Ecuador de la lista de mercados** (`PAISES` en
  `src/lib/marketing/sitio.ts`, una línea) hasta que los documentos lo cubran.
  Deja de generar exposición nueva. **No resuelve la de un cliente ecuatoriano
  que ya haya firmado.**
- **Mantenerlo y aceptar el riesgo** de forma documentada, con fecha de revisión.

Clasificación con el marco de severidad × probabilidad: **severidad 4** (datos
personales regulados, de residentes y de visitantes que ni siquiera son parte),
**probabilidad 3** si no hay cliente ecuatoriano firmado y **4** si lo hay —
puntuación 12 (ORANGE) o 16 (RED). El dato de si hay cliente firmado lo tiene el
equipo comercial y es el que decide la urgencia.
