export interface ApiErrorBody {
  code: string;
  message: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

/** Browser-side fetch wrapper for the app's JSON API ({ data } / { error } envelopes). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiClientError(0, { code: "NETWORK_ERROR", message: "Network error. Check your connection." });
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      json?.error ?? { code: "HTTP_ERROR", message: `Request failed (${res.status})` },
    );
  }
  return json.data as T;
}
