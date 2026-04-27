import { parseBusinessFilters } from "@shared/index";

import {
  corsPreflight,
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { listBusinessesForExport } from "@/lib/services/business-service";
import { toCsv } from "@/lib/utils/csv";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const EXPORT_COLUMNS = [
  "name",
  "category",
  "address",
  "city",
  "phone",
  "website",
  "has_website",
  "status",
  "maps_url"
] as const;

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/export" }, async (context) => {
    const url = new URL(request.url);
    const parsed = parseBusinessFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    logApiEvent("business_export_requested", context.operationContext);
    const businesses = await listBusinessesForExport(parsed.value, context.operationContext);
    const csv = toCsv(EXPORT_COLUMNS, businesses);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="business-leads.csv"'
      }
    });
  });
}
