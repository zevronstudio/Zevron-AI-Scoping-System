import { z } from "zod";
import { projectSchema, summarySchema, type Turn } from "@/types/project";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const signal = AbortSignal.timeout(180_000);
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(
      "Could not reach the studio. Check your connection and retry; your saved project is safe.",
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ||
        "The studio is temporarily unavailable. Please retry.",
      response.status,
    );
  }
  const payload =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);
  const result = schema.safeParse(payload);
  if (!result.success)
    throw new ApiError(
      "The studio returned an unexpected response. Please reload and try again.",
    );
  return result.data;
}

export const api = {
  session: () => request("/session", z.undefined(), { method: "POST" }),
  health: () =>
    request(
      "/health",
      z.object({ status: z.string(), discovery_available: z.boolean() }),
    ),
  list: () => request("/projects", z.array(summarySchema)),
  get: (id: string) => request(`/projects/${id}`, projectSchema),
  create: (id: string) =>
    request("/projects", projectSchema, {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  rename: (id: string, title: string) =>
    request(`/projects/${id}`, projectSchema, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  remove: (id: string) =>
    request(`/projects/${id}`, z.undefined(), { method: "DELETE" }),
  turn: (id: string, body: Turn, scope = false) =>
    request(
      `/projects/${id}/${scope ? "generate-scope" : "messages"}`,
      projectSchema,
      { method: "POST", body: JSON.stringify(body) },
    ),
};
