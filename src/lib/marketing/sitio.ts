/**
 * Hechos del sitio, en un solo lugar.
 *
 * Los alimenta a la vez el `sitemap.xml`, los datos estructurados y el
 * `llms.txt`. Tenerlos duplicados es cómo se acaba declarando una cosa a Google
 * y otra distinta a un modelo de lenguaje, y nadie se entera.
 */

/**
 * OJO: con `www`, y no es un detalle de estilo.
 *
 * El dominio raíz `grupovivaru.com` devuelve **404** —App Hosting solo tiene
 * configurado el subdominio, y el apex no redirige—. `metadataBase` apuntaba
 * ahí, así que todas las URL absolutas que Next generaba para Open Graph y
 * canónicas señalaban a un dominio roto.
 *
 * Cuando se configure el apex con una redirección 301 al `www`, esto puede
 * quedarse igual: el canónico debe seguir siendo el dominio que sirve.
 */
export const URL_SITIO = "https://www.grupovivaru.com";

/**
 * El bloque Open Graph de una ruta.
 *
 * Existe por una trampa de Next que cuesta cara y no avisa: **`openGraph` NO se
 * fusiona en profundidad.** Si el layout declara el bloque completo y una página
 * hija declara `openGraph: { url: "/" }` para corregir su URL, el objeto de la
 * página REEMPLAZA al del layout entero — y esa página se queda sin `og:image`,
 * sin `og:locale`, sin `og:site_name` y con una `og:description` inventada a
 * partir de la descripción normal.
 *
 * Pasó exactamente eso, y la víctima fue la home: la página que más se comparte
 * se quedó sin imagen de vista previa. Se detectó leyendo el HTML del build, no
 * el código — no lo marca ni el typecheck ni ningún test.
 *
 * Por eso el bloque se construye aquí y cada página declara el suyo entero con
 * su ruta. El layout ya NO lo declara: una página nueva que se olvide se queda
 * sin Open Graph, que es un fallo visible, en vez de heredar la URL de otra, que
 * es un fallo silencioso.
 */
export function openGraphDe(ruta: string) {
  return {
    title: "Software de administración de condominios y conjuntos | Vivaru",
    description:
      "Cartera, cuotas de mantenimiento, reservas, visitantes con QR, quejas y solicitudes (PQRS). Cada condominio opera aislado, con sus propios datos y accesos.",
    type: "website" as const,
    /*
     * `es_LA` (español de Latinoamérica) y no `es_MX`: la prosa del sitio ya no
     * apunta a un país, y este campo es una señal geográfica más. Es opcional en
     * Open Graph, así que si algún consumidor lo rechaza se puede quitar entero
     * sin perder nada. La lista exacta de países vive en `PAISES`.
     */
    locale: "es_LA",
    siteName: "Vivaru",
    url: ruta,
    images: [
      {
        url: "/og-vivaru.jpg",
        width: 1200,
        height: 630,
        alt: "Centro de control de Vivaru: cartera, recaudo y alertas de un condominio",
      },
    ],
  };
}

/** Rutas públicas indexables. Si se añade una página, va aquí. */
export const RUTAS_PUBLICAS = [
  { ruta: "/", prioridad: 1.0, frecuencia: "weekly" as const },
  { ruta: "/diagnostico", prioridad: 0.8, frecuencia: "monthly" as const },
  { ruta: "/legal/privacidad", prioridad: 0.3, frecuencia: "yearly" as const },
  { ruta: "/legal/terminos", prioridad: 0.3, frecuencia: "yearly" as const },
  { ruta: "/legal/datos", prioridad: 0.3, frecuencia: "yearly" as const },
];

/**
 * Preguntas frecuentes en TEXTO PLANO, para el marcado `FAQPage`.
 *
 * Están duplicadas respecto a `components/marketing/FAQ.tsx`, que las renderiza
 * con enlaces y por tanto no puede exportar texto plano sin arrastrar JSX. La
 * duplicación está cubierta por `tests/landing-contract.test.ts`, que falla si
 * los enunciados dejan de coincidir. Si cambias una pregunta, cámbiala en los
 * dos sitios.
 *
 * El marcado importa más de lo que parece: es el activo del sitio que un motor
 * de respuesta puede extraer y citar tal cual.
 */
