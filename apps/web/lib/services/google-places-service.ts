import type { GooglePlacesSearchRequest } from "@shared/index";

import { ApiError, type OperationContext } from "@/lib/api/http";

interface GooglePlacesApiResponse {
  status?: string;
  error_message?: string;
  results?: Array<Record<string, unknown>>;
  next_page_token?: string;
}

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESULTS_PER_REQUEST = 20;

function getGooglePlacesApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new ApiError(
      "provider_error",
      "Google Places API key is not configured",
      500,
    );
  }

  return key;
}

function getTimeoutMs(): number {
  const configuredSeconds = Number(process.env.GOOGLE_REQUEST_TIMEOUT_SECONDS);
  if (
    Number.isFinite(configuredSeconds) &&
    configuredSeconds > 0 &&
    configuredSeconds <= 120
  ) {
    return Math.round(configuredSeconds * 1000);
  }

  return DEFAULT_TIMEOUT_MS;
}

function toProviderError(
  message: string,
  statusCode: number,
  details?: string[],
): ApiError {
  return new ApiError("provider_error", message, statusCode, details);
}

function mapProviderStatusError(status: string, errorMessage?: string): ApiError {
  const details = errorMessage ? [errorMessage] : [status];
  return toProviderError("Google Places request failed", 502, details);
}

interface GooglePlacesSearchResponse {
  results: Array<Record<string, unknown>>;
  next_page_token?: string;
}

export async function searchGooglePlaces(
  payload: GooglePlacesSearchRequest,
  _context: OperationContext,
): Promise<GooglePlacesSearchResponse> {
  const apiKey = getGooglePlacesApiKey();
  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const query = `${payload.query} in ${payload.location}`;
    const url = new URL(GOOGLE_PLACES_TEXT_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw toProviderError("Google Places request failed", 502, [
        `provider_status_code=${response.status}`,
      ]);
    }

    const body = (await response.json()) as GooglePlacesApiResponse;
    const providerStatus = body.status ?? "UNKNOWN_ERROR";

    if (providerStatus !== "OK" && providerStatus !== "ZERO_RESULTS") {
      throw mapProviderStatusError(providerStatus, body.error_message);
    }

    return {
      results: (body.results ?? []).slice(0, MAX_RESULTS_PER_REQUEST),
      ...(body.next_page_token
        ? { next_page_token: body.next_page_token }
        : {}),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "timeout_error",
        "Google Places request timed out",
        504,
      );
    }

    throw toProviderError("Google Places request failed", 502);
  } finally {
    clearTimeout(timer);
  }
}
