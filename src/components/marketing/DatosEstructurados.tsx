import {
  MODULOS,
  PAISES,
  PREGUNTAS_FRECUENTES,
  URL_SITIO,
} from "@/lib/marketing/sitio";

/**
 * Datos estructurados (JSON-LD) del landing.
 *
 * El sitio no tenía NI UNA marca. Para un buscador eso es una molestia; para un
 * motor de respuesta —ChatGPT, Perplexity, la vista de IA de Google— es la
 * diferencia entre poder citarte y tener que adivinar leyendo prosa de
 * marketing. Cuando alguien pregunta «¿qué software uso para administrar mi
 * conjunto en México?», el modelo cita a quien declara sus hechos.
 *
 * Tres marcas, por orden de rentabilidad:
 *
 *   FAQPage             el activo más barato del sitio. Las seis preguntas ya
 *                       existían, bien escritas, y no estaban marcadas.
 *   Organization        qué es Vivaru y cómo se contacta.
 *   SoftwareApplication categoría, plataforma y a quién sirve.
 *
 * OJO con el precio: `SoftwareApplication` admite `offers`, y aquí NO se
 * declara ninguno a propósito, porque la sección de precios está oculta en el
 * landing (`mx/page.tsx`) por una decisión comercial pendiente. Declarar un
 * precio que la página no muestra es incoherente y Google lo penaliza. En
 * cuanto se publiquen precios, este es el sitio donde añadirlos.
 *
 * Este componente es de servidor a propósito: el marcado tiene que estar en el
 * HTML inicial, no inyectarse después, porque muchos rastreadores no ejecutan
 * JavaScript.
 */

const ORGANIZACION = {
  "@type": "Organization",
  "@id": `${URL_SITIO}/#organizacion`,
  name: "Vivaru",
  url: URL_SITIO,
  logo: `${URL_SITIO}/brand/vivaru-logo.webp`,
  description:
    "Software de administración de condominios, conjuntos residenciales y fraccionamientos para Latinoamérica.",
  areaServed: PAISES.map((p) => ({ "@type": "Country", name: p })),
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    availableLanguage: ["Spanish"],
    areaServed: PAISES,
  },
};

const APLICACION = {
  "@type": "SoftwareApplication",
  "@id": `${URL_SITIO}/#aplicacion`,
  name: "Vivaru",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Software de administración de propiedad horizontal",
  operatingSystem: "Web, iOS, Android",
  url: `${URL_SITIO}/mx`,
  publisher: { "@id": `${URL_SITIO}/#organizacion` },
  inLanguage: "es",
  description:
    "Plataforma para administrar condominios, conjuntos residenciales y fraccionamientos: cartera y cuotas de mantenimiento, reservas de amenidades, control de visitantes con código QR, paquetería, PQRS y comunicaciones. Cada conjunto opera aislado, con sus propios datos y accesos.",
  featureList: MODULOS,
  audience: {
    "@type": "Audience",
    audienceType:
      "Administradores de propiedad horizontal, comités de convivencia y residentes",
  },
};

const PREGUNTAS = {
  "@type": "FAQPage",
  "@id": `${URL_SITIO}/mx#preguntas`,
  mainEntity: PREGUNTAS_FRECUENTES.map(({ pregunta, respuesta }) => ({
    "@type": "Question",
    name: pregunta,
    acceptedAnswer: { "@type": "Answer", text: respuesta },
  })),
};

/**
 * Un solo `@graph` en vez de tres etiquetas sueltas: así las entidades pueden
 * referenciarse entre sí por `@id` —la aplicación apunta a su organización— y
 * el rastreador las lee como un modelo conectado y no como tres fichas
 * inconexas.
 */
export function DatosEstructurados() {
  const grafo = {
    "@context": "https://schema.org",
    "@graph": [ORGANIZACION, APLICACION, PREGUNTAS],
  };

  return (
    <script
      type="application/ld+json"
      // El contenido es una constante del propio código, no entrada de usuario.
      // Se escapa `<` de todas formas: es la vía por la que un JSON-LD puede
      // cerrar la etiqueta antes de tiempo e inyectar marcado.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(grafo).replace(/</g, "\\u003c"),
      }}
    />
  );
}
