import { sessionManager, log, getAllMessages, getMessagesCount, getAllGroups } from "./lib";
import config from "./config";

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface SessionCreateRequest {
  phoneNumber: string;
  botName?: string;
}

export type WsAction =
  | "getSessions"
  | "getSession"
  | "createSession"
  | "deleteSession"
  | "getAuthStatus"
  | "getStats"
  | "getSessionStats"
  | "getMessages"
  | "getConfig"
  | "getNetworkState"
  | "getGroups"
  | "pauseSession"
  | "resumeSession";

export interface WsRequest {
  action: WsAction;
  requestId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface WsResponse {
  action: WsAction;
  requestId?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

class RuntimeStats {
  private messageCount: Map<string, number> = new Map();
  private sessionStartTimes: Map<string, number> = new Map();
  private hourlyActivity: Map<string, number[]> = new Map();

  recordMessage(sessionId: string) {
    const current = this.messageCount.get(sessionId) || 0;
    this.messageCount.set(sessionId, current + 1);

    const hour = new Date().getHours();
    const hourlyKey = `${sessionId}_${new Date().toDateString()}`;
    let hourly = this.hourlyActivity.get(hourlyKey);
    if (!hourly) {
      hourly = new Array(24).fill(0);
      this.hourlyActivity.set(hourlyKey, hourly);
    }
    hourly[hour]++;
  }

  recordSessionStart(sessionId: string) {
    this.sessionStartTimes.set(sessionId, Date.now());
  }

  getStats(sessionId: string) {
    const messages = getMessagesCount(sessionId);
    let startTime = this.sessionStartTimes.get(sessionId);
    
    if (!startTime) {
      const session = sessionManager.get(sessionId);
      startTime = session?.created_at || Date.now();
      this.sessionStartTimes.set(sessionId, startTime);
    }
    
    const uptime = Date.now() - startTime;

    const hourlyKey = `${sessionId}_${new Date().toDateString()}`;
    const hourlyData =
      this.hourlyActivity.get(hourlyKey) || new Array(24).fill(0);

    return {
      messages,
      uptime,
      uptimeFormatted: formatUptime(uptime),
      hourlyActivity: hourlyData,
      avgMessagesPerHour: messages / Math.max(1, Math.ceil(uptime / 3600000)),
    };
  }

  getOverallStats() {
    return {
      totalSessions: sessionManager.list().length,
      activeSessions: sessionManager.getActiveCount(),
      totalMessages: getMessagesCount(sessionManager.list()?.[0]?.id),
      version: config.VERSION,
      serverUptime: process.uptime(),
      serverUptimeFormatted: formatUptime(process.uptime() * 1000),
    };
  }
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const days = Math.floor(hours / HOURS_PER_DAY);

  if (days > 0) {
    return `${days}d ${hours % HOURS_PER_DAY}h ${minutes % MINUTES_PER_HOUR}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % MINUTES_PER_HOUR}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
  }
  return `${seconds}s`;
}

const runtimeStats = new RuntimeStats();

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * WebSocket Action Handlers
 */
export async function handleWsAction(request: WsRequest): Promise<WsResponse> {
  const { action, requestId, params = {} } = request;

  log.debug("WebSocket action received:", action, params);

  try {
    let result: ApiResponse;

    switch (action) {
      case "getSessions":
        log.debug("Getting all sessions");
        result = { success: true, data: sessionManager.listExtended() };
        break;

      case "getSession":
        if (!params.id) {
          result = { success: false, error: "Session ID is required" };
        } else {
          log.debug("Getting session:", params.id);
          const session = sessionManager.get(params?.id as string);
          if (!session) {
            result = { success: false, error: "Session not found" };
          } else {
            result = { success: true, data: session };
          }
        }
        break;

      case "createSession":
        if (!params.phoneNumber) {
          result = { success: false, error: "Phone number is required" };
        } else {
          log.debug("Creating session for:", params.phoneNumber);
          const createResult = await sessionManager.create(
            params.phoneNumber as string,
          );
          if (createResult.success) {
            runtimeStats.recordSessionStart(createResult.id!);
            log.info("Session created:", createResult.id);
            result = {
              success: true,
              data: {
                id: createResult.id,
                pairingCode: createResult.code,
                pairingCodeFormatted: createResult.code
                  ? `${createResult.code.slice(0, 4)}-${createResult.code.slice(4)}`
                  : null,
              },
            };
          } else {
            log.error("Failed to create session:", createResult.error);
            result = { success: false, error: createResult.error };
          }
        }
        break;

      case "deleteSession":
        if (!params.id) {
          result = { success: false, error: "Session ID is required" };
        } else {
          log.debug("Deleting session:", params.id);
          const deleteResult = await sessionManager.delete(params.id as string);
          if (deleteResult.success) {
            log.info("Session deleted:", params.id);
            result = { success: true, data: { message: "Session deleted" } };
          } else {
            log.error("Failed to delete session:", deleteResult.error);
            result = { success: false, error: deleteResult.error };
          }
        }
        break;

      case "getAuthStatus":
        if (!params.sessionId) {
          result = { success: false, error: "Session ID is required" };
        } else {
          log.debug("Getting auth status for:", params.sessionId);
          const session = sessionManager.get(params.sessionId as string);
          if (!session) {
            result = { success: false, error: "Session not found" };
          } else {
            result = {
              success: true,
              data: {
                sessionId: session.id,
                phoneNumber: session.phone_number,
                status: session.status,
                isAuthenticated: session.status === "active",
                isPairing: session.status === "pairing",
              },
            };
          }
        }
        break;

      case "getStats":
        result = { success: true, data: runtimeStats.getOverallStats() };
        break;

      case "getSessionStats":
        if (!params.sessionId) {
          result = { success: false, error: "Session ID is required" };
        } else {
          const session = sessionManager.get(params.sessionId as string);
          if (!session) {
            result = { success: false, error: "Session not found" };
          } else {
            const stats = runtimeStats.getStats(params.sessionId as string);
            result = {
              success: true,
              data: {
                session: {
                  id: session.id,
                  phoneNumber: session.phone_number,
                  status: session.status,
                  createdAt: session.created_at,
                  pushName: session.push_name,
                },
                ...stats,
              },
            };
          }
        }
        break;

      case "getMessages":
        if (!params.sessionId) {
          result = { success: false, error: "Session ID is required" };
        } else {
          const limit = params.limit || 100;
          const offset = params.offset || 0;
          const messages = getAllMessages(
            params.sessionId as string,
            limit as number,
            offset as number,
          );
          const total = getMessagesCount(params.sessionId as string);
          result = {
            success: true,
            data: {
              messages,
              total,
              limit,
              offset,
            },
          };
        }
        break;

      case "getConfig":
        result = {
          success: true,
          data: {
            version: config.VERSION,
            defaultBotName: config.BOT_NAME,
          },
        };
        break;

      case "getNetworkState":
        result = {
          success: true,
          data: sessionManager.getNetworkState(),
        };
        break;

      case "getGroups":
        if (!params.sessionId) {
          result = { success: false, error: "Session ID is required" };
        } else {
          try {
            const groups = getAllGroups(params.sessionId as string);
            result = {
              success: true,
              data: { groups, count: groups.length },
            };
          } catch (error) {
            result = {
              success: false,
              error: "Failed to retrieve groups",
            };
          }
        }
        break;

      case "pauseSession":
        if (!params.id) {
          result = { success: false, error: "Session ID is required" };
        } else {
          log.debug("Pausing session:", params.id);
          const pauseResult = await sessionManager.pause(params.id as string);
          if (pauseResult.success) {
            log.info("Session paused:", params.id);
            result = { success: true, data: { message: "Session paused" } };
          } else {
            log.error("Failed to pause session:", pauseResult.error);
            result = { success: false, error: pauseResult.error };
          }
        }
        break;

      case "resumeSession":
        if (!params.id) {
          result = { success: false, error: "Session ID is required" };
        } else {
          log.debug("Resuming session:", params.id);
          const resumeResult = await sessionManager.resume(params.id as string);
          if (resumeResult.success) {
            log.info("Session resumed:", params.id);
            result = { success: true, data: { message: "Session resumed" } };
          } else {
            log.error("Failed to resume session:", resumeResult.error);
            result = { success: false, error: resumeResult.error };
          }
        }
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

/**
 * Route handlers (HTTP fallback)
 */
const routes: Record<
  string,
  (req: Request, params?: Record<string, string>) => Promise<ApiResponse>
> = {
  // Session management
  "GET /api/sessions": async () => {
    const sessions = sessionManager.listExtended();
    return { success: true, data: sessions };
  },

  "POST /api/sessions": async (req) => {
    const body = await parseBody<SessionCreateRequest>(req);
    if (!body || !body.phoneNumber) {
      return { success: false, error: "Phone number is required" };
    }

    const result = await sessionManager.create(body.phoneNumber);
    if (result.success) {
      runtimeStats.recordSessionStart(result.id!);
      return {
        success: true,
        data: {
          id: result.id,
          pairingCode: result.code,
          pairingCodeFormatted: result.code
            ? `${result.code.slice(0, 4)}-${result.code.slice(4)}`
            : null,
        },
      };
    }

    return { success: false, error: result.error };
  },

  "GET /api/sessions/:id": async (_req, params) => {
    if (!params?.id) {
      return { success: false, error: "Session ID is required" };
    }

    const session = sessionManager.get(params.id);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    return { success: true, data: session };
  },

  "DELETE /api/sessions/:id": async (_req, params) => {
    if (!params?.id) {
      return { success: false, error: "Session ID is required" };
    }

    const result = await sessionManager.delete(params.id);
    if (result.success) {
      return { success: true, data: { message: "Session deleted" } };
    }

    return { success: false, error: result.error };
  },

  // Authentication status
  "GET /api/auth/status/:sessionId": async (_req, params) => {
    if (!params?.sessionId) {
      return { success: false, error: "Session ID is required" };
    }

    const session = sessionManager.get(params.sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    return {
      success: true,
      data: {
        sessionId: session.id,
        phoneNumber: session.phone_number,
        status: session.status,
        isAuthenticated: session.status === "active",
        isPairing: session.status === "pairing",
      },
    };
  },

  // Messages
  "GET /api/messages/:sessionId": async (_req, params) => {
    if (!params?.sessionId) {
      return { success: false, error: "Session ID is required" };
    }

    const url = new URL(_req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const messages = getAllMessages(params.sessionId, limit, offset);
    const total = getMessagesCount(params.sessionId);

    return {
      success: true,
      data: {
        messages,
        total,
        limit,
        offset,
      },
    };
  },

  // Statistics
  "GET /api/stats": async () => {
    return { success: true, data: runtimeStats.getOverallStats() };
  },

  "GET /api/stats/:sessionId": async (_req, params) => {
    if (!params?.sessionId) {
      return { success: false, error: "Session ID is required" };
    }

    const session = sessionManager.get(params.sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const stats = runtimeStats.getStats(params.sessionId);
    return {
      success: true,
      data: {
        session: {
          id: session.id,
          phoneNumber: session.phone_number,
          status: session.status,
          createdAt: session.created_at,
          pushName: session.push_name,
        },
        ...stats,
      },
    };
  },

  // Network state
  "GET /api/network": async () => {
    return {
      success: true,
      data: sessionManager.getNetworkState(),
    };
  },

  // Config endpoint (read-only)
  "GET /api/config": async () => {
    return {
      success: true,
      data: {
        version: config.VERSION,
        defaultBotName: config.BOT_NAME,
      },
    };
  },
};

/**
 * Match route pattern with path
 */
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

  // Exact match
  if (routes[routeKey]) {
    return { handler: routes[routeKey], params: {} };
  }

  // Pattern match with parameters
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

/**
 * Handle API request
 */
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

export { runtimeStats };
