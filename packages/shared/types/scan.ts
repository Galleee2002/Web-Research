import type { SearchRunStatus } from "../constants/domain";

export interface ScanListItem {
  id: string;
  searchRunId: string | null;
  provider: string | null;
  providerEndpoint: string | null;
  httpStatus: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  correlationId: string | null;
  observability: Record<string, unknown>;
}

export interface ScanFilters {
  page: number;
  page_size: number;
  provider?: string;
  status?: SearchRunStatus;
  from?: string;
  to?: string;
}

export interface PaginatedScansResponse {
  items: ScanListItem[];
  total: number;
  page: number;
  page_size: number;
  globalRequestCount: number;
}
