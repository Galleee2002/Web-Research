import { INPUT_LIMITS } from "../constants/pagination";
import type { GooglePlacesSearchRequest } from "../types/google-places";
import { isRecord, parseRequiredString, type ValidationResult } from "./pagination";

export function parseGooglePlacesSearchRequest(
  input: unknown,
): ValidationResult<GooglePlacesSearchRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const query = parseRequiredString(input, "query", INPUT_LIMITS.query, errors);
  const location = parseRequiredString(
    input,
    "location",
    INPUT_LIMITS.location,
    errors,
  );

  if (errors.length > 0 || query === undefined || location === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { query, location },
  };
}

