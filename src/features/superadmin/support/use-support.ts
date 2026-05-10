import { useEffect, useState } from "react";

import type { SupportTicket } from "./types";
import { watchSupportTickets } from "./services";

export function useSupportTickets(filters: {
  tenantId?: string;
  status?: string;
  priority?: string;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = watchSupportTickets(
      filters,
      (items) => {
        setTickets(items);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tenantId, filters.status, filters.priority]);

  return { tickets, loading, error };
}
