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
  const response = await fetch(`/api/opportunities/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
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
