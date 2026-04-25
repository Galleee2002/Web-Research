import { NextResponse } from "next/server";
import { parseOpportunityRatingUpdate } from "@shared/index";

import {
  isUuid,
  notFound,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import {
  getOpportunityById,
  setOpportunityRating,
} from "@/lib/services/opportunity-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return withApiRoute(_request, { route: "/api/opportunities/[id]" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const opportunity = await getOpportunityById(id, requestContext.operationContext);

    if (!opportunity) {
      return notFound(requestContext.correlationId, "Opportunity not found");
    }

    return NextResponse.json(opportunity);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "/api/opportunities/[id]" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const payload = await request.json();
    const parsed = parseOpportunityRatingUpdate(payload);

    if (!parsed.ok) {
      return validationError(requestContext.correlationId, parsed.errors);
    }

    const opportunity = await setOpportunityRating(
      id,
      parsed.value,
      requestContext.operationContext,
    );

    if (!opportunity) {
      return notFound(requestContext.correlationId, "Opportunity not found");
    }

    return NextResponse.json(opportunity);
  });
}
