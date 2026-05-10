// Componente reutilizable: VisitorInvitationSummaryCard
// Muestra resumen visual de invitación, usado en detalle y QR

import { VisitorInvitation } from 'features/visitors/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from 'features/visitors/utils/formatDateTime';

interface Props {
  invitation: VisitorInvitation;
  showQR?: boolean;
  onShowQR?: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
}

export function VisitorInvitationSummaryCard({ invitation, showQR, onShowQR, onCancel, cancelling }: Props) {
  const isActive = invitation.status === 'active';
  const statusLabel =
    invitation.status === 'active'
      ? 'Activa'
      : invitation.status === 'cancelled'
        ? 'Cancelada'
        : invitation.status === 'expired'
          ? 'Expirada'
          : 'Usada';

  const statusClassName =
    invitation.status === 'active'
      ? 'bg-[var(--brand-50)] text-[var(--brand-900)]'
      : invitation.status === 'cancelled'
        ? 'bg-[var(--danger-100)] text-[var(--danger-700)]'
        : invitation.status === 'expired'
          ? 'bg-[var(--slate-200)] text-[var(--slate-700)]'
          : 'bg-[var(--warning-100)] text-[var(--warning-800)]';

  return (
    <article className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_8px_20px_rgba(10,40,70,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--slate-900)]">{invitation.visitorName}</h3>
          <p className="text-sm text-[var(--slate-600)]">ID: {invitation.visitorIdentification}</p>
          {invitation.plate ? <p className="text-sm text-[var(--slate-600)]">Placa: {invitation.plate}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusClassName}>{statusLabel}</Badge>
          <span className="text-xs font-medium tracking-[0.16em] text-[var(--slate-500)]">{invitation.invitationCode}</span>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--slate-500)]">Autorizado por</dt>
          <dd className="font-medium text-[var(--slate-900)]">{invitation.authorizedByName}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Unidad</dt>
          <dd className="font-medium text-[var(--slate-900)]">{invitation.unitLabel ?? invitation.unitId}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Cantidad de personas</dt>
          <dd className="font-medium text-[var(--slate-900)]">{invitation.adultsCount} adultos, {invitation.childrenCount} ninos</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Usos permitidos</dt>
          <dd className="font-medium text-[var(--slate-900)]">{invitation.allowedUses}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--slate-500)]">Observaciones</dt>
          <dd className="font-medium text-[var(--slate-900)]">{invitation.visitReason}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--slate-500)]">Vigencia</dt>
          <dd className="font-medium text-[var(--slate-900)]">{formatDateTime(invitation.startAt)} - {formatDateTime(invitation.endAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {showQR && onShowQR ? (
          <Button onClick={onShowQR} disabled={!isActive}>
            Ver invitacion (QR)
          </Button>
        ) : null}
        {onCancel ? (
          <Button onClick={onCancel} variant="danger" disabled={!isActive || cancelling}>
            {invitation.status === 'cancelled' ? 'Invitacion cancelada' : cancelling ? 'Cancelando...' : 'Cancelar invitacion'}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
