import { NextResponse } from "next/server";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

export function validationError(errors: string[]): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: errors
      }
    },
    { status: 400 }
  );
}

export function notFound(message = "Resource not found"): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "not_found",
        message
      }
    },
    { status: 404 }
  );
}

export function internalError(): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Internal server error"
      }
    },
    { status: 500 }
  );
}

export function logApiError(error: unknown): void {
  console.error(error);
}

export function searchParamsToObject(
  searchParams: URLSearchParams
): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
