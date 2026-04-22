import { NextResponse } from "next/server";
import { parseSearchFilters } from "@shared/index";

import {
  internalError,
  logApiError,
  searchParamsToObject,
  validationError
} from "@/lib/api/http";
import { listSearchRuns } from "@/lib/services/search-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseSearchFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(parsed.errors);
    }

    return NextResponse.json(await listSearchRuns(parsed.value));
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}
