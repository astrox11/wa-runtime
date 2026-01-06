import { log } from "../core";
import {
  getSessions,
  getSession,
  createSession,
  deleteSession,
  pauseSession,
  resumeSession,
  getAuthStatus,
  getOverallStats,
  getFullStats,
  getSessionStats,
  getMessages,
  getConfig,
} from "./middleware";
import type { ApiResponse, SessionCreateRequest } from "./types";
import { ApiResponseErrors } from "./errors";
import { validatePhoneNumber, validatePagination } from "./predicates";
import { parseBody, matchRoute, createApiError } from "./handler";

export { handleWsAction } from "./handler";

const routes: Record<
  string,
  (req: Request, params?: Record<string, string>) => Promise<ApiResponse>
> = {
  "GET /api/sessions": async () => getSessions(),

  "POST /api/sessions": async (req) => {
    const body = await parseBody<SessionCreateRequest>(req);
    if (!body) return createApiError(ApiResponseErrors.INVALID_PARAMETERS);
    const validationError = validatePhoneNumber(body.phoneNumber);
    if (validationError) return validationError;
    return createSession(body.phoneNumber);
  },

  "GET /api/sessions/:id": async (_req, params) => getSession(params?.id),

  "DELETE /api/sessions/:id": async (_req, params) =>
    deleteSession(params?.id as string),

  "POST /api/sessions/:id/pause": async (_req, params) =>
    pauseSession(params?.id as string),

  "POST /api/sessions/:id/resume": async (_req, params) =>
    resumeSession(params?.id as string),

  "GET /api/auth/status/:sessionId": async (_req, params) =>
    getAuthStatus(params?.sessionId),

  "GET /api/messages/:sessionId": async (_req, params) => {
    const url = new URL(_req.url);
    const { limit, offset } = validatePagination(
      url.searchParams.get("limit"),
      url.searchParams.get("offset"),
    );
    return getMessages(params?.sessionId as string, limit, offset);
  },

  "GET /api/stats": async () => getOverallStats(),

  "GET /api/stats/full": async () => getFullStats(),

  "GET /api/stats/:sessionId": async (_req, params) =>
    getSessionStats(params?.sessionId as string),

  "GET /api/config": async () => getConfig(),
};

export async function handleApiRequest(req: Request): Promise<ApiResponse> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  const route = matchRoute(method, path, routes);
  if (!route) {
    return createApiError(
      `${ApiResponseErrors.ROUTE_NOT_FOUND}: ${method} ${path}`,
    );
  }

  try {
    return await route.handler(req, route.params);
  } catch (error) {
    log.error(`API error on ${method} ${path}:`, error);
    return createApiError(
      error instanceof Error ? error.message : ApiResponseErrors.INTERNAL_ERROR,
    );
  }
}
