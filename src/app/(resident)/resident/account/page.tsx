"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BillingHeroCard } from "@/components/features/billing/BillingHeroCard";
import { BillingPeriodCard } from "@/components/features/billing/BillingPeriodCard";
import { ResidentAdvancesCard } from "@/components/features/finanzas/ResidentAdvancesCard";
import { ResidentVouchersCard } from "@/components/features/finanzas/ResidentVouchersCard";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { construirEstadoDeCuenta } from "@/features/billing/estado-de-cuenta";
import { renderEstadoDeCuentaPdf } from "@/features/finanzas/comprobante/estado-de-cuenta-pdf";
import { renderPazYSalvoPdf } from "@/features/finanzas/comprobante/paz-y-salvo-pdf";
import { emitClearanceCertificateCallable } from "@/lib/firebase/callables";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { saldoAFavor, useAdvances } from "@/features/finanzas/use-advances";
import { usePaymentReceipts } from "@/features/billing/use-payment-receipts";
import { watchActiveBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { db, storage } from "@/lib/firebase/client";
import type { BankAccount } from "@/types/domain";
import { doc, onSnapshot } from "firebase/firestore";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useTenantVocabulary } from "@/features/tenant/use-tenant-vocabulary";
import { AYUDA, capitalizar } from "@/lib/config/vocabulario-pais";
import { HelpTip } from "@/components/shared/help-tip";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentAccountPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const vocab = useTenantVocabulary();
  const { items, loading } = useBillingStatements(user?.tenantId, user?.unitId);
  const { items: anticipos } = useAdvances(user?.tenantId, user?.unitId);
  const [descargando, setDescargando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const estadoDeCuenta = useFeatureFlag("producto-estado-de-cuenta");

  /**
   * `FEAT-004` CA4/CA7 · el residente emite su propio paz y salvo.
   *
   * **La condición «saldo cero» NO se comprueba aquí.** Se manda la petición y
   * el servidor decide: si el cliente decidiera, un navegador manipulado se
   * emitiría uno debiendo. Por eso el botón se ofrece siempre que la bandera
   * esté encendida —también con saldo— y el «no» llega del servidor con el
   * importe y el período, que es la respuesta útil.
   */
  async function emitirPazYSalvo() {
    if (!user?.tenantId || !user?.unitId) return;
    setEmitiendo(true);
    try {
      const hoy = new Date();
      const issueDate = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
      const r = await emitClearanceCertificateCallable({
        tenantId: user.tenantId,
        unitId: user.unitId,
        unitLabel: user.unitLabel,
        issueDate,
        // Una emisión por unidad y día: repetir el botón el mismo día devuelve
        // el MISMO certificado en vez de llenar el histórico del conjunto de
        // papeles idénticos con códigos distintos.
        operationKey: `pys-${user.unitId}-${issueDate}`,
      });
      await renderPazYSalvoPdf(
        {
          code: r.code,
          unidad: user.unitLabel ?? user.unitId,
          conjunto: user.tenantName ?? "",
          asOfDate: issueDate,
          issuedAt: issueDate,
          creditBalance: r.creditBalance,
        },
        formatAmount,
        { titulo: vocab.pazYSalvoTitulo },
      );
      toast.success(
        r.created
          ? `Se emitió ${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}: ${r.code}`
          : `Ya se había emitido hoy: ${r.code}`,
      );
    } catch (error) {
      // El servidor nombra el saldo y desde qué período. Ese texto ES la
      // respuesta: sustituirlo por uno genérico tiraría lo único accionable.
      toast.error(error instanceof Error ? error.message : `No fue posible emitir ${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}.`);
    } finally {
      setEmitiendo(false);
    }
  }

  /**
   * `FEAT-004` CA7 · el residente descarga su estado de cuenta **sin pedírselo
   * al administrador**. Es lectura pura: los cargos ya están en la pantalla y el
   * cálculo del saldo acumulado es presentación (§11.1). Lo que NO se emite
   * desde aquí es el paz y salvo — su única condición es «saldo cero» y esa la
   * comprueba el servidor, porque un cliente manipulado emitiría uno falso.
   */
  async function descargarEstadoDeCuenta() {
    setDescargando(true);
    try {
      const estado = construirEstadoDeCuenta(items);
      const hoy = new Date();
      await renderEstadoDeCuentaPdf(
        estado,
        {
          conjunto: user?.tenantName ?? "Conjunto residencial",
          unidad: user?.unitLabel ?? user?.unitId ?? "—",
          pazYSalvoFrase: `${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}`,
          // La fecha la pone la pantalla, no el generador: un PDF que decide
          // qué día es hoy no se puede probar.
          emitidoEl: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
          saldoAFavor: saldoAFavor(anticipos, user?.unitId),
        },
        formatAmount,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el estado de cuenta.");
    } finally {
      setDescargando(false);
    }
  }
  const { receiptByStatementId } = usePaymentReceipts(user?.tenantId, user?.unitId);

  const [uploading, setUploading] = useState(false);
  // Tracks which statementId is being uploaded (null = global upload)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStatementId = useRef<string | null>(null);
  // F1: el residente confirma el monto antes de enviar el comprobante.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [declaredAmount, setDeclaredAmount] = useState("");
  /**
   * `FLOW-002` CA11 — a qué cuenta dice el residente que pagó.
   *
   * Es una **declaración**, no un hecho: quien la escribe es quien paga. El
   * administrador la ve al revisar y puede cambiarla antes de aprobar. Sin ella,
   * la conciliación tenía que adivinar por importe y fecha, y dos cuotas iguales
   * pagadas el mismo día eran indistinguibles.
   */
  const [declaredBankAccountId, setDeclaredBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Copropiedad de la unidad propia (PLAT-001, CA7): el residente ve su
  // coeficiente y su expensa — R9: solo los suyos; la regla de units ya
  // permite leer a cualquier miembro del conjunto.
  const [unitOwnership, setUnitOwnership] = useState<{ coefficient?: number; monthlyFeeAmount?: number } | null>(null);

  /**
   * Las cuentas del conjunto, para poder decir a cuál se pagó.
   *
   * **Solo las activas, y el filtro es lo que hace pasar la regla**: Firestore
   * evalúa la consulta contra la regla sin ejecutarla, así que sin ese `where`
   * se rechazaría entera. Un fallo aquí deja la lista vacía y el selector
   * escondido — el comprobante se sigue pudiendo subir sin cuenta, que es
   * exactamente lo que pasaba hasta hoy.
   */
  useEffect(() => {
    if (!user?.tenantId) return;
    return watchActiveBankAccounts(user.tenantId, setBankAccounts, () => setBankAccounts([]));
  }, [user?.tenantId]);

  useEffect(() => {
    if (!db || !user?.unitId) return;
    return onSnapshot(doc(db, "units", user.unitId), (snap) => {
      if (!snap.exists()) {
        setUnitOwnership(null);
        return;
      }
      const data = snap.data() as { coefficient?: number; monthlyFeeAmount?: number };
      setUnitOwnership({ coefficient: data.coefficient, monthlyFeeAmount: data.monthlyFeeAmount });
    });
  }, [user?.unitId]);

  // Sort statements newest-first
  const sortedItems = [...items].sort((a, b) => (a.period > b.period ? -1 : 1));

  function handleUploadForStatement(statementId: string) {
    pendingStatementId.current = statementId;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Solo se permiten imágenes (JPG, PNG, WEBP) o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar 10 MB.");
      return;
    }

    // Pre-llena el monto con el saldo del período para que el residente lo confirme/ajuste.
    const stmt = items.find((i) => i.id === pendingStatementId.current);
    setDeclaredAmount(stmt && stmt.balance ? String(stmt.balance) : "");
    setDeclaredBankAccountId("");
    setPendingFile(file);
  }

  function cancelUpload() {
    setPendingFile(null);
    setDeclaredAmount("");
    setDeclaredBankAccountId("");
    pendingStatementId.current = null;
  }

  async function confirmUpload() {
    const file = pendingFile;
    const tenantId = user?.tenantId;
    const unitId = user?.unitId;
    const uid = user?.uid;
    const statementId = pendingStatementId.current;

    if (!file) return;
    if (!tenantId || !unitId || !uid) {
      toast.error("No se pudo identificar tu unidad. Recarga la página.");
      return;
    }
    if (!db || !storage) {
      toast.error("Firebase no está disponible en este momento.");
      return;
    }
    const amount = parseFloat(declaredAmount.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Indica el monto que pagaste.");
      return;
    }

    setUploading(true);
    if (statementId) setUploadingFor(statementId);

    try {
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
      // La ruta va por USUARIO, no por unidad: es lo que permite que el
      // residente lea su propio comprobante —hace falta para pedir la URL de
      // descarga de aquí abajo— sin ver los de sus vecinos. Ver storage.rules.
      const storagePath = `tenants/${tenantId}/payment-receipts/${uid}/${Date.now()}-${cleanName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "paymentReceipts"), {
        tenantId,
        unitId,
        uploadedBy: uid,
        uploadedAt: serverTimestamp(),
        fileUrl,
        fileName: file.name,
        storagePath,
        amount,
        status: "pending",
        // statementId links this receipt to a specific billing period
        ...(statementId ? { statementId } : {}),
        // CA11. Ausente si no la eligió: un campo vacío y «no lo dijo» tienen
        // que verse distinto para quien revisa.
        ...(declaredBankAccountId ? { bankAccountId: declaredBankAccountId } : {}),
      });

      toast.success("Comprobante enviado. El administrador lo revisará pronto.");
      setPendingFile(null);
      setDeclaredAmount("");
      setDeclaredBankAccountId("");
    } catch {
      toast.error("No fue posible subir el comprobante. Intenta de nuevo.");
    } finally {
      setUploading(false);
      setUploadingFor(null);
      pendingStatementId.current = null;
    }
  }

  return (
    <div className="space-y-4">
    <Card>
      <div>
        <CardTitle>Estado de cuenta</CardTitle>
        <CardDescription className="mt-1">
          Saldo, movimientos y cuotas de tu unidad.
        </CardDescription>
      </div>

      {/* Hidden file input — shared across all period cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* CA2 — el saldo a favor va ARRIBA del estado de cuenta y no al final:
          es lo primero que cambia la lectura de todo lo de abajo. Si no hay
          ninguno, no se pinta nada. */}
      <div className="mt-4">
        <ResidentAdvancesCard tenantId={user?.tenantId} unitId={user?.unitId} formatAmount={formatAmount} />
      </div>

      {/* Hero card — situación financiera */}
      {loading ? (
        <Skeleton className="mt-4 h-[148px] rounded-xl" />
      ) : sortedItems.length > 0 ? (
        <div className="mt-4">
          <BillingHeroCard items={sortedItems} formatAmount={formatAmount} />
        </div>
      ) : null}

      {/* Copropiedad (PLAT-001): visible solo si el conjunto cargó los datos. */}
      {unitOwnership && (unitOwnership.coefficient != null || unitOwnership.monthlyFeeAmount != null) ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2 text-xs text-[var(--slate-600)]">
          {unitOwnership.coefficient != null ? (
            // Al residente se le encabeza con la CONSECUENCIA, no con el
            // término de la escritura: el condómino rara vez dice «indiviso»
            // —ni «alícuota», ni «coeficiente»—, piensa en lo que paga. La
            // palabra exacta se la ofrece la ayuda, por si la necesita para
            // casarla con su escritura.
            <span className="inline-flex items-center gap-1">
              Tu unidad aporta el{" "}
              <span className="font-medium text-[var(--slate-900)]">{unitOwnership.coefficient}%</span>{" "}
              de los gastos comunes
              <HelpTip text={AYUDA.coeficienteResidente} />
            </span>
          ) : null}
          {unitOwnership.monthlyFeeAmount != null ? (
            <span>
              {capitalizar(vocab.cuotaMensual)}:{" "}
              <span className="font-medium text-[var(--slate-900)]">{formatAmount(unitOwnership.monthlyFeeAmount)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* `FEAT-004` · los dos documentos van aquí, encima de los movimientos que
          resumen, y los DOS detrás de la misma bandera — que es lo que su
          catálogo promete al apagarla.

          No se ofrecen con la lista vacía: un estado de cuenta sin una sola
          línea no es un documento, es una pregunta al administrador. El paz y
          salvo de una unidad sin movimientos SÍ se puede emitir (CA6), pero se
          pide desde la cartera del administrador, no desde una pantalla que el
          residente ve en blanco. */}
      {!loading && items.length > 0 && estadoDeCuenta ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={descargando} onClick={() => void descargarEstadoDeCuenta()}>
            {descargando ? "Generando…" : "Descargar estado de cuenta"}
          </Button>
          <Button type="button" disabled={emitiendo} onClick={() => void emitirPazYSalvo()}>
            {emitiendo ? "Emitiendo…" : capitalizar(vocab.pazYSalvo)}
          </Button>
        </div>
      ) : null}

      {/* Period cards */}
      <div className="mt-4 grid gap-2">
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-[var(--slate-100)]"
              />
            ))}
          </>
        )}

        {!loading && sortedItems.length === 0 && (
          <EmptyState
            title="Sin movimientos"
            description="Aún no hay estados de cuenta publicados para tu unidad."
          />
        )}

        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            className="opacity-0 translate-y-1"
            style={{
              animation: `billingCardIn 280ms var(--ease-out) ${index * 60}ms forwards`,
            }}
          >
            <BillingPeriodCard
              item={item}
              formatAmount={formatAmount}
              onUploadReceipt={uploading ? undefined : handleUploadForStatement}
              isUploading={uploadingFor === item.id}
              receiptStatus={receiptByStatementId.get(item.id)?.status ?? null}
              defaultOpen={index === 0 && item.status !== "paid" && item.status !== "cancelled"}
            />
          </div>
        ))}
      </div>
    </Card>
    <ResidentVouchersCard />

    {pendingFile ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)]/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-strong)] p-5 shadow-xl">
          <h3 className="text-base font-semibold text-[var(--slate-900)]">Confirmar comprobante</h3>
          <p className="mt-1 text-sm text-[var(--slate-600)]">
            Indica el monto que pagaste. Así el administrador lo valida más rápido.
          </p>
          <label className="mt-4 block text-xs font-medium text-[var(--slate-700)]">
            Monto pagado
            <input
              type="number"
              inputMode="decimal"
              value={declaredAmount}
              onChange={(e) => setDeclaredAmount(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)]"
              placeholder="0"
              autoFocus
            />
          </label>
          {bankAccounts.length > 0 ? (
            <label className="mt-3 block text-xs font-medium text-[var(--slate-700)]">
              ¿A qué cuenta pagaste?
              <select
                value={declaredBankAccountId}
                onChange={(e) => setDeclaredBankAccountId(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)]"
              >
                <option value="">No estoy seguro</option>
                {bankAccounts.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.label} · {cuenta.bankName}
                  </option>
                ))}
              </select>
              <span className="mt-1 block font-normal text-[var(--slate-500)]">
                Decirlo ayuda a que tu pago se identifique más rápido. Si no lo recuerdas, déjalo en blanco.
              </span>
            </label>
          ) : null}
          <p className="mt-2 truncate text-xs text-[var(--slate-500)]">Archivo: {pendingFile.name}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelUpload} disabled={uploading}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmUpload} disabled={uploading}>
              {uploading ? "Enviando..." : "Enviar comprobante"}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    </div>
  );
}
