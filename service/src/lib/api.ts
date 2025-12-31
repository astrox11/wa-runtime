/**
 * API Client for communicating with Whatsaly backend
 * Uses WebSocket for real-time bidirectional communication
 */

/**
 * WebSocket Action Types
 */
type WsAction =
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

interface WsRequest {
  action: WsAction;
  requestId?: string;
  params?: Record<string, unknown>;
}

interface WsResponse {
  action: WsAction;
  requestId?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface Session {
  id: string;
  phone_number: string;
  created_at: number;
  status: "active" | "inactive" | "pairing";
  pushName?: string;
  push_name?: string;
}

interface SessionCreateResponse {
  id: string;
  pairingCode: string;
  pairingCodeFormatted: string;
}

interface AuthStatus {
  sessionId: string;
  phoneNumber: string;
  status: string;
  isAuthenticated: boolean;
  isPairing: boolean;
}

interface RuntimeStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  version: string;
  serverUptime: number;
  serverUptimeFormatted: string;
}

interface SessionStats {
  session: Session & { pushName?: string };
  messages: number;
  uptime: number;
  uptimeFormatted: string;
  hourlyActivity: number[];
  avgMessagesPerHour: number;
}

interface Config {
  version: string;
  defaultBotName: string;
}

interface NetworkState {
  isHealthy: boolean;
  consecutiveFailures: number;
  lastCheck: number;
  isPaused: boolean;
}

interface StatsUpdate {
  type: "stats";
  data: {
    overall: RuntimeStats;
    sessions: Array<Session & { stats: SessionStats }>;
    network: NetworkState;
  };
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface MessagesResponse {
  messages: Array<{ id: string; message: unknown }>;
  total: number;
  limit: number;
  offset: number;
}

/**
 * WebSocket-based API Client
 */
interface PendingRequest {
  resolve: (value: WsResponse) => void;
  reject: (error: Error) => void;
}

class WsApiClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private statsCallbacks: Set<(data: StatsUpdate) => void> = new Set();
  private connectionPromise: Promise<void> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;
  private lastStatsData: StatsUpdate | null = null; // Store last stats for late subscribers

  constructor() {
    if (typeof window !== "undefined") {
      this.connect();
    }
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

      // In production, when served by Astro SSR server (port 4321), connect to backend (port 3000)
      // In development, Vite proxies /ws to backend so use same host
      let wsHost = window.location.host;

      // If we're on the Astro SSR port (4321), redirect WebSocket to backend port (3000)
      // This handles the case where users access the Astro server directly
      if (window.location.port === "4321") {
        wsHost = `${window.location.hostname}:3000`;
      }

      const wsUrl = `${protocol}//${wsHost}/ws/stats`;
      console.log("[Whatsaly] Connecting to WebSocket:", wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[Whatsaly] WebSocket connected");
        this.isReconnecting = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error("[Whatsaly] Invalid JSON:", e);
          return;
        }

        console.log("[Whatsaly] WebSocket message received:", data.type);

        if (data.requestId && this.pendingRequests.has(data.requestId)) {
          const pending = this.pendingRequests.get(data.requestId)!;
          this.pendingRequests.delete(data.requestId);
          pending.resolve(data);
          return;
        }

        if (data?.type === "stats") {
          this.lastStatsData = data;
          console.log(
            "[Whatsaly] Broadcasting stats to",
            this.statsCallbacks.size,
            "callbacks",
          );
          this.statsCallbacks.forEach((cb) => cb(data));
        }
      };

