/**
 * wa-runtime Backend Service
 *
 * Exposes HTTP APIs for session management, authentication, messaging, and statistics.
 * Supports multiple isolated sessions consumable by external clients.
 * Serves static frontend files from the same host.
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
import { handleApiRequest, handleWsAction, runtimeStats, type ApiResponse, type WsRequest } from "./api";

/**
 * WebSocket clients for stats streaming
 */
const wsClients: Set<any> = new Set();

/**
 * Broadcast stats to all connected WebSocket clients
 */
function broadcastStats() {
  if (wsClients.size === 0) return;
  
  const overallStats = runtimeStats.getOverallStats();
  const sessions = sessionManager.listExtended();
  const networkState = sessionManager.getNetworkState();
  
  const message = JSON.stringify({
    type: "stats",
    data: {
      overall: overallStats,
      sessions: sessions.map(s => ({
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

const STATIC_DIR = join(import.meta.dir, "astro-web-runtime", "dist");

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
 * Main server handler
 */
const server = Bun.serve({
  port: config.API_PORT,
  hostname: config.API_HOST,
  async fetch(req, server) {
    const url = new URL(req.url);
    let path = url.pathname;

    // WebSocket upgrade for stats streaming
    if (path === "/ws/stats" && req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (success) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Health check endpoint
    if (path === "/health" && req.method === "GET") {
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
      const result = await handleApiRequest(req);
      return createResponse(result);
    }

    // Serve static files
    // Try exact path first
    let filePath = join(STATIC_DIR, path);
    let response = await serveStaticFile(filePath);
    if (response) return response;

    // Try with .html extension
    if (!path.endsWith(".html") && !path.includes(".")) {
      response = await serveStaticFile(filePath + ".html");
      if (response) return response;
    }

    // Try index.html for directory paths
    if (path.endsWith("/")) {
      response = await serveStaticFile(join(filePath, "index.html"));
      if (response) return response;
    }

    // Try 404 page first
    const notFoundPage = await serveStaticFile(join(STATIC_DIR, "404.html"));
    if (notFoundPage) {
      return new Response(notFoundPage.body, {
        status: 404,
        headers: notFoundPage.headers,
      });
    }

    // Fallback to plain 404
    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
      log.info("WebSocket client connected for stats");
      
      // Send initial stats immediately
      const overallStats = runtimeStats.getOverallStats();
      const sessions = sessionManager.listExtended();
      const networkState = sessionManager.getNetworkState();
      
      ws.send(JSON.stringify({
        type: "stats",
        data: {
          overall: overallStats,
          sessions: sessions.map(s => ({
            ...s,
            stats: runtimeStats.getStats(s.id),
          })),
          network: networkState,
        },
      }));
    },
    async message(ws, message) {
      // Handle WebSocket action requests
      try {
        const msgStr = typeof message === "string" ? message : message.toString();
        const request = JSON.parse(msgStr) as WsRequest;
        
        if (request.action) {
          const response = await handleWsAction(request);
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        log.error("WebSocket message error:", error);
        ws.send(JSON.stringify({
          success: false,
          error: "Invalid message format",
        }));
      }
    },
    close(ws) {
      wsClients.delete(ws);
      log.info("WebSocket client disconnected");
    },
  },
});

log.info(
  `wa-runtime server running on http://${config.API_HOST}:${config.API_PORT}`,
);

sessionManager
  .restoreAllSessions()
  .then(() => {
    log.info("Session restoration complete");
  })
  .catch((error) => {
    log.error("Failed to restore sessions:", error);
  });

export { server };
