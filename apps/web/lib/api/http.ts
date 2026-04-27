import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getRuntimeConfig } from "@/lib/config/runtime";

import { logError, logInfo, type LogFields } from "./logger";

export type ApiErrorCode =
  | "conflict_error"
  | "database_error"
  | "internal_error"
  | "invalid_json"
  | "not_found"
  | "provider_error"
  | "timeout_error"
  | "validation_error";

export interface ErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    correlation_id: string;
    details?: string[];
  };
}

export interface OperationContext {
  correlationId: string;
  method: string;
  route: string;
}

export interface ApiRequestContext extends OperationContext {
  request: Request;
  startedAt: number;
  operationContext: OperationContext;
  validationErrors: string[];
}

interface ApiRouteOptions {
  route: string;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: string[];

  constructor(code: ApiErrorCode, message: string, status: number, details?: string[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class DatabaseOperationError extends Error {
  readonly operationName: string;

  constructor(operationName: string, cause: unknown) {
    super(`Database operation failed: ${operationName}`, { cause });
    this.name = "DatabaseOperationError";
    this.operationName = operationName;
  }
}

export function validationError(correlationId: string, errors: string[]): NextResponse<ErrorBody> {
  return errorResponse(
    correlationId,
    new ApiError("validation_error", "Invalid request", 400, errors)
  );
}

export function notFound(
  correlationId: string,
  message = "Resource not found"
): NextResponse<ErrorBody> {
  return errorResponse(correlationId, new ApiError("not_found", message, 404));
}

export function internalError(correlationId: string): NextResponse<ErrorBody> {
  return errorResponse(
    correlationId,
    new ApiError("internal_error", "Internal server error", 500)
  );
}

export function invalidJsonError(correlationId: string): NextResponse<ErrorBody> {
  return errorResponse(
    correlationId,
    new ApiError("invalid_json", "Request body must be valid JSON", 400)
  );
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

export async function withApiRoute(
  request: Request,
  options: ApiRouteOptions,
  handler: (context: ApiRequestContext) => Promise<Response>
): Promise<Response> {
  const context = createApiRequestContext(request, options.route);

  logInfo("api_request_started", {
    correlation_id: context.correlationId,
    route: context.route,
    method: context.method,
    search_run_id: null,
    status_code: null,
    provider: null,
    error_code: null,
    error_stage: "api",
    duration_ms: null,
    result_count: null
  });

  try {
    const requestValidationErrors = [
      ...context.validationErrors,
      ...validateRequestSize(request)
    ];
    if (requestValidationErrors.length > 0) {
      const response = validationError(context.correlationId, requestValidationErrors);
      applyCorsHeaders(response, request);
      return response;
    }

    const response = await handler(context);
    applyCorsHeaders(response, request);

    logInfo("api_request_succeeded", {
      correlation_id: context.correlationId,
      route: context.route,
      method: context.method,
      search_run_id: null,
      status_code: response.status,
      provider: null,
      error_code: null,
      error_stage: "api",
      duration_ms: Date.now() - context.startedAt,
      result_count: null
    });

    return response;
  } catch (error) {
    const response = errorToResponse(context, error);
    applyCorsHeaders(response, request);

    logError("api_request_failed", {
      correlation_id: context.correlationId,
      route: context.route,
      method: context.method,
      search_run_id: null,
      status_code: response.status,
      provider: null,
      error_code: getErrorCode(error),
      error_stage: "api",
      duration_ms: Date.now() - context.startedAt,
      result_count: null,
      error_message: getErrorMessage(error)
    });

    return response;
  }
}

export function logApiEvent(event: string, context: OperationContext, fields: LogFields = {}): void {
  logInfo(event, {
    correlation_id: context.correlationId,
    route: context.route,
    method: context.method,
    search_run_id: null,
    status_code: null,
    provider: null,
    error_code: null,
    error_stage: "api",
    duration_ms: null,
    result_count: null,
    ...fields
  });
}

function createApiRequestContext(request: Request, route: string): ApiRequestContext {
  const inboundCorrelationId = request.headers.get("x-correlation-id")?.trim();
  const validationErrors: string[] = [];
  let correlationId = inboundCorrelationId || randomUUID();

  if (inboundCorrelationId && !isValidCorrelationId(inboundCorrelationId)) {
    validationErrors.push("X-Correlation-Id is invalid");
    correlationId = randomUUID();
  }

  return {
    request,
    route,
    method: request.method,
    correlationId,
    startedAt: Date.now(),
    validationErrors,
    operationContext: {
      correlationId,
      method: request.method,
      route
    }
  };
}

function isValidCorrelationId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function validateRequestSize(request: Request): string[] {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) {
    return [];
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return [];
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength === null) {
    return [];
  }

  const parsed = Number(contentLength);
  if (!Number.isFinite(parsed)) {
    return ["Content-Length must be a number"];
  }

  return parsed > getRuntimeConfig().apiJsonBodyLimitBytes
    ? ["request body is too large"]
    : [];
}

function applyCorsHeaders(response: Response, request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const { allowedOrigins } = getRuntimeConfig();
  if (!allowedOrigins.includes(origin)) {
    return;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Accept,X-Correlation-Id"
  );
}

export function corsPreflight(request: Request): Response {
  const response = new Response(null, { status: 204 });
  applyCorsHeaders(response, request);
  return response;
}

function errorToResponse(
  context: ApiRequestContext,
  error: unknown
): NextResponse<ErrorBody> {
  if (error instanceof ApiError) {
    return errorResponse(context.correlationId, error);
  }

  if (error instanceof DatabaseOperationError) {
    return errorResponse(
      context.correlationId,
      new ApiError("database_error", "Database operation failed", 500)
    );
  }

  if (error instanceof SyntaxError) {
    return invalidJsonError(context.correlationId);
  }

  return internalError(context.correlationId);
}

function errorResponse(
  correlationId: string,
  error: ApiError
): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        correlation_id: correlationId,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    },
    { status: error.status }
  );
}

function getErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof ApiError) {
    return error.code;
  }

  if (error instanceof DatabaseOperationError) {
    return "database_error";
  }

  if (error instanceof SyntaxError) {
    return "invalid_json";
  }

  return "internal_error";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
