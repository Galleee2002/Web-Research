import { NextResponse } from "next/server";
import { parseBusinessStatusUpdate } from "@shared/index";

import {
  corsPreflight,
  isUuid,
  notFound,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { requireAuth } from "@/lib/auth/session";
import { getBusinessById, updateBusinessStatus } from "@/lib/services/business-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return withApiRoute(_request, { route: "/api/businesses/[id]" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const session = await requireAuth(_request, requestContext.operationContext);
    const business = await getBusinessById(id, session.sub, requestContext.operationContext);

    if (!business) {
      return notFound(requestContext.correlationId, "Business not found");
    }

    return NextResponse.json(business);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "/api/businesses/[id]" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const payload = await request.json();
    const parsed = parseBusinessStatusUpdate(payload);

    if (!parsed.ok) {
      return validationError(requestContext.correlationId, parsed.errors);
    }

    const session = await requireAuth(request, requestContext.operationContext);
    const business = await updateBusinessStatus(
      id,
      session.sub,
      parsed.value,
      requestContext.operationContext
    );

    if (!business) {
      return notFound(requestContext.correlationId, "Business not found");
    }

    return NextResponse.json(business);
  });
}
