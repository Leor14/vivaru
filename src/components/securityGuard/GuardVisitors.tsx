"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  addGuardNote,
  markVisitorAsCompleted,
  markVisitorAsInside,
  useVisitorPasses,
} from "@/features/visitors/use-visitor-passes";
import {
  normalizeQrPayload,
  resolveVisitorFromQr,
  type ScanResultState,
  type VisitorCardItem,
} from "@/features/visitors/guard-qr-validation";
import type { VisitorPass } from "@/types/domain";
import { storage } from "@/lib/firebase/client";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { combineLocalDateTime, formatDateSafe, formatDateTimeSafe, toLocalDate } from "@/utils/date";
import { getStatusLabel as mapStatusLabel } from "@/utils/statusMapper";

type OperationalStatus = "scheduled" | "inside" | "completed" | "expired";

type CameraState = "idle" | "starting" | "active" | "unsupported" | "denied" | "error";

type ReaderLike = {
  decodeFromVideoDevice: (
    deviceId: string | undefined,
    videoElement: HTMLVideoElement,
    callback: (result: { getText: () => string } | null, error: unknown) => void,
  ) => Promise<IScannerControls>;
  reset?: () => void;
};

function formatDate(value: string) {
  if (!value) return "-";
  return formatDateSafe(value, "es-CO");
}

function formatTime(value: string) {
  if (!value) return "-";
  const parsed = toLocalDate(value);
  if (parsed) {
    return new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed);
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  return value;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return formatDateTimeSafe(value, "es-CO");
}

function parseVisitDateTime(date: string, scheduledTime: string) {
  const normalizedDate = date?.trim();
  const normalizedTime = scheduledTime?.trim();

  if (!normalizedDate) return null;

  return combineLocalDateTime(normalizedDate, normalizedTime);
}

/** Una autorización de larga duración está vigente hasta el fin del día de validUntil. */
function isWithinValidity(item: VisitorPass): boolean {
  const until = item.validUntil;
  if (!until) return true;
  const endOfDay = new Date(`${until}T23:59:59`);
  return Number.isNaN(endOfDay.getTime()) ? true : endOfDay.getTime() >= Date.now();
}

function resolveOperationalStatus(item: VisitorPass): OperationalStatus {
  if (item.status === "inside") return "inside";
  if (item.status === "completed") return "completed";

  // Larga duración: vigente mientras no se pase validUntil (ingresos repetidos).
  if (item.authorizationType === "larga_duracion" && item.validUntil) {
    return isWithinValidity(item) ? "scheduled" : "expired";
  }

  // Puntual / legacy: expira al pasar la fecha-hora programada (comportamiento existente).
  const visitDateTime = parseVisitDateTime(item.date, item.scheduledTime);
  if (!visitDateTime) return "scheduled";
  return visitDateTime.getTime() < Date.now() ? "expired" : "scheduled";
}

