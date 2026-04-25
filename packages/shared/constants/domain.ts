export const LEAD_STATUSES = [
  "new",
  "reviewed",
  "contacted",
  "discarded",
  "opportunities",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SEARCH_RUN_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type SearchRunStatus = (typeof SEARCH_RUN_STATUSES)[number];

export const BUSINESS_SOURCES = ["google_places"] as const;

export type BusinessSource = (typeof BUSINESS_SOURCES)[number];

export const OPPORTUNITY_RATINGS = [1, 2, 3, 4, 5] as const;

export type OpportunityRating = (typeof OPPORTUNITY_RATINGS)[number];

export const DEFAULT_BUSINESS_SOURCE: BusinessSource = "google_places";

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus);
}

export function isSearchRunStatus(value: unknown): value is SearchRunStatus {
  return (
    typeof value === "string" &&
    SEARCH_RUN_STATUSES.includes(value as SearchRunStatus)
  );
}

export function isBusinessSource(value: unknown): value is BusinessSource {
  return (
    typeof value === "string" &&
    BUSINESS_SOURCES.includes(value as BusinessSource)
  );
}

export function isOpportunityRating(value: unknown): value is OpportunityRating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    OPPORTUNITY_RATINGS.includes(value as OpportunityRating)
  );
}
