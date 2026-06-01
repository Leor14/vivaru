import { Topbar } from "@/components/marketing/Topbar";
import { Footer } from "@/components/marketing/Footer";

/**
 * Layout para /legal/* — añade Topbar, contenedor centrado (max-w-prose)
 * y Footer. Vive dentro del route group (marketing), por lo que hereda
 * el .marketing-theme wrapper y el CookieBanner del layout padre.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar />
      <main className="pt-20">
        <div className="container max-w-prose py-xxl">{children}</div>
      </main>
      <Footer />
    </>
  );
}
