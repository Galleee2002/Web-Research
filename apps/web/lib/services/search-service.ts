import type { PaginatedResponse, SearchCreate, SearchFilters, SearchRead } from "@shared/index";

import { ApiError, type OperationContext } from "@/lib/api/http";

import {
  findSearchRunByParentId as defaultFindSearchRunByParentId,
  findSearchRunRecordById as defaultFindSearchRunRecordById,
  findSearchRuns as defaultFindSearchRuns,
  insertNextSearchRunFromParent as defaultInsertNextSearchRunFromParent,
  insertSearchRun as defaultInsertSearchRun
} from "@/lib/db/searches";

interface SearchServiceDependencies {
  insertSearchRun: typeof defaultInsertSearchRun;
  findSearchRuns: typeof defaultFindSearchRuns;
  findSearchRunRecordById: typeof defaultFindSearchRunRecordById;
  findSearchRunByParentId: typeof defaultFindSearchRunByParentId;
  insertNextSearchRunFromParent: typeof defaultInsertNextSearchRunFromParent;
}

const defaultSearchServiceDependencies = {
  insertSearchRun: defaultInsertSearchRun,
  findSearchRuns: defaultFindSearchRuns,
  findSearchRunRecordById: defaultFindSearchRunRecordById,
  findSearchRunByParentId: defaultFindSearchRunByParentId,
  insertNextSearchRunFromParent: defaultInsertNextSearchRunFromParent
} satisfies SearchServiceDependencies;

export async function createSearchRun(
  payload: SearchCreate,
  context: OperationContext,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<SearchRead> {
  return deps.insertSearchRun(payload, context);
}

export async function createNextSearchRun(
  parentSearchRunId: string,
  context: OperationContext,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<{ searchRun: SearchRead; created: boolean }> {
  const parent = await deps.findSearchRunRecordById(parentSearchRunId, context);
  if (!parent) {
    throw new ApiError("not_found", "Search run not found", 404);
  }

  const existingChild = await deps.findSearchRunByParentId(parent.id, context);
  if (existingChild) {
    return { searchRun: existingChild, created: false };
  }

  if (parent.status !== "completed") {
    throw new ApiError(
      "conflict_error",
      "Search run must be completed before requesting next page",
      409,
    );
  }

  if (!parent.provider_next_page_available || !parent.provider_next_page_token) {
    throw new ApiError(
      "conflict_error",
      "Search run does not have a next page token",
      409,
    );
  }

  return deps.insertNextSearchRunFromParent(parent, context);
}

export async function listSearchRuns(
  filters: SearchFilters,
  context: OperationContext,
  deps: SearchServiceDependencies = defaultSearchServiceDependencies
): Promise<PaginatedResponse<SearchRead>> {
  return deps.findSearchRuns(filters, context);
}
