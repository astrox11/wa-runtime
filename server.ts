import { WebSocket } from "ws";
import Bun from "bun";
import { join } from "path";
import { spawn } from "child_process";

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

const wsClients: Set<any> = new Set();

const STATIC_DIR = join(import.meta.dir, "service", "dist", "client");
const ASTRO_PORT = 4321;
const ASTRO_SERVER_URL = `http://localhost:${ASTRO_PORT}`;

// Start Astro SSR server as a child process (internal port only)
let astroProcess: ReturnType<typeof spawn> | null = null;

function startAstroServer(): void {
  const entryPath = join(import.meta.dir, "service", "dist", "server", "entry.mjs");
  
  astroProcess = spawn("node", [entryPath], {
    cwd: join(import.meta.dir, "service"),
    env: {
      ...process.env,
      PORT: String(ASTRO_PORT),
      HOST: "127.0.0.1", // Only listen on localhost (internal)
    },
    stdio: "pipe",
  });

  astroProcess.stdout?.on("data", (data) => {
    const msg = data.toString().trim();
    log.debug("[Astro]", msg);
    // Log when Astro is ready
    if (msg.includes("Server listening")) {
      log.info(`Astro SSR server ready on internal port ${ASTRO_PORT}`);
    }
  });

  astroProcess.stderr?.on("data", (data) => {
    log.error("[Astro]", data.toString().trim());
  });

  astroProcess.on("error", (err) => {
    log.error("Failed to start Astro server:", err);
  });

  astroProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log.error(`Astro server exited with code ${code}`);
    }
    astroProcess = null;
  });

  log.info(`Starting Astro SSR server on internal port ${ASTRO_PORT}...`);
}

// Cleanup handler for graceful shutdown
function cleanup(): void {
  if (astroProcess) {
    astroProcess.kill();
    astroProcess = null;
  }
}

// Register cleanup handlers once
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// Start Astro server on startup
startAstroServer();

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
      "Frontend server is starting up, please wait a moment and refresh...",
      {
        status: 503,
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

    return proxyToAstro(req);
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
