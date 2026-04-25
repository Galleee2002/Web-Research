import type {
  OpportunityDetailRead,
  OpportunityFilters,
  OpportunityRatingUpdate,
  OpportunityRead,
  PaginatedResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import {
  findOpportunityById as defaultFindOpportunityById,
  findOpportunities as defaultFindOpportunities,
  updateOpportunityRating as defaultUpdateOpportunityRating,
} from "@/lib/db/opportunities";

interface OpportunityServiceDependencies {
  findOpportunities: typeof defaultFindOpportunities;
  findOpportunityById: typeof defaultFindOpportunityById;
  updateOpportunityRating: typeof defaultUpdateOpportunityRating;
}

const defaultOpportunityServiceDependencies = {
  findOpportunities: defaultFindOpportunities,
  findOpportunityById: defaultFindOpportunityById,
  updateOpportunityRating: defaultUpdateOpportunityRating,
} satisfies OpportunityServiceDependencies;

export async function listOpportunities(
  filters: OpportunityFilters,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<PaginatedResponse<OpportunityRead>> {
  return deps.findOpportunities(filters, context);
}

export async function getOpportunityById(
  id: string,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.findOpportunityById(id, context);
}

export async function setOpportunityRating(
  id: string,
  payload: OpportunityRatingUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.updateOpportunityRating(id, payload, context);
}
