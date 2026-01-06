import { WebSocket } from "ws";
import Bun from "bun";

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

import { log, sessionManager } from "./core";
import config from "./config";
import { handleApiRequest, handleWsAction } from "./api";
import type { ApiResponse, WsRequest } from "./api";

const wsClients: Set<any> = new Set();

// Note: Astro SSR is no longer used - frontend is served as static HTML from Go server
log.info("Starting Bun API server (no Astro SSR)...");

function getHttpStatusCode(data: ApiResponse): number {
  if (data.success) {
    return 200;
  }
  if (data.error?.includes("not found")) {
    return 404;
  }
  return 400;
}

function createResponse(data: ApiResponse): Response {
  return new Response(JSON.stringify(data), {
    status: getHttpStatusCode(data),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Signal handlers for graceful shutdown
process.on("SIGINT", () => {
  log.info("Received SIGINT, shutting down...");
  // Close all WebSocket connections gracefully
  for (const client of wsClients) {
    try {
      client.close();
    } catch (e) {
      // Ignore close errors
    }
  }
  wsClients.clear();
  process.exit(0);
});
process.on("SIGTERM", () => {
  log.info("Received SIGTERM, shutting down...");
  // Close all WebSocket connections gracefully
  for (const client of wsClients) {
    try {
      client.close();
    } catch (e) {
      // Ignore close errors
    }
  }
  wsClients.clear();
  process.exit(0);
});

const server = Bun.serve({
  port: config.API_PORT,
  hostname: process.env.HOST || "0.0.0.0",
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    log.debug("Received request:", req.method, path);

    // WebSocket upgrade for stats
    if (path === "/ws/stats" && req.headers.get("upgrade") === "websocket") {
      log.debug("WebSocket upgrade requested");
      const success = server.upgrade(req);
      if (success) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Health check
    if (path === "/health" && req.method === "GET") {
      log.debug("Health check requested");
      return createResponse({
        success: true,
        data: {
          status: "healthy",
          version: config.VERSION,
        },
      });
    }

    // API routes
    if (path.startsWith("/api/")) {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      log.debug("API request:", path);
      const result = await handleApiRequest(req);
      return createResponse(result);
    }

    // All other routes - return 404 (frontend is served by Go)
    return new Response("Not Found - Frontend is served by Go server", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
    },
    async message(ws, message) {
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
    },
  },
});

log.info(`Bun API server listening on port ${config.API_PORT}`);
log.debug("Debug mode:", config.DEBUG ? "enabled" : "disabled");

sessionManager
  .restore_all()
  .then(() => {
    log.info("Session restoration complete");
  })
  .catch((error) => {
    log.error("Failed to restore sessions:", error);
  });

export { server };
