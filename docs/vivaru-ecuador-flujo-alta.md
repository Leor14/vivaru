---
documento: Especificación del flujo de alta — Ecuador
producto: Vivaru
operador: Qintilab S.A.S. (Bogotá D.C., Colombia) — NIT 902060869-1
jurisdiccion: Ecuador
version: 1.0
fecha: 2026-08-11
estado: BORRADOR — requiere validación del abogado patrocinador antes de publicar cualquier texto
fuentes_del_sistema:
  - brieflegalecuador.md (2026-08-08) — inventario de datos y estado real del sistema
  - Memorando_Vivaru_Ecuador.docx (2026-08-11) — plan de acción integral
supuestos_confirmados:
  alta_cliente: autoservicio (click-wrap)
  alta_usuarios_finales: los crea el administrador del conjunto
  datos_capturados_adicionales: [foto/biometría, reconocimiento de placas, geolocalización/videovigilancia, cédula/pasaporte]
  clientes_ecuatorianos_firmados: 0 (negociación/piloto en curso)
advertencia: |
  Este documento es análisis y redacción asistida. No sustituye el patrocinio de un abogado
  colegiado en Ecuador. Los textos marcados como COPY están destinados a exhibirse a titulares
  de datos: un texto de consentimiento mal construido no es un defecto de redacción, es una
  base de legitimación inválida.
---

# Especificación del flujo de alta — Ecuador

## 0. Cómo usar este documento

- Los bloques ` ```copy ` son **texto literal de pantalla**, listo para copiar al producto. Los datos faltantes van entre `[CORCHETES]`.
- Cada requisito tiene un ID estable (`REQ-nn`) con su norma. La sección 10 es la matriz de verificación.
- Cada pantalla tiene un ID estable (`A1`–`A6`, `B1`–`B3`, `G1`–`G3`, `M1`).
- La sección 11 es la **doble validación** contra `brieflegalecuador.md`: qué del sistema actual soporta este flujo y qué no.

---

## 1. La restricción que gobierna todo el diseño

> **El interés legítimo está prohibido para datos sensibles, y la biometría lo es por definición legal.**

| Norma | Contenido |
|---|---|
| LOPDP Art. 4 | Dato sensible incluye **datos biométricos**. Dato biométrico = dato relativo a características físicas «que permita o confirme la identificación única de dicha persona, **como imágenes faciales** o datos dactiloscópicos». No condiciona a que se traten para identificación unívoca (a diferencia del RGPD Art. 9.1). |
| LOPDP Art. 25 | Categorías especiales: (a) datos sensibles, (b) datos de NNA, (c) salud, (d) discapacidad. |
| LOPDP Art. 26 | **Prohíbe** el tratamiento de datos sensibles salvo 7 circunstancias tasadas. El interés legítimo **no está entre ellas**. La única viable aquí es el literal a): **consentimiento explícito**. |
| Res. SPDP-SPD-2025-0041-R Art. 16.1 | *«Se prohíbe la aplicación del interés legítimo como base de legitimación para el tratamiento de datos personales en los siguientes casos: 16.1. Datos sensibles.»* (R.O. 1er Sup. 177, 03-12-2025) |
| LOPDP Art. 8.1 | El consentimiento debe ser **libre**, «exenta de vicios del consentimiento». No existe en Ecuador regla literal de no condicionalidad equivalente al Art. 7.4 RGPD, pero el resultado es el mismo. |

### 1.1 Base de legitimación por módulo

| Módulo | Base | Restricción operativa |
|---|---|---|
| Videovigilancia sin biometría | Interés legítimo (Art. 7.8) | Res. 0041 Art. 15.2 reconoce expresamente el «control de accesos». Ponderación documentada por el responsable, revisión anual |
| Registro nominativo de visitante | Interés legítimo (Art. 7.8) | **No cabe invocar «obligación legal» (Art. 7.2)**: no existe norma ecuatoriana que obligue a los conjuntos a llevar libro de visitantes. Un reglamento interno de copropiedad no es «obligación legal» |
| Lectura de placas (LPR) | Interés legítimo (Art. 7.8) | Placa = dato personal, no sensible. Campo de visión restringido al carril de ingreso |
| Foto o biometría facial | **Consentimiento explícito (Art. 26.a)** | Interés legítimo PROHIBIDO. Alternativa no biométrica obligatoria |
| Geolocalización | Interés legítimo | No es categoría especial, pero activa gran escala automática |
| Residentes (servicio ordinario) | Art. 7.5 (relación de copropiedad/arrendamiento) o Art. 7.8 | **No pedir consentimiento**: no sería libre → nulo por Art. 8.1 |
| Datos de menores | Autorización del representante legal (Art. 21) | Interés legítimo prohibido como regla (Res. 0041 Art. 16.4) |

### 1.2 Zona gris declarada

La **foto facial simple** (sin cotejo) podría no ser biométrica bajo criterio funcional. El Proyecto de Norma General para el Tratamiento de Datos Biométricos apunta en esa dirección, **pero sigue siendo proyecto y no es exigible a agosto de 2026** (consulta pública 31-mar a 28-abr-2026; no figura en el listado de resoluciones expedidas). Criterio adoptado en esta especificación: **tratarla como dato sensible**. Equivocarse a la baja invalida la base de legitimación de todo el módulo.

### 1.3 Prohibiciones expresas que deben quedar en el producto

| ID | Prohibición | Norma |
|---|---|---|
| PROH-01 | Grabación de **audio** en videovigilancia bajo interés legítimo. Tampoco para supervisión o control del desempeño laboral | Res. 0041 Art. 15, párrafo final |
| PROH-02 | Videovigilancia en zonas de alta expectativa de privacidad: baños, vestidores, lactarios, comedores. En PH alcanza a vestidores de piscina, sauna y zonas de cambio del gimnasio | Res. 0041 Art. 15.2 |
| PROH-03 | Biometría o foto facial de menores de edad | Proyecto de norma biométrica Art. 19 (no vigente, pero sin justificación de producto para asumir el riesgo) |
| PROH-04 | Uso de datos de residentes para analítica de producto identificable, entrenamiento de modelos o marketing propio | RGLOPDP Art. 43 — determina fines propios → convierte a Vivaru en responsable |
| PROH-05 | Módulos sensibles activados por defecto | Misma razón: determinar medios y fines |
| PROH-06 | Plazos de retención con valor por defecto no modificable | Misma razón. La SPDP exige que el responsable documente el plazo motivadamente |

### 1.4 Gran escala: calificación automática

Res. SPDP-SPD-2026-0005-R **Art. 14** califica como gran escala **sin aplicar el modelo de puntuación**:

- `14.1` datos sensibles → **activado** (biometría)
- `14.3` observación sistemática en zonas de acceso mediante videovigilancia → **activado**
- `14.4` todo tratamiento de datos biométricos **y** toda geolocalización → **activado (doble)**
- numeral de NNA en entornos institucionales o de prestación de servicios → **activado**

Los **Arts. 13, 14 y 15** imputan obligaciones **directamente al encargado con «acceso, visibilidad o control efectivo»**. Un SaaS multi-tenant que aloja la base tiene los tres. → Qintilab necesita **DPD propio** y **RAT propio**; no basta el del conjunto.

### 1.5 Precedente sancionatorio

| Fecha | Sujeto | Monto USD | Norma | Causa |
|---|---|---|---|---|
| 2025-12-01 | LIGAPRO | 259.644,01 | Art. 68.1 (grave) | Consentimiento no válidamente obtenido en app Fan ID. **Ordenó notificar a 14.398 titulares y eliminar sus datos** |
| 2025-12-01 | FEF | 194.856,16 | Art. 68.1 (grave) | Íd., app Fan FEF |
| 2026-01-20 | LIGAPRO · RES-SPDP-ICS-2025-0005 | 95.502,63 | Art. 67.2 (leve) | **No implementar privacidad desde el diseño en tratamiento biométrico**. Medida correctiva: rediseñar la app en 1 mes |
| 2026-01-20 | FEF · RES-SPDP-ICS-2025-0006 | 194.469,85 | Art. 68.4 (grave) | **EIPD con «resultado cero»** que no reflejaba los riesgos reales |

**Tres lecturas:** (1) la autoridad sanciona al que *diseña* la aplicación, no solo al que la usa; (2) una plantilla de EIPD que arroje riesgo bajo con biometría es evidencia de incumplimiento; (3) la consecuencia de un consentimiento inválido es **borrar datos y notificar a todos los titulares** — en multi-tenant eso es un evento de continuidad de negocio.

---

## 2. Arquitectura: cuatro documentos, dos responsables

| Documento | Responsable | Audiencia y momento | Norma |
|---|---|---|---|
| Términos y Condiciones | (relación contractual) | Cliente — pantalla A3 | LODC Arts. 41-43; Ley 67 Arts. 46, 48-50 |
| Política de Privacidad de Vivaru | **Qintilab S.A.S.** | Cliente — pantalla A2. Cubre datos de cuenta, facturación, soporte, telemetría | LOPDP Art. 12 |
| Anexo de Tratamiento de Datos (DPA) | El conjunto/administradora | Cliente — pantalla A3. Es el contrato de encargo | LOPDP Art. 34; RGLOPDP Art. 41; Res. SPDP-SPD-2025-0006-R |
| Aviso de Privacidad del Conjunto | **El conjunto/administradora** | Residentes, portería, visitantes — B1, B2, G1. **Vivaru solo lo exhibe** | LOPDP Art. 12; RGLOPDP Art. 42 |

### 2.1 Frontera encargado / corresponsable

- **Riesgo:** RGLOPDP **Art. 43** — *«El encargado del tratamiento que, por cualquier causa, determine los fines y los medios del tratamiento, se considerará, para efectos de la Ley, responsable del tratamiento en lo que respecta a dicho tratamiento.»* Consecuencia: quedaría expuesto a los Arts. 67-68 (responsable) y no solo a los Arts. 69-70 (encargado).
- **Habilitante a favor:** RGLOPDP **Art. 42** — *«el encargado deberá asistir al responsable y realizar todas las acciones necesarias… para que el responsable pueda cumplir con esta obligación.»*
- **Cómo se construye la frontera (tres piezas, todas obligatorias):**
  1. El aviso se entrega como **plantilla editable**, no como texto fijo.
  2. El conjunto **completa, aprueba y publica** finalidades, plazos, base de legitimación y contacto (pantalla A4).
  3. El DPA recoge la **instrucción escrita**: *«El Responsable instruye al Encargado a exhibir, a través de la Plataforma, el aviso de privacidad y los textos de recogida de consentimiento cuyo contenido determina y aprueba el Responsable.»*

### 2.2 Regla de separación

**Los dos avisos no van en la misma pantalla.** El aviso de Vivaru (responsable de los datos de cuenta) y el aviso del conjunto (responsable de los datos de residentes y visitantes) son dos documentos, dos responsables, dos bases de legitimación y dos canales de ejercicio de derechos.

---

## 3. Audiencia A — El cliente (administradora o conjunto)

El alta es por autoservicio y la plataforma no controla quién se registra. Una **administradora profesional no es consumidor** bajo la LODC (Art. 1 de su Reglamento excluye a quien adquiere «en beneficio de sus clientes»); un **conjunto residencial probablemente sí lo es**. → El flujo se construye para el escenario más exigente y bifurca después.

### A1 — Identificación del tipo de cliente

Primera pantalla, antes de cualquier otra. Determina la versión contractual y queda registrada como declaración del cliente.

```copy
¿Cómo usarás Vivaru?

