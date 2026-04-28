import type {
  BusinessDetailRead,
  BusinessRead,
  BusinessStatusUpdate,
  LeadStatus,
  PaginatedResponse,
  SearchRead
} from "@shared/index";
import {
  ApiClientError,
  buildQueryString,
  readJsonBody,
  toApiClientError
} from "@/lib/api/request";

export type ListBusinessesQuery = {
  page?: number;
  page_size?: number;
  query?: string;
  status?: LeadStatus;
  has_website?: boolean;
  search_run_id?: string;
  order_by?: "created_at" | "name" | "city";
};

export class BusinessesApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly correlationId?: string;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; correlationId?: string }
  ) {
    super(message);
    this.name = "BusinessesApiError";
    this.status = status;
    this.code = options?.code;
    this.correlationId = options?.correlationId;
  }
}
export class OpportunitiesSelectionApiError extends ApiClientError {}
export class SearchRunsApiError extends ApiClientError {}

/**
 * GET /api/businesses — same-origin fetch from the browser or RSC.
 * @see docs/architecture/frontend-backend-connection.md
 */
export async function fetchBusinessesPage(
  params: ListBusinessesQuery,
  init?: RequestInit
): Promise<PaginatedResponse<BusinessRead>> {
  const search = buildQueryString({
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    ...(params.query !== undefined && params.query !== ""
      ? { query: params.query }
      : {}),
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.has_website !== undefined ? { has_website: params.has_website } : {}),
    ...(params.search_run_id !== undefined && params.search_run_id !== ""
      ? { search_run_id: params.search_run_id }
      : {}),
    order_by: params.order_by ?? "created_at"
  });

  const res = await fetch(`/api/businesses${search}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init
  });

  const body = await readJsonBody(res);

  if (!res.ok) {
    const error = toApiClientError(
      res,
      body,
      `Request failed with status ${res.status}`
    );
    throw new BusinessesApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return body as PaginatedResponse<BusinessRead>;
}

/** Query for `GET /api/opportunities` (server forces lead status to opportunities). */
export type ListOpportunitiesQuery = Omit<ListBusinessesQuery, "status">;

/**
 * GET /api/opportunities — same shape as businesses list; status filter is fixed server-side.
 */
export async function fetchOpportunitiesPage(
  params: ListOpportunitiesQuery,
  init?: RequestInit
): Promise<PaginatedResponse<BusinessRead>> {
  const search = buildQueryString({
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    ...(params.query !== undefined && params.query !== ""
      ? { query: params.query }
      : {}),
    ...(params.has_website !== undefined ? { has_website: params.has_website } : {}),
    order_by: params.order_by ?? "created_at"
  });

  const res = await fetch(`/api/opportunities${search}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init
  });

  const body = await readJsonBody(res);

  if (!res.ok) {
    const error = toApiClientError(
      res,
      body,
      `Request failed with status ${res.status}`
    );
    throw new BusinessesApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return body as PaginatedResponse<BusinessRead>;
}

/**
 * GET /api/businesses/{id} — detail for modal/sheet.
 */
export async function fetchBusinessById(
  id: string,
  init?: RequestInit
): Promise<BusinessDetailRead> {
  const res = await fetch(`/api/businesses/${id}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init
  });

  const body = await readJsonBody(res);

  if (!res.ok) {
    const error = toApiClientError(
      res,
      body,
      `Request failed with status ${res.status}`
    );
    throw new BusinessesApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return body as BusinessDetailRead;
}

/**
 * PATCH /api/businesses/{id} — update lead status/notes.
 */
export async function patchBusinessById(
  id: string,
  payload: BusinessStatusUpdate,
  init?: RequestInit
): Promise<BusinessDetailRead> {
  const res = await fetch(`/api/businesses/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    ...init
  });

  const body = await readJsonBody(res);

  if (!res.ok) {
    const error = toApiClientError(
      res,
      body,
      `Request failed with status ${res.status}`
    );
    throw new BusinessesApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return body as BusinessDetailRead;
}

export async function patchBusinessOpportunitySelection(
  id: string,
  isSelected: boolean,
  init?: RequestInit
): Promise<{ is_selected: boolean }> {
  const response = await fetch(`/api/opportunities/businesses/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ is_selected: isSelected }),
    ...init
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    const error = toApiClientError(
      response,
      body,
      "Could not update opportunities selection."
    );
    throw new OpportunitiesSelectionApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return body as { is_selected: boolean };
}

export async function fetchLatestCompletedSearchRunWithNextPage(
  init?: RequestInit,
): Promise<SearchRead | null> {
  const search = buildQueryString({
    page: 1,
    page_size: 100,
    status: "completed",
    source: "google_places"
  });

  const response = await fetch(`/api/searches${search}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    const error = toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
    throw new SearchRunsApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  const parsed = body as PaginatedResponse<SearchRead>;
  return parsed.items.find((item) => item.provider_next_page_available) ?? null;
}

export async function triggerNextSearchRunPage(
  parentSearchRunId: string,
  init?: RequestInit,
): Promise<{ searchRun: SearchRead; created: boolean }> {
  const response = await fetch(`/api/search/${parentSearchRunId}/next`, {
    method: "POST",
    headers: { Accept: "application/json" },
    ...init
  });

  const body = await readJsonBody(response);
  if (!response.ok) {
    const error = toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
    throw new SearchRunsApiError(error.message, error.status, {
      code: error.code,
      correlationId: error.correlationId
    });
  }

  return {
    searchRun: body as SearchRead,
    created: response.status === 201
  };
}
