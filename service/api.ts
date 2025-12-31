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
  getSessionStats,
  getMessages,
  getConfig,
  getNetworkState,
  getGroups,
} from "./middleware";
import type {
  ApiResponse,
  SessionCreateRequest,
  WsRequest,
  WsResponse,
} from "./types";

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function handleWsAction(request: WsRequest): Promise<WsResponse> {
  const { action, requestId, params = {} } = request;

  log.debug("WebSocket action received:", action, params);

  try {
    let result: ApiResponse;
    switch (action) {
      case "getSessions":
        result = getSessions();
        break;

      case "getSession":
        result = getSession(params.id as string);
        break;

      case "createSession":
        result = await createSession(params.phoneNumber as string);
        break;

      case "deleteSession":
        result = await deleteSession(params.id as string);
        break;

      case "getAuthStatus":
        result = getAuthStatus(params.sessionId as string);
        break;

      case "getStats":
        result = getOverallStats();
        break;

      case "getSessionStats":
        result = getSessionStats(params.sessionId as string);
        break;

      case "getMessages":
        result = getMessages(
          params.sessionId as string,
          (params.limit as number) || 100,
          (params.offset as number) || 0,
        );
        break;

      case "getConfig":
        result = getConfig();
        break;

      case "getNetworkState":
        result = getNetworkState();
        break;

      case "getGroups":
        result = getGroups(params.sessionId as string);
        break;

      case "pauseSession":
        result = await pauseSession(params.id as string);
        break;

      case "resumeSession":
        result = await resumeSession(params.id as string);
        break;

      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return {
      action,
      requestId,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error) {
    log.error(`WebSocket action error on ${action}:`, error);
    return {
      action,
      requestId,
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

const routes: Record<
  string,
  (req: Request, params?: Record<string, string>) => Promise<ApiResponse>
> = {
  "GET /api/sessions": async () => {
    return getSessions();
  },

  "POST /api/sessions": async (req) => {
    const body = await parseBody<SessionCreateRequest>(req);
    if (!body || !body?.phoneNumber) {
      return { success: false, error: "invaild_parameters" };
    }
    return createSession(body.phoneNumber);
  },

  "GET /api/sessions/:id": async (_req, params) => {
    return getSession(params?.id);
  },

  "DELETE /api/sessions/:id": async (_req, params) => {
    return deleteSession(params?.id as string);
  },

  "GET /api/auth/status/:sessionId": async (_req, params) => {
    return getAuthStatus(params?.sessionId);
  },

  "GET /api/messages/:sessionId": async (_req, params) => {
    const url = new URL(_req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    return getMessages(params?.sessionId as string, limit, offset);
  },

  "GET /api/stats": async () => {
    return getOverallStats();
  },

  "GET /api/stats/:sessionId": async (_req, params) => {
    return getSessionStats(params?.sessionId as string);
  },

  "GET /api/network": async () => {
    return getNetworkState();
  },

  "GET /api/config": async () => {
    return getConfig();
  },
};

function matchRoute(
  method: string,
  path: string,
): {
  handler: (
    req: Request,
    params?: Record<string, string>,
  ) => Promise<ApiResponse>;
  params: Record<string, string>;
} | null {
  const routeKey = `${method} ${path}`;

  if (routes[routeKey]) {
    return { handler: routes[routeKey], params: {} };
  }

  for (const [pattern, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = pattern.split(" ");
    if (routeMethod !== method) continue;

    const routeParts = routePath.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return { handler, params };
    }
  }

  return null;
}

export async function handleApiRequest(req: Request): Promise<ApiResponse> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  const route = matchRoute(method, path);
  if (!route) {
    return { success: false, error: `Route not found: ${method} ${path}` };
  }

  try {
    return await route.handler(req, route.params);
  } catch (error) {
    log.error(`API error on ${method} ${path}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}