○  Administro conjuntos o edificios de terceros como actividad profesional
     Eres una administradora. Contratas Vivaru para prestar tu servicio a tus clientes.

○  Administro el conjunto o edificio donde vivo o del que soy parte
     Eres un conjunto o condominio que contrata para sí mismo.

Esta respuesta determina las condiciones contractuales que se te aplican.
Podrás cambiarla más adelante desde la configuración de tu cuenta.
```

**Efecto en el sistema:** opción 1 → términos B2B. Opción 2 → versión conforme a la LODC. Se guarda con sello de tiempo en el registro de aceptación.

### A2 — Datos de la cuenta y aviso de privacidad de Vivaru

Aquí **Qintilab es responsable**: los datos del administrador se recogen para su propia relación contractual. Como se obtienen directamente del titular, el Art. 12 LOPDP exige informar «de forma previa a este, es decir, en el momento mismo de la recogida del dato personal».

```copy
Sobre tus datos

Qintilab S.A.S., sociedad colombiana domiciliada en Bogotá D.C., es responsable del
tratamiento de los datos que nos entregas en este formulario. Los usamos para crear y
administrar tu cuenta, facturarte, darte soporte y cumplir obligaciones legales. Los
conservamos mientras tengas cuenta activa y [PLAZO] después de cerrarla.

Puedes acceder, rectificar, eliminar, oponerte, limitar el tratamiento, portar tus datos
y no ser objeto de decisiones automatizadas escribiendo a [CORREO DEL DELEGADO], o desde
Configuración › Mis datos. Si no te respondemos o no estás conforme, puedes reclamar ante
la Superintendencia de Protección de Datos Personales del Ecuador.

