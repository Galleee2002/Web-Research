import { NextResponse } from "next/server";
import { parseBusinessFilters } from "@shared/index";

import {
  internalError,
  logApiError,
  searchParamsToObject,
  validationError
} from "@/lib/api/http";
import { listBusinesses } from "@/lib/services/business-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseBusinessFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(parsed.errors);
    }

    return NextResponse.json(await listBusinesses(parsed.value));
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}
