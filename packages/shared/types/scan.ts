import type { SearchRunStatus } from "../constants/domain";

export interface ScanListItem {
  id: string;
  searchRunId: string | null;
  provider: string | null;
  providerEndpoint: string | null;
  httpStatus: number | null;
  /** DB `search_runs.status` (e.g. completed, failed). */
  status: SearchRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  correlationId: string | null;
  observability: Record<string, unknown>;
}

export type ScanStartedAtOrder = "asc" | "desc";

export interface ScanFilters {
  page: number;
  page_size: number;
  provider?: string;
  status?: SearchRunStatus;
  from?: string;
  to?: string;
  /** Sort scans by `started_at`. Defaults to `desc` when omitted (API / DB). */
  started_at_order?: ScanStartedAtOrder;
}

export interface PaginatedScansResponse {
  items: ScanListItem[];
  total: number;
  page: number;
  page_size: number;
  globalRequestCount: number;
}
