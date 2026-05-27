import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/marketing/markdown";

export const metadata: Metadata = {
  title: "Tratamiento de Datos Personales — Vivaru",
  description:
    "Anexo de tratamiento de datos personales (DPA) de Vivaru SAS. Describe los roles, categorías de datos y medidas de seguridad aplicables.",
};

export default async function DatosPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/datos.md");
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
            Tratamiento de Datos Personales
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