Nuestro apoderado especial en Ecuador es [NOMBRE], [DIRECCIÓN], [TELÉFONO], [CORREO].
Nuestro delegado de protección de datos es [NOMBRE], [CORREO].

Ver la política de privacidad completa  ›   |   Descargar en PDF  ↓
```

> **La primera capa no basta.** El Art. 12 LOPDP enumera **17 numerales** de información obligatoria, y se reporta criterio de la SPDP (Oficio SPDP-IRD-2026-0028-O, 26-01-2026) de que el deber es **integral, sin «reducción o selección discrecional»**. La primera capa puede resumir; los 17 deben estar accesibles en un clic desde la misma pantalla y **antes** de la acción afirmativa. El **Art. 5 RGLOPDP** añade un dato que el Art. 12 no lista: hay que informar **las medidas de protección a adoptarse**.

### A3 — Aceptación contractual

Cuatro reglas de construcción, todas verificables por producto:

| ID | Regla | Fundamento |
|---|---|---|
| REQ-01 | Texto íntegro **desplegable en la propia pantalla**, sin salir del flujo ni autenticarse | LODC Art. 41 prohíbe «remisiones a textos o documentos que, no siendo de conocimiento público, no se faciliten al consumidor previamente a la celebración del contrato» |
| REQ-02 | **Botón de descarga PDF** de cada documento, disponible ANTES del botón de aceptar | Es lo que convierte una remisión en una entrega |
| REQ-03 | Fuente mínima **10 puntos**, en los términos **y en todos los documentos enlazados** | LODC Art. 41 y Art. 38 de su Reglamento General. Los textos significativamente más pequeños «se entenderán como no escritos» |
| REQ-04 | Todo en **castellano**, sin anexos en inglés | LODC Art. 42: las cláusulas que lo incumplan «no producirán efecto alguno respecto del consumidor» |

**Casillas — ninguna premarcada** (RGLOPDP Art. 5: «el silencio o la inacción, por sí solos, no presumen el consentimiento»; Ley 67 Art. 46: «la recepción, confirmación de recepción, o apertura del mensaje de datos, no implica aceptación del contrato electrónico»).

```copy
☐   He leído y acepto los Términos y Condiciones (versión [X.Y]) y el Anexo de
    Tratamiento de Datos Personales (versión [X.Y]).

☐   Acepto expresamente someter a arbitraje las controversias que surjan de este contrato,
    ante el Centro de Arbitraje y Mediación de la Cámara de Comercio de Quito, con sede en
    Quito, en derecho, con árbitro único y en idioma español, renunciando a la jurisdicción
    ordinaria. Esta aceptación es voluntaria y separada de la anterior.

☐   Acepto recibir por medios electrónicos la información y los documentos de esta relación
    contractual. Tienes derecho a recibirlos en papel, a retirar esta aceptación en cualquier
    momento desde Configuración › Comunicaciones, y a solicitar copia impresa escribiendo a
    [CORREO], sin costo. Para acceder a los documentos electrónicos necesitas un navegador
    actualizado y un lector de PDF.

[ Crear mi cuenta ]
```

> **Casilla 2 — por qué separada.** LODC Art. 43.4 declara nulas las cláusulas que impongan arbitraje obligatorio «salvo que el consumidor manifieste de manera expresa su consentimiento». El **Art. 40 del Reglamento a la LODC** precisa que puede manifestarse «con una señalización en un casillero, de la que se desprenda la aceptación para someterse a arbitraje» — el reglamento ecuatoriano **valida el checkbox de forma explícita**. Lo que no valida es una casilla única agrupada: con ella es imposible acreditar consentimiento expreso *diferenciado*. **Si el cliente no la marca, la cuenta se crea igual y la cláusula arbitral no le aplica.**

> **Casilla 3 — la que casi nadie pone.** Ley 67 **Arts. 48 y 49** exigen informar, antes del consentimiento: (a) equipos y programas necesarios; (b) derecho a recibir la información en papel; (c) derecho a retirar ese consentimiento y sus consecuencias; (d) procedimiento para retirarlo y para actualizar la información; (e) procedimiento y **costo** de obtener copia impresa. Si el costo es cero, hay que decirlo.

### A4 — Configuración del tratamiento por el responsable

Esta pantalla es la que mantiene a Qintilab en el papel de encargado. El cliente, como responsable, define el contenido sustantivo que la plataforma luego exhibirá.

```copy
Configura el tratamiento de datos de tu conjunto

Tu conjunto es el responsable del tratamiento de los datos de residentes, personal y
visitantes. Vivaru los trata únicamente siguiendo tus instrucciones. Necesitamos que
definas lo siguiente para poder mostrar a tus residentes el aviso correcto.

Identificación del responsable
   Denominación: [__________]        RUC: [__________]
   Domicilio: [__________]           Teléfono: [__________]     Correo: [__________]
   ¿Tienen delegado de protección de datos registrado ante la SPDP?  ○ Sí  ○ No  ○ En trámite
   Si es Sí:  Nombre [______]   Correo [______]   Teléfono [______]

Finalidades del tratamiento  (marca las que apliquen)
   ☐ Administración de alícuotas, estados de cuenta y cobros
   ☐ Control de acceso al conjunto
   ☐ Gestión de solicitudes, quejas y reclamos
   ☐ Reserva de áreas comunes
   ☐ Gestión de correspondencia y paquetería
   ☐ Otra: [__________]

Plazos de conservación
   Registros de acceso y visitas: [__] días     Comprobantes y estados de cuenta: [__] años
   Imágenes de videovigilancia:   [__] días     Solicitudes y reclamos:            [__] años
   Justificación del plazo elegido: [texto libre — OBLIGATORIO]
```

> **Por qué el plazo se pide y no se fija.** No existe en Ecuador norma que fije plazos uniformes de conservación para videovigilancia o registros de acceso, y la propia SPDP lo reconoce, exigiendo que cada responsable documente el plazo **motivadamente** bajo necesidad y proporcionalidad. Un valor por defecto puesto por Vivaru sería una decisión sobre medios y fines (→ PROH-06). Sugerir un valor de referencia es admisible; imponerlo, no.

### A5 — Compuerta de módulos sensibles

Biometría, LPR, geolocalización y videovigilancia vienen **desactivados de fábrica** y se activan solo mediante compuerta explícita.

```copy
⚠  Estás activando el reconocimiento facial en garita

En Ecuador, los datos biométricos son datos sensibles (Art. 4 de la LOPDP). Su tratamiento
está prohibido salvo que cuentes con el consentimiento explícito de cada persona (Art. 26,
literal a). No puedes ampararlo en el interés legítimo.

