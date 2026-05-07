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
  ownerUserId: string,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<PaginatedResponse<OpportunityRead>> {
  return deps.findOpportunities(filters, ownerUserId, context);
}

export async function listOpportunityCategories(
  ownerUserId: string,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityCategoriesResponse> {
  const categories = await deps.findOpportunityCategoryValues(ownerUserId, context);
  return { categories };
}

export async function getOpportunityById(
  id: string,
  ownerUserId: string,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.findOpportunityById(id, ownerUserId, context);
}

export async function setOpportunityRating(
  id: string,
  ownerUserId: string,
  payload: OpportunityRatingUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.updateOpportunityRating(id, ownerUserId, payload, context);
}

export async function setOpportunity(
  id: string,
  ownerUserId: string,
  payload: OpportunityUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunityDetailRead | null> {
  return deps.updateOpportunity(id, ownerUserId, payload, context);
}

export async function setOpportunitySelectionByBusinessId(
  businessId: string,
  ownerUserId: string,
  payload: OpportunitySelectionUpdate,
  context: OperationContext,
  deps: OpportunityServiceDependencies = defaultOpportunityServiceDependencies,
): Promise<OpportunitySelectionResult | null> {
  return deps.setOpportunitySelectionByBusinessId(businessId, ownerUserId, payload, context);
}