function abbreviateQrCode(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getStatusLabel(status: OperationalStatus) {
  if (status === "inside") return mapStatusLabel("inside");
  if (status === "completed") return mapStatusLabel("completed");
  if (status === "expired") return mapStatusLabel("expired");
  return mapStatusLabel("scheduled");
}

function getStatusClass(status: OperationalStatus) {
  if (status === "inside") return "bg-sky-100 text-sky-700";
  if (status === "completed") return "bg-[var(--slate-200)] text-[var(--slate-700)]";
  if (status === "expired") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export function GuardVisitors({ tenantId, guardId, guardName }: { tenantId?: string; guardId?: string; guardName?: string }) {
  const { items, loading, error } = useVisitorPasses(tenantId);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [noteDialogOpen, setNoteDialogOpen] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteImage, setNoteImage] = useState<File | null>(null);
  const [notePreview, setNotePreview] = useState<string | null>(null);

  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResultState>({ kind: "idle" });
  const [lastSuccessfulScanVisitorId, setLastSuccessfulScanVisitorId] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scannerReaderRef = useRef<ReaderLike | null>(null);
  const isStartingScannerRef = useRef(false);
  const isProcessingScanRef = useRef(false);
  const lastProcessedCodeRef = useRef<string>("");

  async function handleCheckIn(item: VisitorPass) {
    if (!tenantId || updatingId) return;

    setUpdatingId(item.id);
    try {
      await markVisitorAsInside({
        visitorId: item.id,
        tenantId,
        previousStatus: item.status,
      });
      toast.success("Ingreso registrado correctamente");
    } catch (actionError) {
      toastFirebaseError(actionError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCheckOut(item: VisitorPass) {
    if (!tenantId || updatingId) return;

    setUpdatingId(item.id);
    try {
      const reentrable = item.authorizationType === "larga_duracion" && isWithinValidity(item);
      await markVisitorAsCompleted({
        visitorId: item.id,
        tenantId,
        previousStatus: item.status,
        reentrable,
      });
      toast.success(reentrable ? "Salida registrada. La autorización sigue vigente." : "Salida registrada correctamente");
    } catch (actionError) {
      toastFirebaseError(actionError);
    } finally {
      setUpdatingId(null);
    }
  }

  const rows = useMemo<VisitorCardItem[]>(
    () => items.map((item) => ({ ...item, operationalStatus: resolveOperationalStatus(item) })),
    [items],
  );

  const noteVisitor = useMemo(
    () => rows.find((item) => item.id === noteDialogOpen) ?? null,
    [rows, noteDialogOpen],
  );

  const selectedVisitor = useMemo(
    () => rows.find((item) => item.id === selectedVisitorId) ?? null,
    [rows, selectedVisitorId],
  );

  const validatedVisitor = useMemo(() => {
    if (scanResult.kind !== "found") return null;
    const liveVisitor = rows.find((item) => item.id === scanResult.visitor.id);
    return liveVisitor ?? scanResult.visitor;
  }, [rows, scanResult]);

  function clearNoteImage() {
    setNoteImage(null);
    setNotePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function handleNoteImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen no puede superar 8 MB.");
      return;
    }
    clearNoteImage();
    setNoteImage(file);
    setNotePreview(URL.createObjectURL(file));
  }

  function openNoteDialog(item: VisitorPass) {
    setNoteDialogOpen(item.id);
    setNoteText("");
    clearNoteImage();
  }

  function closeNoteDialog() {
    setNoteDialogOpen(null);
    setNoteText("");
    clearNoteImage();
  }

  async function handleSaveNote() {
    if (!noteDialogOpen || !guardId || (!noteText.trim() && !noteImage)) return;
    setSavingNote(true);
    try {
      let imageUrl: string | undefined;
      let storagePath: string | undefined;
      if (noteImage && tenantId && storage) {
        const clean = noteImage.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
        storagePath = `tenants/${tenantId}/visitor-notes/${noteDialogOpen}/${Date.now()}-${clean}`;
        const sref = storageRef(storage, storagePath);
        await uploadBytes(sref, noteImage);
        imageUrl = await getDownloadURL(sref);
      }
      await addGuardNote(noteDialogOpen, {
        text: noteText.trim(),
        guardId,
        guardName,
        imageUrl,
        storagePath,
      });
      toast.success("Nota guardada");
      setNoteText("");
      clearNoteImage();
      setNoteDialogOpen(null);
    } catch (err) {
      toastFirebaseError(err);
    } finally {
      setSavingNote(false);
    }
  }

  function openVisitorDetail(item: VisitorPass) {
    setSelectedVisitorId(item.id);
    setLastSuccessfulScanVisitorId(null);
    setQrExpanded(false);
    setDetailDrawerOpen(true);
  }

  function closeDetailDrawer() {
    setDetailDrawerOpen(false);
    setLastSuccessfulScanVisitorId(null);
  }

  async function copyDocument(value: string) {
    if (!value) {
      toast.error("No hay documento para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Documento copiado.");
    } catch {
      toast.error("No fue posible copiar el documento.");
    }
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    scannerReaderRef.current?.reset?.();
    scannerReaderRef.current = null;
    setCameraState("idle");
  }

  const resolveCode = useCallback((rawCode: string, source: "camera" | "manual") => {
    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;

    const code = normalizeQrPayload(rawCode);

    console.debug("[guard:qr] validate:start", {
      source,
      tenantId: tenantId ?? null,
      scannedCodePreview: abbreviateQrCode(code),
    });

    const result = resolveVisitorFromQr({
      rawCode,
      rows,
      tenantId,
    });

    if (result.kind === "found") {
      console.debug("[guard:qr] validate:success", {
        selectedVisitorId: result.visitor.id,
        selectedVisitorName: result.visitor.visitorName,
      });

      stopScanner();
      setScannerOpen(false);
      setSelectedVisitorId(result.visitor.id);
      setLastSuccessfulScanVisitorId(result.visitor.id);
      setDetailDrawerOpen(true);
      setQrExpanded(false);
      toast.success(`Bienvenido, ${result.visitor.visitorName}`);
    }

    if (result.kind === "not-found") {
      console.debug("[guard:qr] validate:not-found", {
        tenantId: tenantId ?? null,
        scannedCodePreview: abbreviateQrCode(result.code),
        totalRows: rows.length,
      });
    }

    setScanResult(result);

    if (result.kind !== "found") {
      window.setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 250);
      return;
    }

    isProcessingScanRef.current = false;
  }, [rows, tenantId]);

  const startScanner = useCallback(async () => {
    if (!scannerOpen || !videoRef.current || isStartingScannerRef.current) return;

    if (!window.isSecureContext) {
      setCameraState("error");
      setCameraErrorMessage("La camara requiere HTTPS o localhost.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState("unsupported");
      setCameraErrorMessage("Este navegador no soporta camara web.");
      return;
    }

    isStartingScannerRef.current = true;
    setCameraState("starting");
    setCameraErrorMessage(null);

    try {
      const zxingModule = await import("@zxing/browser");
      const BrowserMultiFormatReader = zxingModule.BrowserMultiFormatReader;

      const reader = new BrowserMultiFormatReader();
      scannerReaderRef.current = reader as unknown as ReaderLike;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const preferredCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
      const selectedDeviceId = preferredCamera?.deviceId;

      scannerControlsRef.current = await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result) => {
          if (!result) return;

          const scannedCode = result.getText().trim();
          if (!scannedCode) return;
          if (lastProcessedCodeRef.current === scannedCode) return;

          lastProcessedCodeRef.current = scannedCode;
          setManualCode(scannedCode);
          resolveCode(scannedCode, "camera");
          toast.success("QR leido correctamente");
        },
      );

      setCameraState("active");
    } catch (cameraError) {
      const message = cameraError instanceof Error ? cameraError.message : "No se pudo activar la camara.";
      const normalized = message.toLowerCase();
      const denied = normalized.includes("permission") || normalized.includes("notallowed");
      setCameraState(denied ? "denied" : "error");
      setCameraErrorMessage(denied ? "Permiso de camara denegado." : message);
      stopScanner();
    } finally {
      isStartingScannerRef.current = false;
    }
  }, [resolveCode, scannerOpen]);

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      return;
    }

    void startScanner();

    return () => {
      stopScanner();
    };
  }, [scannerOpen, startScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  function openScanner() {
    console.debug("[guard:qr] scanner:open", {
      tenantId: tenantId ?? null,
      totalRows: rows.length,
    });
    setScannerOpen(true);
    setManualCode("");
    setScanResult({ kind: "idle" });
    setCameraErrorMessage(null);
    setCameraState("idle");
    lastProcessedCodeRef.current = "";
  }

  function closeScanner() {
    isProcessingScanRef.current = false;
    setScannerOpen(false);
  }

  function handleManualValidation() {
    resolveCode(manualCode, "manual");
  }

  async function handleCheckInFromScan() {
    if (!validatedVisitor) return;

    if (validatedVisitor.operationalStatus !== "scheduled") {
      toast.error("Este visitante no esta habilitado para registrar ingreso.");
      return;
    }

    await handleCheckIn(validatedVisitor);
  }

  const detailLogs = useMemo(() => {
    if (!selectedVisitor) return [];

    const logs: string[] = [
      `Invitacion programada para ${formatDate(selectedVisitor.date)} a las ${formatTime(selectedVisitor.scheduledTime)}.`,
    ];

    if (selectedVisitor.checkInAt) {
      logs.push(`Ingreso registrado: ${formatDateTime(selectedVisitor.checkInAt)}.`);
    }

    if (selectedVisitor.checkOutAt) {
      logs.push(`Salida registrada: ${formatDateTime(selectedVisitor.checkOutAt)}.`);
    }

    if (selectedVisitor.operationalStatus === "expired") {
      logs.push("Invitacion expirada por tiempo operativo sin ingreso.");
    }

    return logs;
  }, [selectedVisitor]);

  const renderActions = (item: VisitorCardItem, opts?: { hideDetail?: boolean }) => (
    <div className={`grid gap-2 grid-cols-2 ${opts?.hideDetail ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
      <Button
        size="sm"
        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={() => void handleCheckIn(item)}
        disabled={updatingId === item.id || item.operationalStatus !== "scheduled"}
      >
        {updatingId === item.id && item.status === "scheduled" ? "Guardando..." : "Entró"}
      </Button>
      <Button
        size="sm"
        className="w-full bg-rose-100 text-rose-700 hover:bg-rose-200"
        onClick={() => void handleCheckOut(item)}
        disabled={updatingId === item.id || item.status !== "inside"}
      >
        {updatingId === item.id && item.status === "inside" ? "Guardando..." : "Salió"}
      </Button>
      {!opts?.hideDetail && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => openVisitorDetail(item)}>
          Ver detalle
        </Button>
      )}
      <Button size="sm" variant="ghost" className="w-full" onClick={() => openNoteDialog(item)}>
        📝 Nota
      </Button>
    </div>
  );

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Visitantes</CardTitle>
            <CardDescription className="mt-1">Operación en tiempo real para validar identidad y registrar ingreso/salida sin friccion.</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={openScanner}>
            Escanear QR
          </Button>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--danger-700)]">{error}</p> : null}

        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--slate-300)] px-4 py-6 text-center text-sm text-[var(--slate-600)]">
            No hay visitantes programados
          </p>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="mt-4 space-y-3">
            {rows.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_10px_24px_rgba(10,40,70,0.08)] transition duration-200 hover:border-sky-300 hover:shadow-[0_14px_28px_rgba(10,40,70,0.12)]"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => openVisitorDetail(item)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--slate-900)]">{item.visitorName}</h3>
                      <p className="mt-1 text-sm text-[var(--slate-600)]">Documento: {item.documentNumber || "-"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={getStatusClass(item.operationalStatus)}>{getStatusLabel(item.operationalStatus)}</Badge>
                      {item.authorizationType === "larga_duracion" && item.validUntil ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          Vigente hasta {formatDate(item.validUntil)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p className="text-[var(--slate-700)]">Visita a: <span className="font-medium">{item.hostResidentName}</span></p>
                    <p className="text-[var(--slate-700)]">Torre / Unidad: <span className="font-medium">{item.tower} / {item.unit}</span></p>
                    <p className="text-[var(--slate-700)]">Fecha: <span className="font-medium">{formatDate(item.date)}</span></p>
                    <p className="text-[var(--slate-700)]">Hora: <span className="font-medium">{formatTime(item.scheduledTime)}</span></p>
                  </div>

                  <div className="mt-3 inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 font-mono text-xs font-medium text-sky-700">
                    QR {abbreviateQrCode(item.qrCodeValue || "-")}
                  </div>
                </button>

                <div className="mt-4">{renderActions(item)}</div>
              </article>
            ))}
          </div>
        ) : null}
      </Card>

      {detailDrawerOpen && selectedVisitor ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            aria-label="Cerrar detalle"
            onClick={closeDetailDrawer}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--slate-200)] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Detalle operativo</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{selectedVisitor.visitorName}</h2>
              </div>
              <Button type="button" variant="outline" onClick={closeDetailDrawer}>Cerrar</Button>
            </div>

            <div className="mt-5 space-y-4">
              {lastSuccessfulScanVisitorId === selectedVisitor.id ? (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">Validacion exitosa</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-900">Bienvenido, {selectedVisitor.visitorName}</p>
                  <p className="mt-1 text-sm text-emerald-800">QR valido. Continua con la accion operativa de porteria.</p>
                </section>
              ) : null}

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[var(--slate-600)]">Estado</p>
                  <Badge className={getStatusClass(selectedVisitor.operationalStatus)}>{getStatusLabel(selectedVisitor.operationalStatus)}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="text-[var(--slate-700)]">Documento: <span className="font-medium text-[var(--slate-900)]">{selectedVisitor.documentNumber || "-"}</span></p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() => void copyDocument(selectedVisitor.documentNumber)}
                  >
                    Copiar documento
                  </Button>
                  <p className="text-[var(--slate-700)]">Residente anfitrion: <span className="font-medium text-[var(--slate-900)]">{selectedVisitor.hostResidentName}</span></p>
                  <p className="text-[var(--slate-700)]">Torre / Unidad: <span className="font-medium text-[var(--slate-900)]">{selectedVisitor.tower} / {selectedVisitor.unit}</span></p>
                  <p className="text-[var(--slate-700)]">Fecha y hora: <span className="font-medium text-[var(--slate-900)]">{formatDate(selectedVisitor.date)} {formatTime(selectedVisitor.scheduledTime)}</span></p>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--slate-800)]">Codigo QR</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setQrExpanded((prev) => !prev)}>
                    {qrExpanded ? "Reducir" : "Expandir"}
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-center rounded-xl bg-[var(--slate-100)] p-4">
                  {selectedVisitor.qrCodeValue ? (
                    <QRCodeSVG
                      value={selectedVisitor.qrCodeValue}
                      size={qrExpanded ? 220 : 132}
                      bgColor="transparent"
                      fgColor="#0b3c5d"
                    />
                  ) : (
                    <p className="text-sm text-[var(--slate-500)]">Código QR no disponible</p>
                  )}
                </div>
                <p className="mt-2 break-all text-center font-mono text-xs text-[var(--slate-600)]">{selectedVisitor.qrCodeValue || "Sin codigo QR"}</p>
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <p className="text-sm font-medium text-[var(--slate-800)]">Historial operativo</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-[var(--slate-700)]">Entrada: <span className="font-medium text-[var(--slate-900)]">{formatDateTime(selectedVisitor.checkInAt)}</span></p>
                  <p className="text-[var(--slate-700)]">Salida: <span className="font-medium text-[var(--slate-900)]">{formatDateTime(selectedVisitor.checkOutAt)}</span></p>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--slate-800)]">Notas de portería</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => openNoteDialog(selectedVisitor)}>
                    📝 Agregar nota
                  </Button>
                </div>
                {(selectedVisitor.guardNotes?.length ?? 0) > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {selectedVisitor.guardNotes!.map((n, i) => (
                      <li key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                        {n.text ? <p className="text-[var(--slate-800)]">{n.text}</p> : null}
                        {n.imageUrl ? (
                          <a href={n.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={n.imageUrl} alt="Adjunto de la nota" className="max-h-40 rounded-lg border border-amber-200 object-cover" />
                          </a>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--slate-500)]">
                          {n.guardName ?? "Guardia"} · {new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[var(--slate-500)]">Sin notas registradas.</p>
                )}
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <p className="text-sm font-medium text-[var(--slate-800)]">Logs del visitante</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {detailLogs.map((log) => (
                    <li key={log} className="rounded-lg bg-[var(--slate-100)] px-3 py-2 text-[var(--slate-700)]">{log}</li>
                  ))}
                </ul>
              </section>

              <section>{renderActions(selectedVisitor, { hideDetail: true })}</section>
            </div>
          </aside>
        </div>
      ) : null}

      {noteDialogOpen && noteVisitor ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            aria-label="Cerrar notas"
            onClick={closeNoteDialog}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-[var(--slate-200)] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Notas de portería</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--slate-900)]">{noteVisitor.visitorName}</h2>
              </div>
              <Button type="button" variant="outline" onClick={closeNoteDialog}>Cerrar</Button>
            </div>

            {(noteVisitor.guardNotes?.length ?? 0) > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {noteVisitor.guardNotes!.map((n, i) => (
                  <li key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    {n.text ? <p className="text-[var(--slate-800)]">{n.text}</p> : null}
                    {n.imageUrl ? (
                      <a href={n.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={n.imageUrl} alt="Adjunto de la nota" className="max-h-40 rounded-lg border border-amber-200 object-cover" />
                      </a>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--slate-500)]">
                      {n.guardName ?? "Guardia"} · {new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--slate-500)]">Sin notas registradas.</p>
            )}

            <div className="mt-5 space-y-3">
              <Textarea
                label="Nueva nota"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value.slice(0, 300))}
                placeholder="Ej: Llegó con 2 personas extra"
                rows={3}
              />
              <p className="text-right text-xs text-[var(--slate-500)]">{noteText.length}/300</p>

              <div>
                <input id="guard-note-image" type="file" accept="image/*" className="hidden" onChange={handleNoteImageChange} />
                {notePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={notePreview} alt="Previsualización" className="max-h-32 rounded-lg border border-[var(--slate-200)]" />
                    <button
                      type="button"
                      onClick={clearNoteImage}
                      className="absolute -right-2 -top-2 rounded-full bg-[var(--slate-900)] px-2 py-0.5 text-xs font-medium text-white"
                      aria-label="Quitar imagen"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="guard-note-image"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--slate-300)] px-3 py-1.5 text-sm font-medium text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
                  >
                    📷 Adjuntar imagen
                  </label>
                )}
              </div>

              <Button
                className="w-full"
                disabled={(!noteText.trim() && !noteImage) || savingNote}
                onClick={() => void handleSaveNote()}
              >
                {savingNote ? "Guardando..." : "Guardar nota"}
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      {scannerOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Cerrar escáner"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeScanner}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--slate-200)] bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Porteria</p>
                <h2 className="text-xl font-semibold text-[var(--slate-900)]">Escanear QR</h2>
              </div>
              <Button type="button" variant="outline" onClick={closeScanner}>Cerrar</Button>
            </div>

            <p className="mt-2 text-sm text-[var(--slate-600)]">Apunta la camara al QR del visitante o usa el ingreso manual.</p>

            <div className="mt-4 rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-100)] p-3">
              <div className="relative overflow-hidden rounded-xl bg-slate-950">
                <video
                  ref={videoRef}
                  className="h-72 w-full object-cover sm:h-80"
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 border-[3px] border-emerald-400/70" />
              </div>

              <div className="mt-3 text-sm">
                {cameraState === "starting" ? <p className="text-[var(--slate-700)]">Activando camara...</p> : null}
                {cameraState === "active" ? <p className="text-emerald-700">Camara activa. Escaneando en tiempo real.</p> : null}
                {cameraState === "unsupported" ? <p className="text-[var(--danger-700)]">Camara no soportada en este navegador.</p> : null}
                {cameraState === "denied" ? <p className="text-[var(--danger-700)]">Permiso de camara denegado.</p> : null}
                {cameraState === "error" ? <p className="text-[var(--danger-700)]">{cameraErrorMessage ?? "No fue posible iniciar la camara."}</p> : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--slate-200)] p-4">
              <p className="text-sm font-medium text-[var(--slate-800)]">Fallback manual</p>
              <div className="mt-3 space-y-2">
                <Input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="Pega o escribe el codigo QR"
                />
                <Button className="w-full" onClick={handleManualValidation}>Validar codigo</Button>
              </div>
            </div>

            {scanResult.kind === "not-found" ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                Codigo no valido o QR no encontrado. Reintenta con otro codigo.
              </div>
            ) : null}

            {validatedVisitor ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                QR valido para {validatedVisitor.visitorName}. Abriendo detalle operativo.
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
