import { NextResponse } from "next/server";
import { parseBusinessStatusUpdate } from "@shared/index";

import {
  internalError,
  isUuid,
  logApiError,
  notFound,
  validationError
} from "@/lib/api/http";
import { getBusinessById, updateBusinessStatus } from "@/lib/db/businesses";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(["id must be a valid UUID"]);
    }

    const business = await getBusinessById(id);

    if (!business) {
      return notFound("Business not found");
    }

    return NextResponse.json(business);
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(["id must be a valid UUID"]);
    }

    const payload = await request.json();
    const parsed = parseBusinessStatusUpdate(payload);

    if (!parsed.ok) {
      return validationError(parsed.errors);
    }

    const business = await updateBusinessStatus(id, parsed.value);

    if (!business) {
      return notFound("Business not found");
    }

    return NextResponse.json(business);
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}
