type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    correlation_id?: string;
  };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly correlationId?: string;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; correlationId?: string }
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = options?.code;
    this.correlationId = options?.correlationId;
  }
}

export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function toApiClientError(
  response: Response,
  body: unknown,
  fallbackMessage: string
): ApiClientError {
  const errorBody = body as ApiErrorBody & {
    error?: { details?: string[] };
  };
  const baseMessage = errorBody?.error?.message ?? fallbackMessage;
  const details = errorBody?.error?.details?.filter(
    (detail) => typeof detail === "string" && detail.trim().length > 0
  );
  const message =
    details && details.length > 0
      ? `${baseMessage}: ${details.join("; ")}`
      : baseMessage;

  return new ApiClientError(message, response.status, {
    code: errorBody?.error?.code,
    correlationId: errorBody?.error?.correlation_id,
  });
}