Para activar este módulo debes confirmar que:
   ☐ Realizaste la evaluación de impacto previa exigida por el Art. 42 de la LOPDP.
   ☐ Designaste y registraste un delegado de protección de datos ante la SPDP.
   ☐ Mantendrás siempre disponible el ingreso alternativo sin biometría ni foto,
     para quien no consienta.
   ☐ Entiendes que tu conjunto, como responsable, responde ante la autoridad por
     este tratamiento.

Vivaru activará automáticamente la vía de ingreso alternativa y el texto de consentimiento
explícito en garita.

[ Cancelar ]      [ Activar reconocimiento facial ]
```

**El sistema registra** quién activó el módulo, cuándo, desde qué IP y con qué confirmaciones. Ese registro es la prueba de que la decisión fue del responsable.

### A6 — Kit de cumplimiento del responsable

Entregables descargables al cierre del alta:

1. **EIPD base** pre-diligenciada con el riesgo real de los módulos activados, para que el responsable complete, apruebe y firme.
2. **RAT del conjunto**, generado desde A4, con los 9 campos del Art. 38 RGLOPDP y los 6 adicionales del Art. 15 Res. 2026-0005-R.
3. **Señalética de garita y áreas comunes**, generada con los datos del responsable, lista para imprimir.
4. **Plantilla de evaluación de ponderación** de interés legítimo para control de accesos no biométrico, editable.
5. **Textos de consentimiento explícito** para los módulos sensibles activados.

> **Advertencia sobre la plantilla de EIPD.** La FEF fue sancionada con USD 194.469,85 por una EIPD con «resultado cero». Una plantilla que arroje «riesgo bajo» teniendo biometría, menores y gran escala en la ecuación no protege a nadie: es evidencia de incumplimiento para el cliente e imputación de falta de privacidad desde el diseño para Qintilab. **La plantilla debe arrojar riesgo alto cuando el riesgo es alto.**

---

## 4. Audiencia B — Los usuarios finales

Como el administrador carga el padrón, los residentes son **titulares cuyos datos no se obtuvieron de ellos**.

> **LOPDP Art. 12, inciso 3:** *«Cuando los datos personales no se obtuvieren de forma directa del titular o fueren obtenidos de una fuente accesible al público, el titular deberá ser informado dentro de los siguientes treinta (30) días o al momento de la primera comunicación con el titular, cualquiera de las dos circunstancias que ocurra primero.»*

En este flujo la primera comunicación es **siempre la invitación**, que se envía en minutos → **los 30 días son irrelevantes**: el aviso completo debe viajar en la invitación misma. Además se activa el **numeral 6 del Art. 12 (origen de los datos)**, que en un alta directa no aplicaría.

### B1 — Correo o mensaje de invitación

```copy
Asunto: [NOMBRE DEL CONJUNTO] te dio acceso a Vivaru

Hola [NOMBRE]:

La administración de [NOMBRE DEL CONJUNTO] te creó una cuenta en Vivaru, la plataforma
que usa para la administración del conjunto.

Sobre tus datos personales
Tus datos los entregó la administración de [NOMBRE DEL CONJUNTO] a partir de
[ORIGEN: padrón de copropietarios / registro de arrendatarios / escrituras].
[NOMBRE DEL CONJUNTO] es el responsable del tratamiento. Qintilab S.A.S., que opera Vivaru,
actúa como encargado y trata tus datos solo siguiendo las instrucciones del conjunto.

Se tratan tus datos de identificación, contacto, unidad, estado de cuenta y registros de
acceso, para [FINALIDADES CONFIGURADAS POR EL RESPONSABLE], con base en [BASE DE
LEGITIMACIÓN], y se conservan [PLAZOS]. Tus datos se alojan en la infraestructura de
Google LLC en [REGIÓN], y se transfieren a Colombia y a Estados Unidos con las garantías
que se explican en el aviso completo.

Puedes acceder, rectificar, eliminar, oponerte, limitar el tratamiento, portar tus datos y
pedir revisión humana de decisiones automatizadas, en cualquier momento, desde la propia
aplicación o escribiendo a [CORREO DEL RESPONSABLE]. Si no te responden, puedes reclamar
ante la Superintendencia de Protección de Datos Personales.

Leer el aviso de privacidad completo  ›     Descargar en PDF  ↓

[ Activar mi cuenta ]
```

**El sistema debe registrar** el envío, el contenido exacto y la versión del aviso incluido. El Art. 12 exige que la información se transmita «de cualquier modo comprobable»; sin registro, no es comprobable.

### B2 — Primer acceso

Se repite el aviso con **atribución visible del responsable**, separado de cualquier aviso de Vivaru.

```copy
Responsable del tratamiento: [NOMBRE DEL CONJUNTO], RUC [___], [DIRECCIÓN],
                             [TELÉFONO], [CORREO].
Delegado de protección de datos del responsable: [NOMBRE], [CORREO], [TELÉFONO].
Encargado del tratamiento: Qintilab S.A.S. (Colombia), que opera la plataforma Vivaru
                           por cuenta e instrucción del Responsable.
Apoderado especial del Encargado en Ecuador: [NOMBRE], [DIRECCIÓN], [TELÉFONO], [CORREO].
```

> **No pedir consentimiento aquí.** El residente no puede negarse al padrón del conjunto sin perder el servicio → el consentimiento no sería libre y sería **nulo** por el Art. 8.1. La base correcta es el Art. 7.5 o el 7.8. Pedir consentimiento donde no corresponde **crea una base de legitimación inválida y contamina todo el tratamiento**.

### B3 — Consentimientos genuinamente opcionales

Art. 8 exige especificidad «en cuanto a la determinación concreta de los medios y fines» y, ante pluralidad de finalidades, que conste que se otorga para todas ellas → **una casilla por finalidad** (permite además revocación parcial).

```copy
☐  Quiero recibir avisos de la administración por WhatsApp además de por correo.
☐  Autorizo que mi nombre y unidad se muestren en el directorio interno del conjunto.
☐  Autorizo que mi foto se use para identificarme en el control de acceso.  ⚠ dato sensible

Puedes retirar cualquiera de estas autorizaciones en cualquier momento desde
Mi perfil › Privacidad, con un clic y sin dar explicaciones.
```

> **Forma de la revocación.** Art. 8 LOPDP: mecanismos que garanticen «celeridad, eficiencia, eficacia y gratuidad, así como un procedimiento sencillo, **similar al proceder con el cual recabó el consentimiento**». Si se recogió con un clic en la app, se retira con un clic en la app. **Un formulario por correo no cumple.**

---

## 5. Garita y visitantes

Punto de mayor exposición del producto. Conviven tres regímenes distintos que **no pueden tratarse con un mismo texto**.

### G1 — Cartel de primera capa

La SPDP ha sostenido que la señalética satisface el deber de información mediante esquema por capas, y que la primera capa debe contener: existencia del tratamiento, identidad y contacto del responsable, canales de ejercicio de derechos, y remisión a la información completa. **Vivaru genera este cartel automáticamente por tenant** desde los datos de A4.

```copy
ZONA VIDEOVIGILADA

