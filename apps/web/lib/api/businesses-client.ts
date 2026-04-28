import type {
  BusinessDetailRead,
  BusinessRead,
  BusinessStatusUpdate,
  LeadStatus,
  PaginatedResponse
} from "@shared/index";

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

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      q.set(key, String(value));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

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

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = body as {
      error?: { message?: string; code?: string; correlation_id?: string };
    };
    throw new BusinessesApiError(
      err?.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      {
        code: err?.error?.code,
        correlationId: err?.error?.correlation_id
      }
    );
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

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = body as {
      error?: { message?: string; code?: string; correlation_id?: string };
    };
    throw new BusinessesApiError(
      err?.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      {
        code: err?.error?.code,
        correlationId: err?.error?.correlation_id
      }
    );
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

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = body as {
      error?: { message?: string; code?: string; correlation_id?: string };
    };
    throw new BusinessesApiError(
      err?.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      {
        code: err?.error?.code,
        correlationId: err?.error?.correlation_id
      }
    );
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

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = body as {
      error?: { message?: string; code?: string; correlation_id?: string };
    };
    throw new BusinessesApiError(
      err?.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      {
        code: err?.error?.code,
        correlationId: err?.error?.correlation_id
      }
    );
  }

  return body as BusinessDetailRead;
}
