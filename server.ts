/**
 * Whatsaly Backend Service
 *
 * Exposes HTTP APIs for session management, authentication, messaging, and statistics.
 * Supports multiple isolated sessions consumable by external clients.
 * Proxies page requests to Astro SSR server.
 * Includes WebSocket support for real-time stats streaming and bidirectional communication.
 */

import { WebSocket } from "ws";
import Bun from "bun";
import { join } from "path";

const wsListener = WebSocket.prototype.on || WebSocket.prototype.addListener;
const mockEvent = (event: string) =>
  event === "upgrade" || event === "unexpected-response";

if (wsListener) {
  const patch = function (this: any, event: string, listener: any) {
    if (mockEvent(event)) return this;
    return wsListener.call(this, event, listener);
  };
  if (WebSocket.prototype.on) WebSocket.prototype.on = patch;
  if (WebSocket.prototype.addListener) WebSocket.prototype.addListener = patch;
}

import { log, sessionManager } from "./lib";
import config from "./config";
import {
  handleApiRequest,
  handleWsAction,
  runtimeStats,
  type ApiResponse,
  type WsRequest,
} from "./api";

/**
 * WebSocket clients for stats streaming
 */
const wsClients: Set<any> = new Set();

/**
 * Broadcast stats to all connected WebSocket clients
 */
function broadcastStats() {
  if (wsClients.size === 0) return;

  log.debug("Broadcasting stats to", wsClients.size, "WebSocket clients");

  const overallStats = runtimeStats.getOverallStats();
  const sessions = sessionManager.listExtended();
  const networkState = sessionManager.getNetworkState();

  const message = JSON.stringify({
    type: "stats",
    data: {
      overall: overallStats,
      sessions: sessions.map((s) => ({
        ...s,
        stats: runtimeStats.getStats(s.id),
      })),
      network: networkState,
    },
  });

  for (const client of wsClients) {
    try {
      client.send(message);
    } catch {
      wsClients.delete(client);
    }
  }
}

// Broadcast stats every 500ms for more instant updates
const BROADCAST_INTERVAL_MS = 500;
setInterval(broadcastStats, BROADCAST_INTERVAL_MS);

const STATIC_DIR = join(import.meta.dir, "service", "dist", "client");
const ASTRO_SERVER_URL = "http://localhost:4321";

/**
 * MIME types for static files
 */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) {
    return "application/octet-stream";
  }
  const ext = filePath.substring(dotIndex).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Determine HTTP status code from API response
 */
function getHttpStatusCode(data: ApiResponse): number {
  if (data.success) {
    return 200;
  }
  if (data.error?.includes("not found")) {
    return 404;
  }
  return 400;
}

/**
 * Create HTTP response with proper headers
 */
function createResponse(data: ApiResponse): Response {
  return new Response(JSON.stringify(data), {
    status: getHttpStatusCode(data),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Serve static file
 */
async function serveStaticFile(filePath: string): Promise<Response | null> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (exists) {
      return new Response(file, {
        headers: {
          "Content-Type": getMimeType(filePath),
        },
      });
    }
  } catch {
    // File doesn't exist
  }
  return null;
}

/**
 * Proxy request to Astro SSR server
 */
async function proxyToAstro(req: Request): Promise<Response> {
  try {
    log.debug("Proxying request to Astro SSR server:", req.url);
    const url = new URL(req.url);
    const astroUrl = new URL(url.pathname + url.search, ASTRO_SERVER_URL);

    const proxyReq = new Request(astroUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    const response = await fetch(proxyReq);
    return response;
  } catch (error) {
    log.error("Failed to proxy to Astro server:", error);
    return new Response(
      "Frontend server unavailable. Make sure to run both servers in production mode: bun run start:all",
      {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      },
    );
  }
}

/**
 * Main server handler
 */
const server = Bun.serve({
  port: config.API_PORT,
  hostname: config.API_HOST,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    log.debug("Received request:", req.method, path);

    // WebSocket upgrade for stats streaming
    if (path === "/ws/stats" && req.headers.get("upgrade") === "websocket") {
      log.debug("WebSocket upgrade requested");
      const success = server.upgrade(req);
      if (success) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Health check endpoint
    if (path === "/health" && req.method === "GET") {
      log.debug("Health check requested");
      return createResponse({
        success: true,
        data: {
          status: "healthy",
          version: config.VERSION,
          uptime: process.uptime(),
          network: sessionManager.getNetworkState(),
        },
      });
    }

    // API routes
    if (path.startsWith("/api/")) {
      log.debug("API request:", path);
      const result = await handleApiRequest(req);
      return createResponse(result);
    }

    // Serve static files from client folder (_astro assets)
    if (path.startsWith("/_astro/")) {
      const clientPath = join(STATIC_DIR, path);
      const response = await serveStaticFile(clientPath);
      if (response) return response;
    }

    // Serve favicon
    if (path === "/favicon.svg") {
      const response = await serveStaticFile(join(STATIC_DIR, "favicon.svg"));
      if (response) return response;
    }

    // Proxy all other requests to Astro SSR server for dynamic page rendering
    return proxyToAstro(req);
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
      log.info("WebSocket client connected for stats");

      // Send initial stats immediately
      const overallStats = runtimeStats.getOverallStats();
      const sessions = sessionManager.listExtended();
      const networkState = sessionManager.getNetworkState();

      ws.send(
        JSON.stringify({
          type: "stats",
          data: {
            overall: overallStats,
            sessions: sessions.map((s) => ({
              ...s,
              stats: runtimeStats.getStats(s.id),
            })),
            network: networkState,
          },
        }),
      );
    },
    async message(ws, message) {
      // Handle WebSocket action requests
      try {
        const msgStr =
          typeof message === "string" ? message : message.toString();
        const request = JSON.parse(msgStr) as WsRequest;

        if (request.action) {
          const response = await handleWsAction(request);
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        log.error("WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            success: false,
            error: "Invalid message format",
          }),
        );
      }
    },
    close(ws) {
      wsClients.delete(ws);
      log.info("WebSocket client disconnected");
    },
  },
});

log.info(
  `Whatsaly server running on http://${config.API_HOST}:${config.API_PORT}`,
);

log.debug("Debug mode:", config.DEBUG ? "enabled" : "disabled");

sessionManager
  .restoreAllSessions()
  .then(() => {
    log.info("Session restoration complete");
  })
  .catch((error) => {
    log.error("Failed to restore sessions:", error);
  });

export { server };
