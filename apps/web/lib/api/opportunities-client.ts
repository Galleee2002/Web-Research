import type { OpportunityRead, PaginatedResponse } from "@shared/index";

import {
  ApiClientError,
  buildQueryString,
  readJsonBody,
  toApiClientError,
} from "@/lib/api/request";

export { ApiClientError as OpportunitiesApiError };

export async function fetchOpportunities(init?: RequestInit): Promise<
  PaginatedResponse<OpportunityRead>
> {
  const response = await fetch(
    `/api/opportunities${buildQueryString({ page: 1, page_size: 200 })}`,
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
  const response = await fetch(`/api/opportunities/${id}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
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
