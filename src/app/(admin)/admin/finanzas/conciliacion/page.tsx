"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Check,
  Link2,
  Plus,
  Scale,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { SectionIntro } from "@/components/shared/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { createBankAccount, watchBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { watchLedger } from "@/features/finanzas/use-ledger";
import {
  deleteBankStatementLine,
  importBankStatementLines,
  matchLine,
  rejectLine,
  unmatchLine,
  watchBankStatementLines,
  watchReconciliationCases,
} from "@/features/finanzas/use-reconciliation";
import {
  ETIQUETA_INCOHERENCIA,
  MOTIVOS_DE_RECHAZO,
  calcularCandidatos,
  incoherenciasDelPar,
  resumirConciliacion,
  type Incoherencia,
} from "@/features/finanzas/conciliacion-reglas";
import { bankAccountSchema, type BankAccountFormValues } from "@/features/finanzas/schemas";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, BankStatementLine, LedgerEntry, ReconciliationCase } from "@/types/domain";


/**
 * Una sección de la bandeja.
 *
 * **Vive FUERA del componente de página a propósito.** Definida dentro, React la
 * trataría como un tipo nuevo en cada render y remontaría las filas: el menú de
 * acciones se cerraría solo cada vez que llegara un dato por `onSnapshot`, que
 * en esta pantalla es constantemente.
 */
