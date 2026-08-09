import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { openGraphDe } from "@/lib/marketing/sitio";
import { markdownToHtml } from "@/lib/marketing/markdown";

export const metadata: Metadata = {
  openGraph: openGraphDe("/legal/terminos"),
  // Propia, no heredada: el layout ya no declara canonica (heredaba la de /mx).
  alternates: { canonical: "/legal/terminos" },
  title: "Términos y Condiciones — Vivaru",
  description:
    "Términos y condiciones del servicio SaaS de Vivaru SAS para administradoras y conjuntos residenciales.",
};

export default async function TerminosPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/terminos.md");
  const markdown = fs.readFileSync(filePath, "utf8");
  const html = await markdownToHtml(markdown);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-lg text-sm text-slate-500">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-navy underline-offset-4 hover:underline">
              Inicio
            </Link>
          </li>
          <li aria-hidden="true" className="select-none">›</li>
          <li>Legal</li>
          <li aria-hidden="true" className="select-none">›</li>
          <li className="text-navy font-medium" aria-current="page">
            Términos y Condiciones
          </li>
        </ol>
      </nav>
      <article
        className="prose prose-slate max-w-none prose-headings:font-display prose-h1:text-navy prose-h2:text-navy"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
