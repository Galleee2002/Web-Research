import type { PaginatedResponse, SearchCreate, SearchFilters, SearchRead } from "@shared/index";

import {
  findSearchRuns as defaultFindSearchRuns,
  insertSearchRun as defaultInsertSearchRun
} from "@/lib/db/searches";

interface SearchServiceDependencies {
  insertSearchRun: typeof defaultInsertSearchRun;
  findSearchRuns: typeof defaultFindSearchRuns;
}

const defaultSearchServiceDependencies = {
  insertSearchRun: defaultInsertSearchRun,
  findSearchRuns: defaultFindSearchRuns
} satisfies SearchServiceDependencies;

export async function createSearchRun(
  payload: SearchCreate,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<SearchRead> {
  return deps.insertSearchRun(payload);
}

export async function listSearchRuns(
  filters: SearchFilters,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<PaginatedResponse<SearchRead>> {
  return deps.findSearchRuns(filters);
}