function Grupo({
  titulo,
  ayuda,
  lineas,
  formatAmount,
  incoherentes,
  casoPorLinea,
  candidatosPorLinea,
  onConciliar,
  onDeshacer,
  onDescartar,
  onEliminar,
}: {
  titulo: string;
  ayuda: string;
  lineas: BankStatementLine[];
  formatAmount: (n: number) => string;
  incoherentes: Map<string, Incoherencia[]>;
  casoPorLinea: Map<string, ReconciliationCase>;
  candidatosPorLinea: Map<string, LedgerEntry[]>;
  onConciliar: (l: BankStatementLine) => void;
  onDeshacer: (l: BankStatementLine) => void;
  onDescartar: (l: BankStatementLine) => void;
  onEliminar: (l: BankStatementLine) => void;
}) {
  if (lineas.length === 0) return null;
  return (
    <section>
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-[var(--slate-900)]">
          {titulo} <span className="font-normal text-[var(--slate-500)]">({lineas.length})</span>
        </h3>
        <p className="text-xs text-[var(--slate-500)]">{ayuda}</p>
      </div>
      <ul className="divide-y divide-[var(--slate-100)]">
        {lineas.map((line) => {
          const fallos = incoherentes.get(line.id) ?? [];
          const caso = casoPorLinea.get(line.id);
          const candidatos = candidatosPorLinea.get(line.id) ?? [];
          return (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--slate-900)]">
                  {line.date} · {formatAmount(line.amount)}
                </p>
                <p className="truncate text-xs text-[var(--slate-500)]">{line.description || "Sin descripción"}</p>
                {/* El porqué, escrito. Es la mitad del valor del expediente. */}
                {fallos.length > 0 ? (
                  <p className="mt-0.5 text-xs text-[var(--danger-700)]">
                    {fallos.map((f) => ETIQUETA_INCOHERENCIA[f]).join(" · ")}
                  </p>
                ) : null}
                {caso?.status === "rechazado" && caso.motivoCodigo ? (
                  <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                    Motivo: {MOTIVOS_DE_RECHAZO.find((m) => m.codigo === caso.motivoCodigo)?.label ?? caso.motivoCodigo}
                    {caso.motivoTexto ? ` — ${caso.motivoTexto}` : ""}
                  </p>
                ) : null}
                {caso?.status === "reversado" ? (
                  <p className="mt-0.5 text-xs text-[var(--tinte-ambar-texto-1)]">
                    Se deshizo sola: el movimiento con el que estaba casada fue anulado.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {fallos.length > 0 ? (
                  <Badge className="text-[var(--danger-700)]">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    No cuadra
                  </Badge>
                ) : null}
                {line.reconciled ? (
                  <>
                    {fallos.length === 0 ? (
                      <Badge className="text-[var(--tinte-verde-texto-1)]">
                        <Check className="mr-1 h-3 w-3" />
                        Conciliada
                      </Badge>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => onDeshacer(line)}>
                      Deshacer
                    </Button>
                  </>
                ) : caso?.status === "rechazado" ? (
                  <Button size="sm" variant="ghost" onClick={() => onDeshacer(line)}>
                    Reabrir
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={candidatos.length === 0}
                      title={candidatos.length === 0 ? "No hay ningún movimiento del libro que cuadre con esta línea." : undefined}
                      onClick={() => onConciliar(line)}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Conciliar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDescartar(line)}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Descartar
                    </Button>
                  </>
                )}
                {/* Destructiva al menú "…" — antes convivía con "Deshacer" al
                    mismo peso visual y propiciaba el clic accidental (VIV-1401). */}
                <RowActionsMenu
                  ariaLabel={`Acciones para la línea del ${line.date}`}
                  items={[
                    {
                      key: "delete",
                      label: "Eliminar línea",
                      danger: true,
                      onSelect: () => onEliminar(line),
                    },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function AdminConciliacionPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  /**
   * **Solo gobierna la AGRUPACIÓN.** Apagada, las líneas vuelven a una lista
   * plana; los candidatos filtrados, el aviso de «no cuadra» y el motivo del
   * descarte se quedan — eso no es la bandeja, es el expediente.
   */
  const bandejaAgrupada = useFeatureFlag("producto-expediente-conciliacion");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [matchTarget, setMatchTarget] = useState<BankStatementLine | null>(null);
  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [rejectTarget, setRejectTarget] = useState<BankStatementLine | null>(null);
  const [motivoCodigo, setMotivoCodigo] = useState<string>("sin_contraparte");
  const [motivoTexto, setMotivoTexto] = useState<string>("");

  const accountForm = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { label: "", bankName: "", accountNumber: "", accountType: "corriente", currency: "COP", openingBalance: 0, active: true },
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchBankAccounts(
      user.tenantId,
      (data) => {
        setAccounts(data);
        setSelectedAccountId((prev) => prev || data.find((a) => a.active)?.id || data[0]?.id || "");
      },
      (message) => toast.error(message),
    );
    return () => unsub();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubLedger = watchLedger(user.tenantId, setLedger, () => undefined);
    return () => unsubLedger();
  }, [user?.tenantId]);

  // Los expedientes. Los escribe el servidor; aquí solo se leen.
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchReconciliationCases(user.tenantId, setCases, () => undefined);
    return () => unsub();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId || !selectedAccountId) {
      setLines([]);
      return;
    }
    const unsub = watchBankStatementLines(
      user.tenantId,
      (data) => {
        setLines(data);
        setErrorMessage(null);
      },
      (message) => setErrorMessage(message),
      selectedAccountId,
    );
    return () => unsub();
  }, [user?.tenantId, selectedAccountId]);

  const unreconciledLedger = useMemo(() => ledger.filter((entry) => !entry.reconciled), [ledger]);
  const ledgerPorId = useMemo(() => new Map(ledger.map((e) => [e.id, e])), [ledger]);
  const casoPorLinea = useMemo(
    () => new Map(cases.map((c) => [c.bankStatementLineId, c])),
    [cases],
  );

  /**
   * Lo que tiene de malo cada emparejamiento que YA existe. **No corrige nada**:
   * el dato histórico no se toca (§5.4), se le pone nombre.
   */
  const incoherentes = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof incoherenciasDelPar>>();
    for (const line of lines) {
      if (!line.reconciled || !line.matchedLedgerEntryId) continue;
      const entry = ledgerPorId.get(line.matchedLedgerEntryId);
      if (!entry) continue;
      const fallos = incoherenciasDelPar(line, entry);
      if (fallos.length > 0) mapa.set(line.id, fallos);
    }
    return mapa;
  }, [lines, ledgerPorId]);

  /**
   * **CA10 — «conciliadas» deja de contar las que no cuadran.** Antes el número
   * incluía el par de −300.000 contra +40.000, así que la cabecera decía que la
   * cuenta cuadraba mientras tenía un emparejamiento falso dentro. Un total que
   * suma lo que está mal es peor que no tener total.
   */
  const summary = useMemo(() => {
    const rechazadas = new Set(
      lines.filter((l) => casoPorLinea.get(l.id)?.status === "rechazado").map((l) => l.id),
    );
    return resumirConciliacion(lines, new Set(incoherentes.keys()), rechazadas);
  }, [lines, incoherentes, casoPorLinea]);

  /** Los candidatos de cada línea, con las MISMAS reglas que aplicará el servidor. */
  const candidatosPorLinea = useMemo(() => {
    const mapa = new Map<string, LedgerEntry[]>();
    for (const line of lines) {
      if (line.reconciled) continue;
      mapa.set(line.id, calcularCandidatos(line, unreconciledLedger));
    }
    return mapa;
  }, [lines, unreconciledLedger]);

  /**
   * La bandeja, en los grupos que salieron de medir las 27 líneas de producción:
   * seis fungibles con varios candidatos, una comisión sin contraparte y un
   * depósito sin identificar. **No es una taxonomía inventada.**
   */
  const bandeja = useMemo(() => {
    const pendientes = lines.filter((l) => !l.reconciled);
    const rechazadas = pendientes.filter((l) => casoPorLinea.get(l.id)?.status === "rechazado");
    const abiertas = pendientes.filter((l) => casoPorLinea.get(l.id)?.status !== "rechazado");
    return {
      propuestas: abiertas.filter((l) => (candidatosPorLinea.get(l.id)?.length ?? 0) === 1),
      varias: abiertas.filter((l) => (candidatosPorLinea.get(l.id)?.length ?? 0) > 1),
      sinContraparte: abiertas.filter((l) => (candidatosPorLinea.get(l.id)?.length ?? 0) === 0),
      rechazadas,
    };
  }, [lines, candidatosPorLinea, casoPorLinea]);

  async function handleSaveAccount(values: BankAccountFormValues) {
    if (!user?.tenantId) return;
    setSavingAccount(true);
    try {
      await createBankAccount(user.tenantId, user.uid, values);
      toast.success("Cuenta bancaria creada.");
      setAccountModalOpen(false);
      accountForm.reset();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleImport(file: File) {
    if (!user?.tenantId || !selectedAccountId) {
      toast.error("Selecciona o crea una cuenta bancaria primero.");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importBankStatementLines(user.tenantId, user.uid, selectedAccountId, text);
      if (result.imported === 0) {
        toast.error("No se reconocieron líneas. Revisa que el CSV tenga columnas de fecha y monto.");
      } else {
        // R5: lo repetido se cuenta aparte de lo ilegible. Son dos cosas
        // distintas y juntarlas esconde que el extracto ya estaba cargado.
        const detalle = [
          result.duplicated ? `${result.duplicated} ya estaban` : "",
          result.skipped ? `${result.skipped} omitidas` : "",
        ].filter(Boolean).join(", ");
        toast.success(`${result.imported} líneas importadas${detalle ? `, ${detalle}` : ""}.`);
      }
      if (result.imported === 0 && result.duplicated > 0) {
        toast.info(`Ese extracto ya estaba cargado: ${result.duplicated} líneas repetidas, ninguna nueva.`);
      }
      // `CA1`: si los expedientes no se pudieron crear, la importación sirvió
      // igual — pero eso NO puede quedarse callado.
      if (result.casosFallaron) {
        toast.warning("Las líneas se importaron, pero no se pudieron crear sus expedientes. Vuelve a importar el mismo archivo para reintentarlo: no se duplicará nada.");
      }
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleMatch(entry: LedgerEntry) {
    if (!matchTarget || !user?.tenantId) return;
    try {
      await matchLine(user.tenantId, matchTarget, entry, casoPorLinea.get(matchTarget.id)?.version);
      toast.success("Conciliado.");
      setMatchTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleUnmatch(line: BankStatementLine) {
    if (!user?.tenantId) return;
    try {
      await unmatchLine(user.tenantId, line, casoPorLinea.get(line.id)?.version);
      toast.success("Conciliación deshecha.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !user?.tenantId) return;
    try {
      await rejectLine(
        user.tenantId,
        rejectTarget,
        motivoCodigo,
        motivoTexto,
        casoPorLinea.get(rejectTarget.id)?.version,
      );
      toast.success("Línea descartada con motivo.");
      setRejectTarget(null);
      setMotivoTexto("");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleDeleteLine(line: BankStatementLine) {
    if (!user?.tenantId) return;
    try {
      await deleteBankStatementLine(user.tenantId, line);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  /**
   * **Los candidatos, con las reglas — no «todos ordenados por parecido».**
   *
   * Antes esta lista eran los 74 asientos sin conciliar del conjunto, puestos
   * por cercanía de monto absoluto. Así se escribió el emparejamiento de
   * −300.000 contra +40.000 que sigue en producción: el primero de la lista
   * parece el bueno. Ahora solo entran los que el servidor va a aceptar, y
   * cuando no hay ninguno la pantalla lo dice en vez de ofrecer el menos malo.
   */
  const matchCandidates = useMemo(() => {
    if (!matchTarget) return [];
    return candidatosPorLinea.get(matchTarget.id) ?? [];
  }, [matchTarget, candidatosPorLinea]);

  return (
    <div className="space-y-4">
      <SectionIntro
        storageKey="conciliacion"
            icon={Scale}
            tone="lavender"
        purpose="Cuadrar lo registrado en el Libro contra lo que realmente se movió en el banco, para que el saldo contable coincida con el saldo real de la cuenta."
        how={
          <ol className="list-decimal space-y-1 pl-4">
            <li>Agrega la(s) cuenta(s) bancaria(s) del conjunto (botón “Agregar cuenta”).</li>
            <li>Selecciona la cuenta e importa el extracto del banco en formato CSV.</li>
            <li>Empareja cada línea del extracto con su movimiento en el Libro (“Conciliar”).</li>
            <li>Las líneas sin pareja quedan <strong>pendientes</strong>: ahí están las diferencias — un movimiento que faltó registrar, un cobro doble o una comisión bancaria.</li>
            <li>Cuando no quedan pendientes, el saldo del banco coincide con el del Libro: la cuenta queda conciliada del período.</li>
          </ol>
        }
      />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Conciliación bancaria</CardTitle>
          <CardDescription className="mt-1">Importa el extracto y cuádralo contra el libro.</CardDescription>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAccountModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--slate-600)]">
          Aún no hay cuentas bancarias. Agrega una para empezar a conciliar.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--slate-700)]">
            Cuenta
            <select
              className="mt-1 h-10 w-full min-w-[220px] rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.bankName}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            className="w-full sm:w-auto"
            disabled={importing || !selectedAccountId}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importando..." : "Importar extracto CSV"}
          </Button>
        </div>
      )}

      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}

      {accounts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Líneas importadas</p>
            <p className="mt-1 text-lg font-semibold text-[var(--slate-900)]">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Conciliadas</p>
            <p className="mt-1 text-lg font-semibold text-[var(--tinte-verde-texto-1)]">{summary.conciliadas}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Sin conciliar</p>
            <p className="mt-1 text-lg font-semibold text-[var(--tinte-ambar-texto-1)]">{summary.pendientes}</p>
          </div>
          {/*
            **Descartar es una decisión tomada, no trabajo pendiente.** Contarla
            en «sin conciliar» hacía que ese número no bajara nunca a cero por
            mucho que se trabajara — y ese número es el que dice si la cuenta
            cuadra. Lo cazó mirar la pantalla en staging: decía 7 con seis
            líneas abiertas debajo.
          */}
          {summary.descartadas > 0 ? (
            <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Descartadas</p>
              <p className="mt-1 text-lg font-semibold text-[var(--slate-700)]">{summary.descartadas}</p>
            </div>
          ) : null}
          {summary.aRevisar > 0 ? (
            <div className="rounded-xl border border-[var(--danger-200)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">A revisar</p>
              <p className="mt-1 text-lg font-semibold text-[var(--danger-700)]">{summary.aRevisar}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {lines.length > 0 && !bandejaAgrupada ? (
        <div className="mt-4">
          <Grupo
            titulo="Líneas del extracto"
            ayuda="Cada línea dice si cuadra y con qué."
            lineas={lines}
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
        </div>
      ) : null}

      {lines.length > 0 && bandejaAgrupada ? (
        <div className="mt-4 space-y-5">
          {/*
            **La bandeja.** Los grupos NO son una taxonomía inventada: son los
            arquetipos que salieron de medir las 27 líneas de producción. Seis
            SPEI idénticos que solo distingue el código de unidad del texto, una
            comisión bancaria sin contraparte y un depósito sin identificar.
          */}
          {summary.aRevisar > 0 ? (
            <Grupo
              titulo="Conciliaciones a revisar"
              ayuda="Están casadas, pero el banco y el libro no dicen lo mismo. No se corrigen solas: revísalas y deshaz la que no cuadre."
              lineas={lines.filter((l) => incoherentes.has(l.id))}
            
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
          ) : null}
          <Grupo
            titulo="Con un movimiento que encaja"
            ayuda="Hay exactamente un movimiento del libro que cuadra en importe, sentido y fecha."
            lineas={bandeja.propuestas}
          
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
          <Grupo
            titulo="Con varios candidatos"
            ayuda="Varios movimientos encajan igual de bien. Mira la descripción de la línea: suele traer la unidad."
            lineas={bandeja.varias}
          
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
          <Grupo
            titulo="Sin movimiento que les corresponda"
            ayuda="No hay nada en el libro que cuadre. Suelen ser comisiones del banco o dinero que falta registrar."
            lineas={bandeja.sinContraparte}
          
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
          <Grupo titulo="Descartadas" ayuda="Se decidió que no casan con nada, y consta el motivo." lineas={bandeja.rechazadas} 
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
          <Grupo
            titulo="Conciliadas"
            ayuda="Cuadran en importe, sentido y fecha."
            lineas={lines.filter((l) => l.reconciled && !incoherentes.has(l.id))}
          
            formatAmount={formatAmount}
            incoherentes={incoherentes}
            casoPorLinea={casoPorLinea}
            candidatosPorLinea={candidatosPorLinea}
            onConciliar={setMatchTarget}
            onDeshacer={(l) => void handleUnmatch(l)}
            onDescartar={setRejectTarget}
            onEliminar={(l) => void handleDeleteLine(l)}
          />
        </div>
      ) : null}

      {/*
        **El vacío se pinta cuando NO hay líneas, y punto.**
        Estaba colgado del `else` de la lista agrupada, así que con la bandera
        apagada salía «Importa un extracto para ver las líneas a conciliar»
        **debajo de cinco líneas ya importadas**. Lo cazó abrir producción: una
        condición compuesta que mezcla «no hay datos» con «esta vista no toca»
        acaba diciendo lo que no es.
      */}
      {lines.length === 0 && accounts.length > 0 ? (
        <p className="mt-4 text-sm text-[var(--slate-500)]">
          Importa un extracto para ver las líneas a conciliar.
        </p>
      ) : null}

      {/* Modal: descartar una línea con motivo (R6) */}
      <Modal open={Boolean(rejectTarget)} title="Descartar esta línea" onClose={() => setRejectTarget(null)}>
        {rejectTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
              <p className="text-[var(--slate-700)]">
                Línea del banco: <strong>{formatAmount(rejectTarget.amount)}</strong> · {rejectTarget.date}
              </p>
              <p className="text-xs text-[var(--slate-500)]">{rejectTarget.description || "Sin descripción"}</p>
            </div>
            {/*
              **El motivo es obligatorio, y el catálogo está cerrado.** Sin él la
              línea se quedaba «pendiente» y muda: dentro de un mes nadie sabría
              si es una comisión del banco o algo que falta registrar. El
              servidor se niega igual si llega sin motivo — esto solo evita el
              viaje.
            */}
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">¿Por qué no casa con nada?</label>
              <select
                className="w-full rounded-xl border border-[var(--slate-200)] bg-[var(--surface)] p-2 text-sm"
                value={motivoCodigo}
                onChange={(e) => setMotivoCodigo(e.target.value)}
              >
                {MOTIVOS_DE_RECHAZO.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {motivoCodigo === "otro" ? (
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Cuéntalo en una línea</label>
                <Input value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)} />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectTarget(null)}>
                Cancelar
              </Button>
              <Button
                disabled={motivoCodigo === "otro" && motivoTexto.trim().length === 0}
                onClick={() => void handleReject()}
              >
                Descartar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal: agregar cuenta bancaria */}
      <Modal open={accountModalOpen} title="Agregar cuenta bancaria" onClose={() => setAccountModalOpen(false)}>
        <form className="space-y-3" onSubmit={accountForm.handleSubmit((values) => void handleSaveAccount(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre de la cuenta</label>
            <Input {...accountForm.register("label")} placeholder="Cuenta operativa" />
            {accountForm.formState.errors.label ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{accountForm.formState.errors.label.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Banco</label>
            <Input {...accountForm.register("bankName")} placeholder="Banco" />
            {accountForm.formState.errors.bankName ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{accountForm.formState.errors.bankName.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" {...accountForm.register("accountType")}>
                <option value="corriente">Corriente</option>
                <option value="ahorros">Ahorros</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Moneda
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" {...accountForm.register("currency")}>
                <option value="COP">COP</option>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Número de cuenta (opcional)
              <Input className="mt-1" {...accountForm.register("accountNumber")} placeholder="****1234" />
            </label>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Saldo inicial</label>
              <Input type="number" step="0.01" {...accountForm.register("openingBalance", { valueAsNumber: true })} placeholder="0" />
            </div>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setAccountModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingAccount}>
              {savingAccount ? "Guardando..." : "Guardar cuenta"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: conciliar línea con movimiento del libro */}
      <Modal open={Boolean(matchTarget)} title="Conciliar con un movimiento" onClose={() => setMatchTarget(null)}>
        {matchTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
              <p className="text-[var(--slate-700)]">
                Línea del banco: <strong>{formatAmount(matchTarget.amount)}</strong> · {matchTarget.date}
              </p>
              <p className="text-xs text-[var(--slate-500)]">{matchTarget.description || "Sin descripción"}</p>
            </div>
            {matchCandidates.length === 0 ? (
              // **Decir por qué no hay, no «no hay».** Antes esta lista traía
              // todos los movimientos sin conciliar del conjunto ordenados por
              // parecido, y el primero parecía siempre el bueno.
              <p className="text-sm text-[var(--slate-500)]">
                Ningún movimiento del libro cuadra con esta línea: hace falta que coincidan el importe, el sentido
                —entra o sale— y la fecha con tres días de margen. Si es una comisión del banco o algo que falta
                registrar, descártala con su motivo.
              </p>
            ) : (
              <ul className="max-h-[320px] space-y-2 overflow-y-auto">
                {matchCandidates.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-[var(--slate-200)] p-3 text-left hover:border-[var(--brand-400)]"
                      onClick={() => void handleMatch(entry)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[var(--slate-900)]">{entry.concept}</span>
                        <span className={entry.type === "ingreso" ? "text-[var(--tinte-verde-texto-1)]" : "text-[var(--tinte-ambar-texto-1)]"}>
                          {entry.type === "ingreso" ? "+" : "−"}
                          {formatAmount(entry.amount)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--slate-500)]">{entry.date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
      </Card>
    </div>
  );
}
