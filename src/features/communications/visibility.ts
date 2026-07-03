type PrimitiveCommunication = {
  id: string;
  tenantId?: string;
  title?: string;
  subject?: string;
  body?: string;
  message?: string;
  content?: string;
  description?: string;
  publishedAt?: unknown;
  createdAt?: unknown;
  startsAt?: unknown;
  startDate?: unknown;
  validFrom?: unknown;
  endsAt?: unknown;
  endDate?: unknown;
  validUntil?: unknown;
  expiresAt?: unknown;
  status?: unknown;
  attachmentUrl?: unknown;
  attachmentName?: unknown;
  attachments?: unknown;
  audienceUnitIds?: unknown;
};

export type ResidentCommunicationAttachment = {
  name: string;
  url: string;
};

export type ResidentCommunication = {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  publishedAt: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  attachments: ResidentCommunicationAttachment[];
  /** Audiencia segmentada (VIV-401): vacío = todo el conjunto. */
  audienceUnitIds: string[];
};

function pickFirstText(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return "";
}

function normalizeDate(raw: unknown, boundary: "start" | "end") {
  if (!raw) return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }

  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const suffix = boundary === "end" ? "T23:59:59.999" : "T00:00:00.000";
      const dateOnly = new Date(`${value}${suffix}`);
      return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof raw === "object") {
    const value = raw as { toDate?: unknown; seconds?: unknown };
    if (typeof value.toDate === "function") {
      const fromToDate = value.toDate();
      if (fromToDate instanceof Date && !Number.isNaN(fromToDate.getTime())) {
        return fromToDate;
      }
    }
    if (typeof value.seconds === "number") {
      const fromSeconds = new Date(value.seconds * 1000);
      return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
    }
  }

  return null;
}

function toIso(value: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function normalizeAttachments(item: PrimitiveCommunication) {
  const list: ResidentCommunicationAttachment[] = [];

  if (typeof item.attachmentUrl === "string" && item.attachmentUrl.trim()) {
    list.push({
      url: item.attachmentUrl.trim(),
      name: typeof item.attachmentName === "string" && item.attachmentName.trim() ? item.attachmentName.trim() : "Adjunto",
    });
  }

  if (Array.isArray(item.attachments)) {
    item.attachments.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const candidate = entry as { url?: unknown; name?: unknown };
      if (typeof candidate.url !== "string" || !candidate.url.trim()) return;
      list.push({
        url: candidate.url.trim(),
        name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : `Adjunto ${index + 1}`,
      });
    });
  }

  const seen = new Set<string>();
  return list.filter((attachment) => {
    if (seen.has(attachment.url)) return false;
    seen.add(attachment.url);
    return true;
  });
}

function isStatusVisible(status: string, now: Date, startsAt: Date | null) {
  if (!status) return true;

  if (["draft", "archived", "inactive", "disabled", "hidden", "expired"].includes(status)) {
    return false;
  }

  if (["published", "active"].includes(status)) {
    return true;
  }

  if (status === "scheduled") {
    return startsAt ? now >= startsAt : false;
  }

  return false;
}

export function normalizeResidentCommunication(item: PrimitiveCommunication, now = new Date()): ResidentCommunication | null {
  const tenantId = typeof item.tenantId === "string" ? item.tenantId.trim() : "";
  if (!tenantId) return null;

  const title = pickFirstText([item.title, item.subject]);
  const body = pickFirstText([item.body, item.message, item.content, item.description]);
  if (!title || !body) return null;

  const startsAtDate = normalizeDate(item.startsAt ?? item.startDate ?? item.validFrom, "start");
  const endsAtDate = normalizeDate(item.endsAt ?? item.endDate ?? item.validUntil ?? item.expiresAt, "end");
  const publishedDate = normalizeDate(item.publishedAt ?? item.createdAt, "start");

  const status = typeof item.status === "string" ? item.status.toLowerCase().trim() : "";
  if (!isStatusVisible(status, now, startsAtDate)) return null;

  if (startsAtDate && now < startsAtDate) return null;
  if (endsAtDate && now > endsAtDate) return null;

  return {
    id: item.id,
    tenantId,
    title,
    body,
    publishedAt: toIso(publishedDate),
    status: status || "published",
    startsAt: toIso(startsAtDate) || null,
    endsAt: toIso(endsAtDate) || null,
    attachments: normalizeAttachments(item),
    audienceUnitIds: Array.isArray(item.audienceUnitIds)
      ? (item.audienceUnitIds as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  };
}
