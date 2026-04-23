import type { PaginatedResponse, SearchCreate, SearchFilters, SearchRead } from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

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
  context: OperationContext,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<SearchRead> {
  return deps.insertSearchRun(payload, context);
}

export async function listSearchRuns(
  filters: SearchFilters,
  context: OperationContext,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<PaginatedResponse<SearchRead>> {
  return deps.findSearchRuns(filters, context);
}
