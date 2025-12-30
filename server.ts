/**
 * wa-runtime Backend Service
 *
 * Exposes HTTP APIs for session management, authentication, messaging, and statistics.
 * Supports multiple isolated sessions consumable by external clients.
 * Serves static frontend files from the same host.
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
import { handleApiRequest, type ApiResponse } from "./api";

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
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
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
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Health check endpoint
    if (path === "/health" && req.method === "GET") {
      return createResponse({
        success: true,
        data: {
          status: "healthy",
          version: config.VERSION,
          uptime: process.uptime(),
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

    // Fallback to index.html for SPA routing
    response = await serveStaticFile(join(STATIC_DIR, "index.html"));
    if (response) return response;

    // 404 for unknown routes
    return new Response("Not Found", { status: 404 });
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