export const PREGUNTAS_FRECUENTES: Array<{ pregunta: string; respuesta: string }> = [
  {
    pregunta: "¿Funciona para fraccionamientos de casas o solo edificios?",
    respuesta:
      "Sí. Vivaru opera sobre cualquier régimen de propiedad horizontal: condominios verticales (edificios), conjuntos cerrados, fraccionamientos, privadas y comunidades residenciales en general. Cada condominio se configura como un sistema independiente, sea de 50 casas o 300 departamentos.",
  },
  {
    pregunta: "¿Qué tan rápido entra en operación mi condominio?",
    respuesta:
      "Activación promedio de 72 horas hábiles desde la firma del contrato. El proceso de implementación tiene cuatro etapas: diagnóstico, configuración, piloto y go-live.",
  },
  {
    pregunta: "¿Necesito conectar mi cuenta bancaria o procesador de pagos?",
    respuesta:
      "No. Vivaru opera sin pasarela de pagos embebida. Los residentes suben su comprobante desde el teléfono y la administración lo concilia en el portal. Esto baja la barrera de adopción y elimina riesgos de integración bancaria.",
  },
  {
    pregunta: "¿Cómo se manejan los datos personales de mis residentes?",
    respuesta:
      "Vivaru cumple con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). El detalle está en la Política de Privacidad y en el Anexo de Tratamiento de Datos.",
  },
  {
    pregunta: "¿Qué pasa si quiero cancelar?",
    respuesta:
      "Se solicita al equipo comercial, que analiza y realiza la cancelación del servicio.",
  },
  {
    pregunta:
      "¿Soportan integración con CCTV, torniquetes o control de acceso por hardware?",
    respuesta:
      "En el modelo actual Vivaru no integra hardware de control físico (CCTV, torniquetes, lectores IP). Se enfoca en el flujo digital: visitantes con código QR, paquetería trazable y panel de portería. Si el conjunto tiene hardware existente, convive con él pero no se conecta.",
  },
];

/** Los módulos del producto, tal como los nombra la interfaz. */
export const MODULOS = [
  "Cartera y cuotas de mantenimiento",
  "Residentes y unidades",
  "Reservas de amenidades",
  "Visitantes con código QR",
  "Paquetería",
  "Quejas y solicitudes (PQRS)",
  "Comunicaciones",
  "Encuestas",
  "Egresos",
  "Libro y fondos",
  "Conciliación",
  "Reporte de comité",
  "Servicios",
  "Reglamento",
];

/**
 * Países donde se comercializa. **La única fuente**, y por eso importa.
 *
 * La prosa del sitio NO los enumera: dice «Latinoamérica» y punto. La lista
 * exacta vive solo aquí y de aquí sale el `areaServed` de los datos
 * estructurados y el `llms.txt` — que es justo lo que leen Google y los motores
 * de respuesta, donde la precisión sí paga. Enumerarlos también en prosa
 * obligaba a reescribir el subtítulo del hero, la descripción y el FAQ cada vez
 * que se abre un mercado, y a partir de cuatro países la frase deja de leerse.
 *
 * **Abrir un país es editar esta línea.** Ese es el objetivo del arreglo.
 *
 * PENDIENTE — Panamá. Decisión comercial abierta, y hay una precedencia
 * técnica: el selector de país fiscal es un enum cerrado de tres valores
 * (`src/features/finanzas/schemas.ts`, `country: z.enum(["EC","CO","MX"])`) y
 * `PRIMARY_COUNTRIES` en `src/lib/countries.ts` tampoco lo incluye, así que un
 * conjunto panameño NO se puede dar de alta hoy. La moneda sí está cubierta:
 * Panamá usa dólar y `AppCurrency` ya acepta USD. Anunciarlo antes de abrir el
 * enum manda prospectos a un alta que se rompe. Ya estaba anotado como VIV-1801
 * en el triaje de la auditoría UX.
 */
export const PAISES = ["México", "Colombia", "Ecuador"];
