import type {
  OpportunityCategoriesResponse,
  OpportunityRead,
  OpportunityUpdate,
  PaginatedResponse,
} from "@shared/index";

import {
  ApiClientError,
  buildQueryString,
  readJsonBody,
  toApiClientError,
} from "@/lib/api/request";

export { ApiClientError as OpportunitiesApiError };

export type OpportunitiesListQuery = {
  page?: number;
  page_size?: number;
  category?: string;
};

function getCsrfHeader(method: RequestInit["method"]): Record<string, string> {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return {};
  }
  if (typeof document === "undefined") {
    return {};
  }
  const token = readCookie("blf_csrf");
  return token ? { "X-CSRF-Token": token } : {};
}

function readCookie(name: string): string | null {
  const cookieString = typeof document === "undefined" ? "" : document.cookie;
  if (!cookieString) {
    return null;
  }
  for (const entry of cookieString.split(";")) {
    const [cookieName, ...valueParts] = entry.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

export async function fetchOpportunityCategories(
  init?: RequestInit
): Promise<OpportunityCategoriesResponse> {
  const response = await fetch("/api/opportunities/categories", {
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
  return body as OpportunityCategoriesResponse;
}

export async function fetchOpportunities(
  query?: OpportunitiesListQuery,
  init?: RequestInit
): Promise<PaginatedResponse<OpportunityRead>> {
  const page = query?.page ?? 1;
  const page_size = query?.page_size ?? 200;
  const response = await fetch(
    `/api/opportunities${buildQueryString({
      page,
      page_size,
      ...(query?.category !== undefined && query.category !== ""
        ? { category: query.category }
        : {}),
    })}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      ...init,
    }
  );
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  return body as PaginatedResponse<OpportunityRead>;
}

export async function patchOpportunityStatus(
  id: string,
  status: OpportunityRead["status"],
  init?: RequestInit
): Promise<OpportunityRead> {
  return patchOpportunity(id, { status }, init);
}

export async function patchOpportunity(
  id: string,
  payload: OpportunityUpdate,
  init?: RequestInit
): Promise<OpportunityRead> {
  const csrfHeader = getCsrfHeader("PATCH");
  const response = await fetch(`/api/opportunities/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeader,
    },
    body: JSON.stringify(payload),
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
  return body as OpportunityRead;
}