      this.ws.onerror = (error) => {
        console.error("[Whatsaly] WebSocket error:", error);
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = (event) => {
        console.log("[Whatsaly] WebSocket closed:", event.code, event.reason);
        this.connectionPromise = null;
        this.ws = null;

        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error("WebSocket connection closed"));
        });
        this.pendingRequests.clear();

        // Reconnect after delay
        if (!this.isReconnecting) {
          this.isReconnecting = true;
          console.log("[Whatsaly] Reconnecting in 3 seconds...");
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
    });

    return this.connectionPromise;
  }

  private async send<T>(
    action: WsAction,
    params?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    try {
      await this.connect();

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }

      const requestId = `req_${++this.requestId}`;

      const response = await new Promise<WsResponse>((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject });

        const request: WsRequest = {
          action,
          requestId,
          params,
        };

        this.ws!.send(JSON.stringify(request));

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error("Request timeout"));
          }
        }, 30000);
      });

      return {
        success: response.success,
        data: response.data as T,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Subscribe to stats updates
  onStats(callback: (data: StatsUpdate) => void): () => void {
    this.statsCallbacks.add(callback);

    // Immediately send the last known stats to new subscribers
    if (this.lastStatsData) {
      console.log("[Whatsaly] Sending cached stats to new subscriber");
      setTimeout(() => callback(this.lastStatsData!), 0);
    }

    return () => {
      this.statsCallbacks.delete(callback);
    };
  }

  // Session management
  async getSessions(): Promise<ApiResponse<Session[]>> {
    return this.send<Session[]>("getSessions");
  }

  async getSession(id: string): Promise<ApiResponse<Session>> {
    return this.send<Session>("getSession", { id });
  }

  async createSession(
    phoneNumber: string,
  ): Promise<ApiResponse<SessionCreateResponse>> {
    return this.send<SessionCreateResponse>("createSession", { phoneNumber });
  }

  async deleteSession(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.send<{ message: string }>("deleteSession", { id });
  }

  // Authentication
  async getAuthStatus(sessionId: string): Promise<ApiResponse<AuthStatus>> {
    return this.send<AuthStatus>("getAuthStatus", { sessionId });
  }

  // Statistics
  async getOverallStats(): Promise<ApiResponse<RuntimeStats>> {
    return this.send<RuntimeStats>("getStats");
  }

  async getSessionStats(sessionId: string): Promise<ApiResponse<SessionStats>> {
    return this.send<SessionStats>("getSessionStats", { sessionId });
  }

  // Messages
  async getMessages(
    sessionId: string,
    limit = 100,
    offset = 0,
  ): Promise<ApiResponse<MessagesResponse>> {
    return this.send<MessagesResponse>("getMessages", {
      sessionId,
      limit,
      offset,
    });
  }

  // Config
  async getConfig(): Promise<ApiResponse<Config>> {
    return this.send<Config>("getConfig");
  }

  // Network
  async getNetworkState(): Promise<ApiResponse<NetworkState>> {
    return this.send<NetworkState>("getNetworkState");
  }

  // Legacy method for backward compatibility
  connectStats(onMessage: (data: StatsUpdate) => void): WebSocket | null {
    this.onStats(onMessage);
    return this.ws;
  }

  // Cleanup
  destroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.statsCallbacks.clear();
    this.pendingRequests.clear();
  }
}

// Singleton instance
let apiClientInstance: WsApiClient | null = null;

function getApiClient(): WsApiClient {
  if (!apiClientInstance && typeof window !== "undefined") {
    apiClientInstance = new WsApiClient();
  }
  return apiClientInstance!;
}

export const api = {
  // Session management
  async getSessions(): Promise<ApiResponse<Session[]>> {
    return getApiClient().getSessions();
  },

  async getSession(id: string): Promise<ApiResponse<Session>> {
    return getApiClient().getSession(id);
  },

  async createSession(
    phoneNumber: string,
  ): Promise<ApiResponse<SessionCreateResponse>> {
    return getApiClient().createSession(phoneNumber);
  },

  async deleteSession(id: string): Promise<ApiResponse<{ message: string }>> {
    return getApiClient().deleteSession(id);
  },

  // Authentication
  async getAuthStatus(sessionId: string): Promise<ApiResponse<AuthStatus>> {
    return getApiClient().getAuthStatus(sessionId);
  },

  // Statistics
  async getOverallStats(): Promise<ApiResponse<RuntimeStats>> {
    return getApiClient().getOverallStats();
  },

  async getSessionStats(sessionId: string): Promise<ApiResponse<SessionStats>> {
    return getApiClient().getSessionStats(sessionId);
  },

  // Messages
  async getMessages(
    sessionId: string,
    limit = 100,
    offset = 0,
  ): Promise<ApiResponse<MessagesResponse>> {
    return getApiClient().getMessages(sessionId, limit, offset);
  },

  // Config
  async getConfig(): Promise<ApiResponse<Config>> {
    return getApiClient().getConfig();
  },

  // Network
  async getNetworkState(): Promise<ApiResponse<NetworkState>> {
    return getApiClient().getNetworkState();
  },

  // Generic action sender (for custom actions)
  async sendAction(action: WsAction, params?: Record<string, unknown>): Promise<WsResponse> {
    return getApiClient().send(action, params);
  },

  // Stats subscription
  onStats(callback: (data: StatsUpdate) => void): () => void {
    return getApiClient().onStats(callback);
  },

  // Legacy method
  connectStats: (onMessage: (data: StatsUpdate) => void): WebSocket | null => {
    return getApiClient().connectStats(onMessage);
  },
};

export type {
  Session,
  SessionCreateResponse,
  AuthStatus,
  RuntimeStats,
  SessionStats,
  Config,
  ApiResponse,
  StatsUpdate,
  NetworkState,
  MessagesResponse,
};
