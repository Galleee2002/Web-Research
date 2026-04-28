import type { PaginatedScansResponse } from "@shared/index";

import {
  buildQueryString,
  readJsonBody,
  toApiClientError,
} from "@/lib/api/request";

export type ScansQuery = {
  page?: number;
  page_size?: number;
  started_at_order?: "asc" | "desc";
  from?: string;
  to?: string;
  status?: "completed" | "failed";
};

export async function fetchScansPage(
  params: ScansQuery,
  init?: RequestInit
): Promise<PaginatedScansResponse> {
  const search = buildQueryString({
    page: params.page ?? 1,
    page_size: params.page_size ?? 100,
    started_at_order: params.started_at_order ?? "desc",
    from: params.from,
    to: params.to,
    status: params.status,
  });
  const response = await fetch(`/api/scans${search}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init,
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  return body as PaginatedScansResponse;
}
