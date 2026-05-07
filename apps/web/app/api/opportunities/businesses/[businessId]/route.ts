import { NextResponse } from "next/server";
import { parseOpportunitySelectionUpdate } from "@shared/index";

import {
  isUuid,
  notFound,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import { setOpportunitySelectionByBusinessId } from "@/lib/services/opportunity-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    businessId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiRoute(
    request,
    { route: "/api/opportunities/businesses/[businessId]" },
    async (requestContext) => {
      const { businessId } = await context.params;

      if (!isUuid(businessId)) {
        return validationError(requestContext.correlationId, ["businessId must be a valid UUID"]);
      }

      const payload = await request.json();
      const parsed = parseOpportunitySelectionUpdate(payload);

      if (!parsed.ok) {
        return validationError(requestContext.correlationId, parsed.errors);
      }

      const selection = await setOpportunitySelectionByBusinessId(
        businessId,
        parsed.value,
        requestContext.operationContext,
      );

      if (!selection) {
        return notFound(requestContext.correlationId, "Business not found");
      }

      return NextResponse.json(selection);
    },
  );
}
