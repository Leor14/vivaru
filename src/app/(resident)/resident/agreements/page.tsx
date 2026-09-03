"use client";

import { CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { signCommitteeAgreement } from "@/features/committee-agreements/services";
import type { AgreementSignatureMode, CommitteeAgreement } from "@/features/committee-agreements/types";
import { useCommitteeAgreements, useMyAgreementSignatures } from "@/features/committee-agreements/use-committee-agreements";
import { formatDateSafe } from "@/utils/date";

const MODE_LABEL: Record<AgreementSignatureMode, string> = {
  obligatoria: "Firma obligatoria",
  parcial: "Firma parcial",
  informativo: "Informativo",
};

function SignCard({
  agreement,
  tenantId,
  unitId,
  uid,
}: {
  agreement: CommitteeAgreement;
  tenantId: string;
  unitId: string;
  uid: string;
}) {
  const [read, setRead] = useState(false);
  const [signing, setSigning] = useState(false);

  async function handleSign() {
    if (!read || signing) return;
    setSigning(true);
    try {
      await signCommitteeAgreement(tenantId, agreement, unitId, uid);
      toast.success("Acuerdo firmado.");
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_SIGNED") {
        toast.info("Ya habías firmado este acuerdo.");
      } else {
        toast.error("No se pudo firmar. Intenta de nuevo.");
      }
    } finally {
      setSigning(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{agreement.title}</CardTitle>
          <CardDescription className="mt-0.5">Sesión del {formatDateSafe(agreement.sessionDate)}</CardDescription>
        </div>
        <Badge className="bg-[var(--amber-100)] text-[var(--amber-700)]">{MODE_LABEL[agreement.signatureMode]}</Badge>
      </div>

      {agreement.fileUrl ? (
        <Button variant="outline" size="sm" onClick={() => window.open(agreement.fileUrl as string, "_blank")}>
          <FileText className="mr-2 h-4 w-4" />
          Ver documento
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ) : (
        <p className="text-sm text-[var(--slate-500)]">Sin documento adjunto.</p>
      )}

      <label className="flex items-center gap-2 text-sm text-[var(--slate-700)]">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        He leído el acuerdo.
      </label>

      <Button className="w-full" onClick={() => void handleSign()} disabled={!read || signing || !agreement.fileUrl}>
        {signing ? "Firmando…" : "Firmar acuerdo"}
      </Button>
    </Card>
  );
}

function HistoryCard({ agreement, signed }: { agreement: CommitteeAgreement; signed: boolean }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{agreement.title}</CardTitle>
          <CardDescription className="mt-0.5">Sesión del {formatDateSafe(agreement.sessionDate)}</CardDescription>
        </div>
        {signed ? (
          <Badge className="bg-[var(--success-100)] text-[var(--success-700)]">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Firmado
          </Badge>
        ) : (
          <Badge className="bg-[var(--slate-100)] text-[var(--slate-600)]">Informativo</Badge>
        )}
      </div>
      {agreement.fileUrl ? (
        <Button variant="outline" size="sm" onClick={() => window.open(agreement.fileUrl as string, "_blank")}>
          <FileText className="mr-2 h-4 w-4" />
          Ver documento
        </Button>
      ) : null}
    </Card>
  );
}

export default function ResidentAgreementsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const unitId = user?.unitId ?? "";
  const uid = user?.uid ?? "";

  const { items, loading } = useCommitteeAgreements(tenantId);
  const { signatures } = useMyAgreementSignatures(tenantId, unitId);
  const signedSet = new Set(signatures.map((s) => s.agreementId));

  const inScope = (a: CommitteeAgreement) =>
    a.signerScope === "all" || (a.signerUnitIds ?? []).includes(unitId);

  const visible = items.filter((a) => a.status === "enviado" && inScope(a));
  const toSign = visible.filter((a) => a.signatureMode !== "informativo" && !signedSet.has(a.id));
  const history = visible.filter((a) => a.signatureMode === "informativo" || signedSet.has(a.id));

  const toSignPager = usePagination(toSign, 6);
  const historyPager = usePagination(history, 6);

  return (
    <div className="space-y-6 p-4">
      {/* El nombre lo pone la cabecera del shell, que desde la pasada 1 nombra la
          pantalla y no el portal. */}
      <p className="text-sm text-[var(--slate-500)]">Acuerdos de las sesiones de comité, ordenados por fecha.</p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)]">Por firmar</h2>
        {loading ? (
          <p className="text-sm text-[var(--slate-500)]">Cargando…</p>
        ) : toSign.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--slate-600)]">No tienes acuerdos pendientes de firma. 🎉</p>
          </Card>
        ) : (
          <>
            {toSignPager.pageItems.map((a) => (
              <SignCard key={a.id} agreement={a} tenantId={tenantId} unitId={unitId} uid={uid} />
            ))}
            {toSignPager.hasPagination ? (
              <TablePager
                page={toSignPager.page}
                totalPages={toSignPager.totalPages}
                total={toSignPager.total}
                start={toSignPager.start}
                pageSize={toSignPager.pageSize}
                onPrev={toSignPager.prev}
                onNext={toSignPager.next}
              />
            ) : null}
          </>
        )}
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)]">Historial e informativos</h2>
          {historyPager.pageItems.map((a) => (
            <HistoryCard key={a.id} agreement={a} signed={signedSet.has(a.id)} />
          ))}
          {historyPager.hasPagination ? (
            <TablePager
              page={historyPager.page}
              totalPages={historyPager.totalPages}
              total={historyPager.total}
              start={historyPager.start}
              pageSize={historyPager.pageSize}
              onPrev={historyPager.prev}
              onNext={historyPager.next}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
