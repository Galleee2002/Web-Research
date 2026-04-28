import type { BusinessSource, SearchRunStatus } from "../constants/domain";

export interface SearchCreate {
  query: string;
  location: string;
}

export interface SearchRead {
  id: string;
  query: string;
  location: string;
  source: BusinessSource;
  status: SearchRunStatus;
  total_found: number;
  parent_search_run_id: string | null;
  page_number: number;
  provider_next_page_available: boolean;
  created_at: string;
}

export interface SearchFilters {
  page: number;
  page_size: number;
  status?: SearchRunStatus;
  source?: BusinessSource;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
