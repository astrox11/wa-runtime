import { log } from "../core";
import type {
  ApiResponse,
  WsRequest,
  WsResponse,
  WsAction,
  ActivitySettingsData,
  GroupActionType,
} from "./types";
import { WsResponseErrors } from "./errors";
import { validateActionParams, parseWsRequest } from "./predicates";
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
  getGroups,
  getActivitySettings,
  updateActivitySettings,
  getGroupMetadata,
  executeGroupAction,
} from "./middleware";

export async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function createWsResponse(
  action: WsAction,
  requestId: string | undefined,
  data: unknown,
): WsResponse {
  return {
    action,
    requestId,
    success: true,
    data,
  };
}

export function createWsErrorResponse(
  action: WsAction,
  requestId: string | undefined,
  error: string,
): WsResponse {
  return {
    action,
    requestId,
    success: false,
    error,
  };
}

type ActionHandler = (
  params: Record<string, unknown>,
) => ApiResponse | Promise<ApiResponse>;

const actionHandlers: Record<WsAction, ActionHandler> = {
  getSessions: () => getSessions(),
  getSession: (params) => getSession(params.id as string),
  createSession: (params) => createSession(params.phoneNumber as string),
  deleteSession: (params) => deleteSession(params.id as string),
  getAuthStatus: (params) => getAuthStatus(params.sessionId as string),
  getStats: () => getOverallStats(),
  getSessionStats: (params) => getSessionStats(params.sessionId as string),
  getMessages: (params) =>
    getMessages(
      params.sessionId as string,
      (params.limit as number) || 100,
      (params.offset as number) || 0,
    ),
  getConfig: () => getConfig(),
  getGroups: (params) => getGroups(params.sessionId as string),
  pauseSession: (params) => pauseSession(params.id as string),
  resumeSession: (params) => resumeSession(params.id as string),
  getActivitySettings: (params) =>
    getActivitySettings(params.sessionId as string),
  updateActivitySettings: (params) =>
    updateActivitySettings(
      params.sessionId as string,
      params.settings as Partial<ActivitySettingsData>,
    ),
  getGroupMetadata: (params) =>
    getGroupMetadata(params.sessionId as string, params.groupId as string),
  executeGroupAction: (params) =>
    executeGroupAction(
      params.sessionId as string,
      params.groupId as string,
      params.action as GroupActionType,
      params.params as Record<string, string | number | boolean> | undefined,
    ),
};

export async function handleWsAction(request: WsRequest): Promise<WsResponse> {
  const { action, requestId, params = {} } = request;

  log.debug("WebSocket action received:", action, params);

  const paramsError = validateActionParams(action, params);
  if (paramsError) {
    return createWsErrorResponse(action, requestId, paramsError);
  }

  try {
    const handler = actionHandlers[action];
    if (!handler) {
      return createWsErrorResponse(
        action,
        requestId,
        WsResponseErrors.UNKNOWN_ACTION,
      );
    }

    const result = await handler(params);
    return {
      action,
      requestId,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error) {
    log.error(`WebSocket action error on ${action}:`, error);
    return createWsErrorResponse(
      action,
      requestId,
      error instanceof Error ? error.message : WsResponseErrors.ACTION_FAILED,
    );
  }
}

export async function handleRawWsMessage(
  data: unknown,
): Promise<WsResponse | { success: false; error: string }> {
  const request = parseWsRequest(data);

  if (!request) {
    return {
      success: false,
      error: WsResponseErrors.INVALID_REQUEST,
    };
  }

  return handleWsAction(request);
}

interface RouteMatch {
  handler: (
    req: Request,
    params?: Record<string, string>,
  ) => Promise<ApiResponse>;
  params: Record<string, string>;
}

export function matchRoute(
  method: string,
  path: string,
  routes: Record<
    string,
    (req: Request, params?: Record<string, string>) => Promise<ApiResponse>
  >,
): RouteMatch | null {
  const routeKey = `${method} ${path}`;

  if (routes[routeKey]) {
    return { handler: routes[routeKey], params: {} };
  }

  for (const [pattern, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = pattern.split(" ");
    if (routeMethod !== method || !routePath) continue;

    const routeParts = routePath.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];
      if (!routePart || !pathPart) {
        match = false;
        break;
      }
      if (routePart.startsWith(":")) {
        params[routePart.slice(1)] = pathPart;
      } else if (routePart !== pathPart) {
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

export function createApiError(error: string): ApiResponse {
  return { success: false, error };
}

export function createApiSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}
