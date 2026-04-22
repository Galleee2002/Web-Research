import type { BusinessSource, LeadStatus } from "../constants/domain";

export interface BusinessRead {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  has_website: boolean;
  status: LeadStatus;
  maps_url: string | null;
}

export interface BusinessDetailRead extends BusinessRead {
  search_run_id: string | null;
  external_id: string | null;
  source: BusinessSource;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessStatusUpdate {
  status: LeadStatus;
  notes?: string | null;
}

export interface BusinessFilters {
  page: number;
  page_size: number;
  has_website?: boolean;
  status?: LeadStatus;
  city?: string;
  category?: string;
  query?: string;
  order_by?: "created_at" | "name" | "city";
}

export interface NormalizedBusiness {
  external_id: string | null;
  source: BusinessSource;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  has_website: boolean;
  maps_url: string | null;
}
