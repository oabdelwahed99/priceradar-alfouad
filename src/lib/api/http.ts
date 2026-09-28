import { NextResponse } from "next/server";
import { ZodError, type ZodType, z } from "zod";
import { isDatabaseUnavailableError } from "@/lib/db/mongoose";
import { AppError, ValidationError } from "@/lib/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid request", z.flattenError(error));
  }
  if (error instanceof AppError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }
  if (isDatabaseUnavailableError(error)) {
    console.error("[api] database error:", (error as Error).message);
    return errorResponse(503, "DATABASE_UNAVAILABLE", "Database is unavailable. Check MONGODB_URI.");
  }
  console.error("[api] unexpected error:", error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

/** Like parseJsonBody, but an empty body is treated as `{}`. */
export async function parseOptionalJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return schema.parse({});
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function parseSearchParams<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return schema.parse(params);
}
