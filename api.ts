/**
 * API Routes Handler
 *
 * Handles all API endpoints for session management, authentication, messaging, and statistics.
 */

import { sessionManager, log } from "./lib";
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

/**
 * Statistics tracking for the runtime
 */
class RuntimeStats {
  private messageCount: Map<string, number> = new Map();
  private sessionStartTimes: Map<string, number> = new Map();
  private hourlyActivity: Map<string, number[]> = new Map();

  recordMessage(sessionId: string) {
    const current = this.messageCount.get(sessionId) || 0;
    this.messageCount.set(sessionId, current + 1);

    // Track hourly activity
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
    const messages = this.messageCount.get(sessionId) || 0;
    const startTime = this.sessionStartTimes.get(sessionId) || Date.now();
    const uptime = Date.now() - startTime;

    const hourlyKey = `${sessionId}_${new Date().toDateString()}`;
    const hourlyData = this.hourlyActivity.get(hourlyKey) || new Array(24).fill(0);

    return {
      messages,
      uptime,
      uptimeFormatted: formatUptime(uptime),
      hourlyActivity: hourlyData,
      avgMessagesPerHour: messages / Math.max(1, Math.ceil(uptime / 3600000)),
    };
  }

  getOverallStats() {
    let totalMessages = 0;
    this.messageCount.forEach((count) => {
      totalMessages += count;
    });

    return {
      totalSessions: sessionManager.list().length,
      activeSessions: sessionManager.getActiveCount(),
      totalMessages,
      version: config.VERSION,
      serverUptime: process.uptime(),
      serverUptimeFormatted: formatUptime(process.uptime() * 1000),
    };
  }
}

// Time constants for uptime formatting
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

/**
 * Parse JSON body from request
 */
async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

/**
 * Route handlers
 */
const routes: Record<string, Record<string, (req: Request, params?: Record<string, string>) => Promise<ApiResponse>>> = {
  // Session management
  "GET /api/sessions": async () => {
    const sessions = sessionManager.list();
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
        },
        ...stats,
      },
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
): { handler: (req: Request, params?: Record<string, string>) => Promise<ApiResponse>; params: Record<string, string> } | null {
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
