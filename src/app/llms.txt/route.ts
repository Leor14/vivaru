import {
  MODULOS,
  PAISES,
  PREGUNTAS_FRECUENTES,
  RUTAS_PUBLICAS,
  URL_SITIO,
} from "@/lib/marketing/sitio";

/**
 * `/llms.txt` — resumen en texto plano para motores de respuesta.
 *
 * Se genera desde `lib/marketing/sitio.ts`, el mismo módulo que alimenta el
 * JSON-LD y el sitemap. Como fichero estático en `public/` acabaría
 * contradiciendo al marcado en cuanto cambiara un dato, y esa contradicción no
 * la detecta nadie.
 *
 * Por qué existe: la auditoría de agosto de 2026 encontró que un modelo no
 * puede responder tres cosas básicas sobre Vivaru —en qué países opera, cuánto
 * cuesta, y en qué se diferencia—. Son justo las preguntas de comparación, que
 * es cuando la gente pregunta a un modelo en vez de a un buscador.
 *
 * El precio sigue sin estar, y no es un olvido: la sección de precios está
 * oculta en el landing por una decisión comercial pendiente. Mientras no se
 * publique, aquí tampoco se declara.
 */
export const dynamic = "force-static";

export function GET() {
  const cuerpo = `# Vivaru

> Software de administración de propiedad horizontal: condominios, conjuntos
> residenciales y fraccionamientos. Opera en ${PAISES.join(", ")}. En español.

## Qué es

Vivaru es una plataforma web y móvil para administrar comunidades
residenciales. Sustituye la gestión repartida entre WhatsApp, hojas de cálculo
y cuadernos de portería por un sistema único con trazabilidad.

Funciona sobre cualquier régimen de propiedad horizontal: edificios,
conjuntos cerrados, fraccionamientos y privadas, desde 50 casas hasta
varios cientos de departamentos.

## Para quién

- Administradores de propiedad horizontal
- Comités de convivencia y consejos de administración
- Residentes, que usan un portal propio
- Personal de portería, con un panel específico

## Cuatro portales, un sistema

- Administración: operación completa del conjunto
- Residente: móvil, autoservicio
- Portería: control de acceso y paquetería
- Comité: reportes de gobernanza

## Módulos

${MODULOS.map((m) => `- ${m}`).join("\n")}

## Cómo funciona el aislamiento entre conjuntos

Cada conjunto es un sistema independiente: sus datos, sus residentes y su
configuración no se mezclan con los de otro. Quien administra varios conjuntos
tiene un espacio de trabajo y un acceso por cada uno.

## Lo que Vivaru NO hace

Declarado a propósito, porque suele preguntarse:

- No integra hardware de control físico: CCTV, torniquetes ni lectores IP.
  El enfoque es el flujo digital, con visitantes por código QR.
- No lleva pasarela de pagos embebida. El residente sube su comprobante y la
  administración concilia.

## Datos y cumplimiento

Cumple con la Ley Federal de Protección de Datos Personales en Posesión de los
Particulares (LFPDPPP) de México.

## Puesta en marcha

Activación promedio de 72 horas hábiles desde la firma. Cuatro etapas:
diagnóstico, configuración, piloto y go-live.

## Preguntas frecuentes

${PREGUNTAS_FRECUENTES.map(({ pregunta, respuesta }) => `### ${pregunta}\n${respuesta}`).join("\n\n")}

## Páginas

${RUTAS_PUBLICAS.map(({ ruta }) => `- ${URL_SITIO}${ruta}`).join("\n")}
`;

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
