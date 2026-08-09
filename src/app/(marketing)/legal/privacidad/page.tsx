import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/marketing/markdown";

export const metadata: Metadata = {
  // Propia, no heredada: el layout ya no declara canonica (heredaba la de /mx).
  alternates: { canonical: "/legal/privacidad" },
  title: "Política de Privacidad — Vivaru",
  description:
    "Conoce cómo Vivaru SAS trata los datos personales de acuerdo con la LFPDPPP.",
};

export default async function PrivacidadPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/privacidad.md");
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
            Política de Privacidad
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
