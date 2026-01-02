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

import { log, sessionManager } from "./core";
import config from "./config";
import { handleApiRequest, handleWsAction } from "./service/api";
import type { ApiResponse } from "./service";
import type { WsRequest } from "./service/types";

// Import Astro SSR handler (middleware mode)
// @ts-ignore - Dynamic import of Astro build output
import { handler as astroHandler } from "./service/dist/server/entry.mjs";

const wsClients: Set<any> = new Set();

const STATIC_DIR = join(import.meta.dir, "service", "dist", "client");

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

function getMimeType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) {
    return "application/octet-stream";
  }
  const ext = filePath.substring(dotIndex).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

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
  } catch {}
  return null;
}

async function handleAstroRequest(req: Request): Promise<Response> {
  try {
    log.debug("Handling Astro SSR request:", req.url);
    const response = await astroHandler(req);
    return response;
  } catch (error) {
    log.error("Astro handler error:", error);
    return new Response(
      "Internal server error",
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      },
    );
  }
}

const server = Bun.serve({
  port: config.API_PORT,
  hostname: "0.0.0.0",
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    log.debug("Received request:", req.method, path);

    if (path === "/ws/stats" && req.headers.get("upgrade") === "websocket") {
      log.debug("WebSocket upgrade requested");
      const success = server.upgrade(req);
      if (success) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

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

    if (path.startsWith("/api/")) {
      // Handle CORS preflight requests
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

    if (path.startsWith("/_astro/")) {
      const clientPath = join(STATIC_DIR, path);
      const response = await serveStaticFile(clientPath);
      if (response) return response;
    }

    if (path === "/favicon.png") {
      const response = await serveStaticFile(join(STATIC_DIR, "favicon.png"));
      if (response) return response;
    }

    return handleAstroRequest(req);
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
