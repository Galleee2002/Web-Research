import type { ScanFilters, PaginatedScansResponse } from "@shared/index";
import type { OperationContext } from "@/lib/api/http";

import {
  getProviderCalls as defaultGetProviderCalls,
  countGlobalRequestsDaily as defaultCountGlobalRequestsDaily,
} from "@/lib/db/scans";

interface ScanServiceDependencies {
  getProviderCalls: typeof defaultGetProviderCalls;
  countGlobalRequestsDaily: typeof defaultCountGlobalRequestsDaily;
}

const defaultScanServiceDependencies = {
  getProviderCalls: defaultGetProviderCalls,
  countGlobalRequestsDaily: defaultCountGlobalRequestsDaily,
} satisfies ScanServiceDependencies;

export async function listProviderCalls(
  filters: ScanFilters,
  context: OperationContext,
  deps: ScanServiceDependencies = defaultScanServiceDependencies
): Promise<PaginatedScansResponse> {
  const { rows, total } = await deps.getProviderCalls(filters, context);
  const globalRequestCount = await deps.countGlobalRequestsDaily(undefined, context);

  return {
    items: rows,
    total,
    page: filters.page,
    page_size: filters.page_size,
    globalRequestCount,
  };
}