Este acceso cuenta con videovigilancia y registro de visitantes, con la finalidad de
seguridad de personas y bienes.

Responsable: [NOMBRE DEL CONJUNTO] · RUC [___] · [DIRECCIÓN] · [TELÉFONO] · [CORREO]

Puedes ejercer tus derechos de acceso, rectificación, eliminación y oposición escribiendo
a [CORREO] o en [URL CORTA].

Información completa: [URL CORTA]        [ CÓDIGO QR ]
```

### G2 — Flujo del visitante

Dos vías, **al mismo nivel jerárquico**. Que la vía alternativa exista pero esté escondida es funcionalmente idéntico a que no exista.

```copy
Registro de visita — [NOMBRE DEL CONJUNTO]

Vía 1 — Ingreso con verificación facial   (más rápido)

   Para usar esta vía necesitamos tu autorización expresa.

   Tu rostro es un dato personal sensible. [NOMBRE DEL CONJUNTO] lo usaría únicamente para
   verificar tu identidad al ingresar y al salir, y lo conservaría [__] días. No se comparte
   con nadie más ni se usa para otra cosa. Puedes retirar esta autorización en cualquier
   momento en [URL CORTA].

   ☐  Autorizo expresamente el tratamiento de mi imagen facial para verificar mi identidad
      al ingresar.

Vía 2 — Ingreso sin foto ni datos biométricos

   Registramos tu nombre y número de documento, y avisamos al residente que te espera.
   Se conservan [__] días. Puedes ingresar por esta vía sin dar ninguna autorización adicional.

   [ Continuar sin foto ]
