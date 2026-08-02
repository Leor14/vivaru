import Link from "next/link";

/**
 * Footer — Sprint 1.
 *
 * Structure per plan §5.13: 4 columns + legal row + contact line.
 * Background: navy (counts toward the §8 15% surface budget — footer is
 * one of the three allowed navy zones along with the impact band and the
 * final-CTA section, no other surface may use navy as a fill).
 *
 * Legal links: hrefs marked HITL H3 (privacy / terms / data policy URLs
 * unresolved). Rendered with aria-disabled="true" and onClick prevention
 * via a non-interactive <span> so screen readers announce them as
 * "unavailable" until URLs ship. Replace each `href="#"` and remove the
 * HITL comment when the URLs are confirmed.
 */

const PRODUCT_LINKS = [
  { label: "Solución (4 pilares)", href: "/mx#solucion" },
  { label: "Perspectivas por rol", href: "/mx#perspectivas" },
  { label: "Diferenciadores", href: "/mx#diferenciadores" },
];

const RESOURCE_LINKS = [
  { label: "Diagnóstico gratuito", href: "/diagnostico" },
  { label: "Preguntas frecuentes", href: "/mx#faq" },
  // { label: "Piloto pagado", href: "/mx#piloto" }, // HIDDEN — see page.tsx
];

const COMPANY_LINKS = [
  { label: "Sobre Vivaru", href: "/mx#impacto" },
  { label: "Contacto", href: "mailto:hola@grupovivaru.com" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy text-slate-50">
      <div className="container py-xxl">
        <div className="grid gap-xl md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 — Brand + tagline */}
          <div className="flex flex-col gap-md">
            <Link
              href="/mx"
              aria-label="Vivaru — Inicio"
              className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              {/* SVG: paths son fill="#000000" sobre fondo transparente.
                  invert() los convierte a blanco. No usar PNG (tiene fondo blanco sólido). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/vivaru-logo.svg"
                alt=""
                width={120}
                height={120}
                className="h-16 w-auto invert md:h-20"
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-slate-200/80">
              Control residencial para conjuntos, condominios y
              fraccionamientos. Orden, trazabilidad y autoservicio en una sola
              plataforma.
            </p>
          </div>

          {/* Column 2 — Producto */}
          <FooterColumn title="Producto" links={PRODUCT_LINKS} />

          {/* Column 3 — Recursos */}
          <FooterColumn title="Recursos" links={RESOURCE_LINKS} />

          {/* Column 4 — Empresa */}
          <FooterColumn title="Empresa" links={COMPANY_LINKS} />
        </div>

        {/* Legal row */}
        <div className="mt-xxl flex flex-col gap-md border-t border-white/10 pt-lg md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-200/70">
            © {year} Vivaru — Grupo Vivaru. Todos los derechos reservados.
          </p>
          <ul className="flex flex-wrap items-center gap-x-lg gap-y-sm text-xs">
            <li>
              <Link
                href="/legal/privacidad"
                className="text-slate-200/60 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-sm"
              >
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link
                href="/legal/terminos"
                className="text-slate-200/60 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-sm"
              >
                Términos de servicio
              </Link>
            </li>
            <li>
              <Link
                href="/legal/datos"
                className="text-slate-200/60 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-sm"
              >
                Tratamiento de datos
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact line */}
        <p className="mt-lg text-xs text-slate-200/60">
          <span className="font-medium text-slate-100">Contacto comercial:</span>{" "}
          <a
            href="mailto:hola@grupovivaru.com"
            className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
          >
            hola@grupovivaru.com
          </a>{" "}
          · Te respondemos a la brevedad.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-md">
      <h2 className="text-xs font-semibold tracking-widest text-slate-200/70 uppercase">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-slate-100/90 transition-colors duration-fast hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-sm"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}


