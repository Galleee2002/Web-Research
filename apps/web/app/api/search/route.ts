import { NextResponse } from "next/server";
import { parseSearchCreate } from "@shared/index";

import { internalError, logApiError, validationError } from "@/lib/api/http";
import { createSearchRun } from "@/lib/services/search-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = parseSearchCreate(payload);

    if (!parsed.ok) {
      return validationError(parsed.errors);
    }

    const searchRun = await createSearchRun(parsed.value);
    return NextResponse.json(searchRun, { status: 201 });
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}
