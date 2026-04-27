import { NextResponse } from "next/server";
import { parseGooglePlacesSearchRequest } from "@shared/index";

import {
  logApiEvent,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import { searchGooglePlaces } from "@/lib/services/google-places-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiRoute(
    request,
    { route: "/api/google/places/search" },
    async (context) => {
      const payload = await request.json();
      const parsed = parseGooglePlacesSearchRequest(payload);

      if (!parsed.ok) {
        return validationError(context.correlationId, parsed.errors);
      }

      const response = await searchGooglePlaces(
        parsed.value,
        context.operationContext,
      );

      logApiEvent("google_places_search_completed", context.operationContext, {
        provider: "google_places",
        result_count: response.results.length,
      });

      return NextResponse.json(response, { status: 200 });
    },
  );
}

