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
import { handleApiRequest } from "./api";
import type { ApiResponse } from "./api";

const GO_SERVER = "http://127.0.0.1:8000";

log.info("Starting Bun API server...");

function getHttpStatusCode(data: ApiResponse): number {
  if (data.success) return 200;
  if (data.error?.includes("not found")) return 404;
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

async function pushStatsToGo() {
  try {
    const sessions = sessionManager.listExtended();
    const activeSessions = sessions.filter(
      (s) => s.status === 1 || s.status === 2,
    ).length;

    const payload = {
      overall: {
        totalSessions: sessions.length,
        activeSessions,
        totalMessages: 0,
        version: config.VERSION,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        phone_number: s.phone_number,
        status: getStatusString(s.status),
        user_info: s.user_info ?? null,
        created_at: s.created_at,
      })),
    };

    await fetch(`${GO_SERVER}/api/bun/push/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    log.debug("Failed to push stats to Go:", e);
  }
}

function getStatusString(status: number): string {
  switch (status) {
    case 1:
    case 2:
      return "connected";
    case 3:
      return "pairing";
    case 4:
      return "paused";
    default:
      return "inactive";
  }
}

setInterval(pushStatsToGo, 2000);

process.on("SIGINT", () => {
  log.info("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log.info("Received SIGTERM, shutting down...");
  process.exit(0);
});

const server = Bun.serve({
  port: config.API_PORT,
  hostname: process.env.HOST || "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    log.debug("Request:", req.method, path);

    if (path === "/health" && req.method === "GET") {
      return createResponse({
        success: true,
        data: { status: "healthy", version: config.VERSION },
      });
    }

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
      const result = await handleApiRequest(req);
      if (
        path.includes("/sessions") &&
        (req.method === "POST" || req.method === "DELETE")
      ) {
        setTimeout(pushStatsToGo, 100);
      }
      return createResponse(result);
    }

    return new Response("Not Found", { status: 404 });
  },
});

log.info(`Bun API server listening on port ${config.API_PORT}`);

sessionManager
  .restore_all()
  .then(() => {
    log.info("Session restoration complete");
    pushStatsToGo();
  })
  .catch((error) => {
    log.error("Failed to restore sessions:", error);
  });

export { server };