```

### G3 — Canal de derechos para quien no es usuario

Res. 0041 **Art. 15.1** exige incluir «mecanismos claros, accesibles y gratuitos» para que el titular ejerza sus derechos. El visitante **no tiene cuenta** en Vivaru y probablemente nunca la tendrá.

**Requisito:** URL pública **por tenant**, alcanzable desde el QR del cartel, donde cualquier persona pueda solicitar acceso, rectificación, eliminación u oposición **sin autenticarse**. RGLOPDP Art. 12 refuerza: el responsable habilitará «herramientas o canales informáticos simplificados de fácil acceso».

---

## 6. M1 — Menores: el flujo que hoy no existe

> **LOPDP Art. 21** es una **prohibición**: *«no se podrán tratar datos sensibles o datos de niñas, niños y adolescentes a menos que se cuente con la autorización expresa del titular o de su representante legal»*.
> **LOPDP Art. 24:** los adolescentes **≥15 años** ejercen sus derechos de forma directa; **<15 años** y niños requieren representante legal.
> **Res. 0041 Art. 16.4:** prohíbe, como regla general, apoyar el tratamiento de datos de menores en el interés legítimo.

**Dónde está el riesgo para Qintilab y no para el conjunto:** un producto que permite cargar «miembros del hogar» con nombre, edad y foto sin flujo de autorización es un producto **sin privacidad desde el diseño** — la conducta exacta sancionada a LIGAPRO el 20-01-2026 bajo el Art. 67.2. El propietario que llena el padrón **no es representante legal del hijo del inquilino vecino**.

**Especificación mínima:**

1. Al cargar un miembro del hogar, **fecha de nacimiento obligatoria**. El sistema calcula la edad y bifurca.
2. **<15 años:** la cuenta queda en estado `pendiente_autorizacion`. Se envía al representante legal declarado una solicitud de autorización expresa con el aviso completo. **Sin autorización registrada, el perfil no se activa y sus datos no entran en ningún módulo.**
3. **15–17 años:** el propio adolescente consiente y ejerce derechos directamente. La invitación se le envía **a él**, no a su representante.
4. **En ningún caso** se captura foto facial ni biometría de menores (PROH-03).
5. El tratamiento sistemático de datos de NNA en entornos institucionales es **gran escala por calificación directa**.

---

## 7. Registro de aceptación

Sin esto, todo lo anterior es indemostrable. **RGLOPDP Art. 5:** el consentimiento *«deberá ser demostrado por el responsable que lo obtiene, cuando así sea requerido por la autoridad competente»*. La **Corte Nacional de Justicia** (Oficio 0120-AJ-P-CNJ-2021) exige acreditar autenticidad del origen, titularidad de la cuenta e integridad del mensaje.

| Campo | Contenido | Para qué |
|---|---|---|
| `aceptante` | Nombre, correo, id de cuenta, rol declarado (A1) | Titularidad de la cuenta |
| `timestamp` + `ip` | Fecha y hora con zona horaria; IP de origen | Autenticidad del origen |
| `documentos[]` | Por documento: `version` + `hash` del texto exhibido | Integridad; prueba de **qué se aceptó**, no de qué dice hoy el documento |
| `evidencia_exhibicion` | Registro de que el texto se desplegó en pantalla y de que la descarga estuvo disponible **antes** del clic | LODC Art. 41: «facilitado previamente» |
| `casillas{}` | Estado de cada casilla **por separado**, incluida la de arbitraje | Consentimiento expreso y diferenciado |
| `copia_enviada` | Constancia del envío al correo del PDF de la versión exacta aceptada | LODC Art. 41, inciso 3 — derecho a copia |

> **Congelar versiones no es preferencia técnica: evita una nulidad.** Si el enlace apunta siempre a «la versión vigente», el cliente aceptó un texto que ya no existe. Doblemente atacable: LODC Art. 41 (remisión a texto no facilitado) y Art. 43.5 (variación unilateral de condiciones). **Cada versión se congela por aceptación y cada versión nueva se re-acepta.** Ese mecanismo de re-aceptación es además lo único que permitirá migrar a clientes ya firmados cuando cambie el DPA.

**Forma de la firma:** **no** se requiere firma electrónica certificada. Ley 67 Art. 2 equipara los mensajes de datos a los documentos escritos y el Art. 45 impide negar validez a un contrato formado por ellos. Lo que se requiere es el registro auditable de arriba, más disponibilidad del soporte informático y de la transcripción en papel para juicio (Art. 54).

---

## 8. Obligaciones propias de Qintilab

No se cumplen mostrando textos al cliente. Res. 2026-0005-R **Arts. 13-15** las imputan directamente al encargado con «acceso, visibilidad o control efectivo».

| ID | Obligación | Norma |
|---|---|---|
| Q-01 | **RAT propio** del encargado, con los 9 campos del Art. 38 y los 6 adicionales del Art. 15 Res. 2026-0005-R | RGLOPDP Art. 44; Art. 39.2 (basta que el tratamiento no sea ocasional) |
| Q-02 | **DPD propio**, distinto del apoderado especial | Res. 2026-0005-R Art. 12.2 (gran escala); Res. 2025-0028-R Art. 16.3 |
| Q-03 | **Evidencia técnica, no declaraciones**: cifrado de plantillas, segregación por tenant, control por rol, supresión automática por retención | LOPDP Art. 47; precedente LIGAPRO (Art. 67.2) |
| Q-04 | **Plantilla biométrica cifrada, no imagen cruda** | Dirección del proyecto de norma biométrica; reduce el impacto de una brecha |
| Q-05 | **Autorización previa y escrita del responsable por cada sub-encargado** (Google, servicios de reconocimiento facial, CDN) | Res. SPDP-SPD-2025-0006-R, Anexo I §2.4. El encargado sigue «plenamente responsable» por el subencargado |
| Q-06 | Notificar al responsable **brechas** y **solicitudes de derechos** en **término de 2 días** | LOPDP Art. 43; Res. 2025-0006-R |
| Q-07 | Declarar **nominalmente** en el DPA que el tratamiento alcanza datos sensibles, biométricos y de NNA | Res. 2025-0006-R, Anexo I §1.2 |

---

## 9. Antipatrones

| No hacer | Por qué |
|---|---|
| Una sola casilla que agrupe términos + privacidad + arbitraje | Imposibilita acreditar el consentimiento expreso diferenciado del Art. 43.4 LODC |
| Casillas premarcadas o consentimiento por seguir navegando | RGLOPDP Art. 5; Ley 67 Art. 46 |
| Enlazar la política solo desde el pie de página | LODC Art. 41 — la cláusula se tiene por no escrita |
| Enlace que apunta siempre a «la versión vigente» | LODC Arts. 41 y 43.5 |
| Pedir consentimiento al residente para el servicio básico | No es libre → nulo (Art. 8.1). Base correcta: Art. 7.5 o 7.8 |
| Apoyar la biometría en interés legítimo | Res. 0041 Art. 16.1 y LOPDP Art. 26 |
| Activar biometría, LPR o geolocalización por defecto | Determina fines y medios → corresponsabilidad (RGLOPDP Art. 43) |
| Fijar retención por defecto no modificable | Misma razón |
| Grabar audio en garita | Res. 0041 Art. 15, párrafo final |
| Plantilla de EIPD que arroje riesgo bajo | Costó a la FEF USD 194.469,85 |
| Analítica o entrenamiento sobre datos identificables de residentes | Determina fines propios → Vivaru pasa a responsable |
| Anexos en inglés | LODC Art. 42 |

---

## 10. Matriz de verificación

| ID | Requisito | Norma | Dónde se cumple |
|---|---|---|---|
| REQ-05 | Información previa al titular, 17 numerales | LOPDP Art. 12; RGLOPDP Art. 5 | A2, B1 — documento completo enlazado y descargable |
| REQ-06 | Información cuando los datos no vienen del titular | LOPDP Art. 12, inciso 3 | B1 — el aviso viaja en la invitación |
| REQ-07 | Origen de los datos | LOPDP Art. 12, numeral 6 | B1 |
| REQ-08 | Consentimiento libre, específico, informado, inequívoco | LOPDP Art. 8; RGLOPDP Art. 5 | B3, G2 — una casilla por finalidad |
| REQ-09 | Consentimiento **explícito** para datos sensibles | LOPDP Art. 26.a | G2 vía 1, con alternativa disponible |
| REQ-10 | Revocación tan sencilla como la aceptación | LOPDP Art. 8, inciso 2 | Mi perfil › Privacidad, un clic |
| REQ-11 | Autorización del representante legal de menores | LOPDP Arts. 21 y 24 | M1 |
| REQ-12 | Señalética de videovigilancia por capas | Res. 0041 Art. 15; criterio SPDP | G1 — generada por tenant |
| REQ-13 | Canal gratuito de derechos para no usuarios | Res. 0041 Art. 15.1; RGLOPDP Art. 12 | G3 — URL pública con QR |
| REQ-14 | EIPD previa al inicio del tratamiento | LOPDP Art. 42.b | A5 (compuerta) y A6 (kit) |
| REQ-15 | Delegado de protección de datos | Res. 2026-0005-R Art. 12.2 | Del conjunto en A4; de Qintilab, Q-02 |
| REQ-16 | Registro de actividades de tratamiento | RGLOPDP Arts. 38, 39, 44; Res. 2026-0005-R Art. 15 | Generado en A6; propio en Q-01 |
| REQ-17 | Texto facilitado previamente y en castellano | LODC Arts. 41-42; Regl. LODC Art. 38 | A3 — REQ-01 a REQ-04 |
| REQ-18 | Consentimiento expreso al arbitraje | LODC Art. 43.4; Regl. LODC Art. 40 | A3, casilla 2 |
| REQ-19 | Información sobre medios electrónicos | Ley 67 Arts. 48-49 | A3, casilla 3 |
| REQ-20 | Derecho a copia del contrato | LODC Art. 41, inciso 3 | PDF enviado tras la aceptación |
| REQ-21 | Prueba de la aceptación | Ley 67 Arts. 8, 52, 54; COGEP Art. 202 | Sección 7 |

---

## 11. DOBLE VALIDACIÓN contra `brieflegalecuador.md`

Contraste entre lo que este flujo requiere y lo que el brief técnico declara sobre el sistema real. **Catorce hallazgos.** Severidad: `ALTA` bloquea el lanzamiento en Ecuador; `MEDIA` debe resolverse antes de escalar; `BAJA` es dato faltante o precisión.

### V-01 · ALTA · El inventario de datos del brief está desactualizado

**Brief §1** lista diez categorías de datos: identificación, contacto, unidad, estados de cuenta y pagos, comprobantes, registros de acceso y visitas, paquetería, PQRS, reservas de zonas comunes y datos de navegación. **Ninguna es biometría, foto, placas, geolocalización ni videovigilancia.**

Ese inventario es el insumo del RAT, de la política de privacidad y del DPA. Si los documentos legales se construyen sobre él, **nacen incompletos**, y precisamente omitiendo la categoría que dispara la calificación de gran escala automática y la prohibición del interés legítimo.

**Acción:** actualizar §1 del brief antes de redactar cualquier documento legal. Es prerrequisito de todo lo demás.

### V-02 · ALTA · «Tres perfiles» no alcanzan para el tratamiento diferenciado

**Brief §5**: *«Acceso por rol | Tres perfiles + reglas»*. El flujo especificado requiere distinguir al menos seis sujetos con tratamiento jurídico distinto:

| Sujeto | Base de legitimación | Estado especial requerido |
|---|---|---|
| Administrador (cliente) | Contractual | — |
| Residente propietario | Art. 7.5 | — |
| Residente inquilino | Art. 7.5 | — |
| Personal de portería | Art. 7.5 laboral | Ver V-10 |
| Visitante | Art. 7.8 / Art. 26.a | **No es usuario**: es registro sin cuenta |
| Menor <15 años | Art. 21 | `pendiente_autorizacion` |

El visitante probablemente no es un perfil sino un registro, y el menor necesita un **estado** que tres perfiles no pueden expresar. Sin esa granularidad, el sistema no puede aplicar bases de legitimación distintas ni plazos de retención distintos por categoría de titular.

**Acción:** verificar en código qué son exactamente los tres perfiles y modelar visitante y menor antes de habilitar Ecuador.

### V-03 · ALTA · No existe flujo de autorización del representante legal

Nada en el brief sugiere que exista. `privacidad.md` §12 «Menores de Edad» es **texto de política**, no flujo de producto. La sección 6 de esta especificación describe un flujo que hoy no está construido, y su ausencia es exactamente la conducta sancionada a LIGAPRO bajo el Art. 67.2 (falta de privacidad desde el diseño).

**Acción:** construir M1 antes del primer cliente ecuatoriano. Es desarrollo, no redacción.

### V-04 · ALTA · El borrado manual no sostiene el derecho de eliminación

**Brief §5**: *«Borrado definitivo y certificado | Implementado como procedimiento»* — es decir, manual, en el propio vocabulario de la tabla del brief.

Un procedimiento manual no puede sostener: (a) el derecho de eliminación del Art. 15 con plazo de atención de 15 días, ejercitable individualmente y a escala; ni (b) la **supresión automática por vencimiento del plazo de retención** que exige la pantalla A4, donde cada tenant configura plazos distintos por categoría de dato.

**Acción:** automatizar la purga por retención y el borrado individual. Sin esto, A4 promete una configuración que el sistema no ejecuta — el mismo patrón de desajuste contrato/sistema que el brief ya autoreporta en §5.

### V-05 · ALTA · La suspensión por mora bloquea derechos irrenunciables

Hallazgo nuevo, que surge de cruzar el brief con el régimen ecuatoriano y **no aparece en ninguno de los dos documentos por separado**.

**Brief §5**: el estado `suspended` deja el conjunto en **solo lectura** (`assertTenantOperable`), y la suspensión se activa por falta de pago.

**LOPDP Art. 24, párrafo final:** *«Los derechos del titular son irrenunciables. Será nula toda estipulación en contrario.»* Los derechos del residente **no dependen de que su administrador pague la suscripción**. Un tenant en solo lectura donde un residente no puede eliminar sus datos, rectificarlos ni ejercer portabilidad convierte un mecanismo comercial de cobro en un **incumplimiento de la LOPDP imputable a Qintilab** — que es quien opera el interruptor.

**Acción:** `assertTenantOperable` debe exceptuar los flujos de ejercicio de derechos. Un tenant suspendido conserva: acceso, rectificación, eliminación, oposición, limitación, portabilidad y el canal público G3. La suspensión afecta la operación del negocio del cliente, nunca los derechos de los titulares.

### V-06 · MEDIA · `auditLogs` no es el registro de aceptación

**Brief §5**: *«Registro de operaciones sensibles | Colección `auditLogs`»*. Es un artefacto distinto del registro de la sección 7, que necesita campos que un log de operaciones no tiene: versión y hash del documento exhibido, evidencia de exhibición previa al clic, estado por casilla, y constancia de envío de la copia.

**Acción:** no asumir que `auditLogs` cubre el requisito. Diseñar una colección de aceptaciones y consentimientos separada, inmutable y versionada.

### V-07 · MEDIA · Exportación a 90 días ≠ derecho de portabilidad

**Brief §5 y `datos.md` §10.2**: exportación durante 90 días tras cancelar. Eso es **offboarding del cliente**. La portabilidad del Art. 17 LOPDP es un **derecho individual del titular**, ejercitable en cualquier momento, sobre sus propios datos, en formato estructurado y compatible — no un volcado del tenant al cancelar.

**Acción:** son dos funcionalidades. La segunda no existe y el Ecuador la exige (a diferencia de Colombia, que no consagra portabilidad).

### V-08 · MEDIA · La cláusula de asistencia en derechos está subdimensionada

**Brief §3.2**: `datos.md` §5.7 asiste en derechos de Habeas Data (Colombia) o ARCO (México). El catálogo ecuatoriano añade **portabilidad (Art. 17), limitación (Art. 19), no ser objeto de decisiones automatizadas (Art. 18) y derecho a explicación (Art. 20)**.

La obligación de asistencia debe cubrir el catálogo completo, y el producto debe poder prestarla: la asistencia contractual sin la funcionalidad detrás es una promesa incumplible.

### V-09 · MEDIA · El canal público de derechos rompe el aislamiento por tenant

**Brief §1**: *«Cada conjunto opera aislado»*. **Brief §5**: aislamiento por reglas de Firestore.

El requisito G3 exige una **superficie pública, por tenant, sin autenticación**, donde un visitante que no tiene cuenta pueda ejercer derechos. Eso es lo contrario del modelo actual y abre superficie de ataque y de fuga: un endpoint público que responde por tenant es también un oráculo de enumeración de conjuntos y, mal diseñado, de residentes.

**Acción:** diseñar G3 con identificador de tenant opaco (no adivinable), sin devolver información antes de verificar la identidad del solicitante, y con límite de tasa. La verificación de identidad del solicitante es a su vez un tratamiento que debe minimizarse.

### V-10 · MEDIA · El personal de portería es trabajador, y eso cambia el régimen

**Brief §1** lista al personal de portería como categoría de titular. **Res. 0041 Art. 15, párrafo final** prohíbe expresamente usar la videovigilancia «para fines de supervisión, de control del desempeño laboral».

Si la cámara de garita filma al conserje durante todo su turno **y** la plataforma registra sus acciones con marca de tiempo, existe una dimensión de monitoreo laboral que ni el brief ni la versión anterior de esta especificación consideraron. El riesgo no es teórico: la norma la califica como «afectación ilegítima a los derechos de intimidad y libertad de expresión… además de contraria a la protección de los datos personales de los trabajadores».

**Acción:** evaluar qué registros de actividad de portería son necesarios para la seguridad y cuáles son, de hecho, control de desempeño. Documentarlo en la ponderación. No exponer al administrador reportes de productividad del conserje construidos sobre datos de videovigilancia.

### V-11 · MEDIA · Los datos de navegación no están tratados en ninguna parte

**Brief §1** los lista como categoría. Ni el brief ni esta especificación los cubren: no hay banner de cookies, ni distinción entre cookies necesarias y analíticas, ni base de legitimación declarada para la analítica.

**Acción:** completar. Es un hueco propio de esta especificación, no del brief.

### V-12 · BAJA · La región de alojamiento de Google no está declarada

**Brief §1**: *«Los datos residen en la infraestructura de Google»*. El texto de B1 dice «[REGIÓN]» porque el dato no consta. El Registro Nacional de Transferencias Internacionales exige identificar el **país de destino**, y la inscripción es requisito de licitud de la transferencia (Res. 2026-0004-R Art. 65).

**Acción:** confirmar la región de Firebase/GCP y declararla nominalmente en la política, en el DPA y en el registro.

### V-13 · BAJA · El aislamiento por tenant no es una frontera legal

**Brief §1**: «Cada conjunto opera aislado». Es un control de seguridad correcto, pero puede crear falsa tranquilidad: la calificación de Qintilab como tratamiento a gran escala se mide **en agregado**, porque tiene «acceso, visibilidad o control efectivo» sobre toda la plataforma (Res. 2026-0005-R, Disposición General Segunda). El aislamiento protege a los tenants entre sí; no reduce las obligaciones del encargado.

### V-14 · CONFIRMACIÓN · Los dos desajustes del brief siguen vigentes y ahora tienen agravante

El **brief §5** autoreporta dos discrepancias contrato/sistema. Bajo la LODC ambas empeoran:

1. **«El acceso queda inhabilitado» vs. solo lectura.** El brief lo califica de riesgo bajo porque el cliente recibe más de lo prometido. Correcto en Colombia. En Ecuador, ante un conjunto residencial consumidor, describir en el contrato una consecuencia que no ocurre es información inexacta sobre las condiciones del servicio, y el **Art. 43.6 LODC** declara nula la suspensión unilateral salvo incumplimiento imputable. Redactar la cláusula describiendo lo que el sistema realmente hace, condicionado a mora efectivamente notificada.
2. **La escalera de mora no la ejecuta ningún proceso automático.** El brief lo ve como riesgo de letra muerta. Bajo la LODC hay un riesgo opuesto y mayor: una suspensión discrecional, ejercida por decisión humana sin criterio objetivo documentado, es **más** atacable que una automática. O se automatiza con notificación previa registrada, o se redacta como facultad sujeta a preaviso e incumplimiento acreditado.

### 11.1 Resumen de la validación

| Severidad | Hallazgos | Efecto |
|---|---|---|
| ALTA | V-01, V-02, V-03, V-04, V-05 | Bloquean el lanzamiento en Ecuador. Cuatro son **desarrollo**, no redacción |
| MEDIA | V-06, V-07, V-08, V-09, V-10, V-11 | Resolver antes de escalar |
| BAJA | V-12, V-13 | Dato faltante o precisión conceptual |
| Confirmación | V-14 | Ya identificado por el brief; se agrava bajo la LODC |

**Conclusión de la validación:** el brief describe un sistema construido para un régimen bilateral Colombia/México. De los cinco hallazgos de severidad alta, **cuatro requieren cambios de producto** (modelo de roles, flujo de menores, borrado automatizado, excepción de derechos en tenant suspendido) y solo uno es documental (inventario de datos). La conclusión de la primera revisión se mantiene y se refuerza: **Ecuador no es un tercer carril documental, es una diferencia de producto.**

---

## 12. Pendientes antes de publicar

- [ ] **Validación de todos los textos `copy` por el abogado patrocinador.** Son borradores técnicamente fundados, no textos aprobados.
- [ ] Definir los **plazos de retención** por categoría de dato. Son campo obligatorio de A4 y no pueden salir en blanco.
- [ ] Confirmar la **región de alojamiento** de Google (V-12).
- [ ] Actualizar el **inventario de datos** del brief con biometría, placas, geolocalización y videovigilancia (V-01).
- [ ] **Consulta formal a la SPDP** sobre tratamiento de datos de visitantes en propiedad horizontal. Verificado: **no existe ningún criterio, guía ni consulta atendida** sobre propiedad horizontal, garitas, registro de visitantes ni lectura de placas. Reglamento de consultas reformado por Res. 2026-0020-R.
- [ ] **Solicitud de acceso a la información pública** a la SPDP por el texto íntegro de las resoluciones sancionatorias contra LIGAPRO y la FEF. Es el precedente más valioso disponible sobre consentimiento en apps con biometría y no está publicado en fuente abierta.
- [ ] Vigilar la expedición de la **Norma General para el Tratamiento de Datos Biométricos**. Sigue en proyecto; de expedirse, aplicará **directamente a encargados** con 9 meses de transición.

---

## 13. Fuentes normativas citadas

| Norma | Identificación |
|---|---|
| LOPDP | Ley Orgánica de Protección de Datos Personales, R.O. Suplemento 459, 26-05-2021 |
| RGLOPDP | Reglamento General a la LOPDP, Decreto Ejecutivo 904, 13-11-2023 |
| Res. 2025-0003-R | Guía de gestión de riesgos y evaluación de impacto, 29-04-2025 |
| Res. 2025-0006-R | Cláusulas de protección de datos en contratos celebrados en Ecuador, 30-04-2025 |
| Res. 2025-0022-R | Cálculo de multas por infracciones leves y graves, 16-07-2025 |
| Res. 2025-0028-R | Reglamento del Delegado de Protección de Datos, 30-07-2025 |
| Res. 2025-0041-R | Normativa general para la aplicación del interés legítimo, 07-11-2025 · R.O. 1er Sup. 177, 03-12-2025 |
| Res. 2026-0004-R | Norma general de transferencias nacionales e internacionales, 28-01-2026 |
| Res. 2026-0005-R | Norma general sobre tratamiento de datos personales a gran escala, 02-02-2026 |
| Res. SPDP-SPDP-2024-0002-R | Registro de apoderados especiales de responsables y encargados extranjeros, 06-09-2024 · R.O. 640, 10-09-2024 |
| LODC | Ley Orgánica de Defensa del Consumidor, Ley 2000-21 (reforma integral **no vigente**: primer debate 08-05-2025) |
| Regl. LODC | Reglamento General a la LODC, Decreto Ejecutivo 1314, R.O. 287, 19-03-2001 |
| Ley 67 | Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos, R.O. Sup. 557, 17-04-2002 |
| COGEP | Código Orgánico General de Procesos |
| Proyecto biométricos | Proyecto de Norma General para el Tratamiento de Datos Biométricos — **NO VIGENTE**, consulta pública 31-03 a 28-04-2026 |
