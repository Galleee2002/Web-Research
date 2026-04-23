import { parseBusinessFilters } from "@shared/index";

import {
  internalError,
  logApiError,
  searchParamsToObject,
  validationError
} from "@/lib/api/http";
import { listBusinessesForExport } from "@/lib/services/business-service";
import { toCsv } from "@/lib/utils/csv";

export const runtime = "nodejs";

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
  try {
    const url = new URL(request.url);
    const parsed = parseBusinessFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(parsed.errors);
    }

    const businesses = await listBusinessesForExport(parsed.value);
    const csv = toCsv(EXPORT_COLUMNS, businesses);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="business-leads.csv"'
      }
    });
  } catch (error) {
    logApiError(error);
    return internalError();
  }
}
