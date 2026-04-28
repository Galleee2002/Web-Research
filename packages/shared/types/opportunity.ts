import type { LeadStatus, OpportunityRating } from "../constants/domain";

export interface OpportunityRead {
  id: string;
  business_id: string;
  is_selected: boolean;
  rating: OpportunityRating | null;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  has_website: boolean;
  status: LeadStatus;
  maps_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityDetailRead extends OpportunityRead {}

export interface OpportunityRatingUpdate {
  rating: OpportunityRating | null;
}

export interface OpportunityUpdate {
  rating?: OpportunityRating | null;
  status?: LeadStatus;
  notes?: string | null;
}

export interface OpportunitySelectionUpdate {
  is_selected: boolean;
}

export interface OpportunitySelectionResult {
  opportunity_id: string;
  business_id: string;
  is_selected: boolean;
  updated_at: string;
}

export interface OpportunityFilters {
  page: number;
  page_size: number;
  status?: LeadStatus;
  city?: string;
  category?: string;
  query?: string;
  order_by?: "rating" | "created_at" | "name" | "city";
}
