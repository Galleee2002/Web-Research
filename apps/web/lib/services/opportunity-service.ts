import type {
  OpportunityCategoriesResponse,
  OpportunityDetailRead,
  OpportunityFilters,
  OpportunityRatingUpdate,
  OpportunitySelectionResult,
  OpportunitySelectionUpdate,
  OpportunityUpdate,
  OpportunityRead,
  PaginatedResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import {
  findOpportunityById as defaultFindOpportunityById,
  findOpportunityCategoryValues as defaultFindOpportunityCategoryValues,
  findOpportunities as defaultFindOpportunities,
  setOpportunitySelectionByBusinessId as defaultSetOpportunitySelectionByBusinessId,
  updateOpportunity as defaultUpdateOpportunity,
  updateOpportunityRating as defaultUpdateOpportunityRating,
} from "@/lib/db/opportunities";

interface OpportunityServiceDependencies {
  findOpportunities: typeof defaultFindOpportunities;
  findOpportunityCategoryValues: typeof defaultFindOpportunityCategoryValues;
  findOpportunityById: typeof defaultFindOpportunityById;
  updateOpportunityRating: typeof defaultUpdateOpportunityRating;
  updateOpportunity: typeof defaultUpdateOpportunity;
  setOpportunitySelectionByBusinessId: typeof defaultSetOpportunitySelectionByBusinessId;
}

const defaultOpportunityServiceDependencies = {
  findOpportunities: defaultFindOpportunities,
  findOpportunityCategoryValues: defaultFindOpportunityCategoryValues,
  findOpportunityById: defaultFindOpportunityById,
  updateOpportunityRating: defaultUpdateOpportunityRating,
  updateOpportunity: defaultUpdateOpportunity,
  setOpportunitySelectionByBusinessId: defaultSetOpportunitySelectionByBusinessId,
} satisfies OpportunityServiceDependencies;

export async function listOpportunities(
  filters: OpportunityFilters,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<PaginatedResponse<OpportunityRead>> {
  return deps.findOpportunities(filters, context);
}

export async function listOpportunityCategories(
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityCategoriesResponse> {
  const categories = await deps.findOpportunityCategoryValues(context);
  return { categories };
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

export async function setOpportunity(
  id: string,
  payload: OpportunityUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.updateOpportunity(id, payload, context);
}

export async function setOpportunitySelectionByBusinessId(
  businessId: string,
  payload: OpportunitySelectionUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunitySelectionResult | null> {
  return deps.setOpportunitySelectionByBusinessId(businessId, payload, context);
}
