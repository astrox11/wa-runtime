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
  | "getGroups"
  | "pauseSession"
  | "resumeSession"
  | "getActivitySettings"
  | "updateActivitySettings";

export interface WsRequest {
  action: WsAction;
  requestId?: string;
  params?: Record<string, unknown>;
}

export interface WsResponse {
  action: WsAction;
  requestId?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Session {
  id: string;
  phone_number: string;
  created_at: number;
  status: "active" | "inactive" | "pairing" | "paused_user" | "connecting";
  user_info: {
    id: string;
    lid: string;
    name: string;
  };
  stats: SessionStats;
}

export interface SessionCreateResponse {
  id: string;
  code?: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  status: string;
  phoneNumber: string;
}

export interface RuntimeStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  version: string;
}

export interface SessionStats {
  messagesReceived: number;
  messagesSent: number;
}

export interface HourlyActivity {
  hourlyData: number[];
  peakHour: string;
  average: number;
}

export interface Config {
  version: string;
  botName: string;
}

export interface StatsUpdate {
  type: "stats";
  data: {
    overall: RuntimeStats;
    sessions: Array<Session & { stats: SessionStats; hourlyActivity: HourlyActivity }>;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MessagesResponse {
  messages: Array<{ id: string; message: unknown }>;
  total: number;
  limit: number;
  offset: number;
}

export interface GroupsResponse {
  groups: Array<{ id: string; subject: string; participantCount: number }>;
  total: number;
}

export interface ActivitySettings {
  auto_read_messages: boolean;
  auto_recover_deleted_messages: boolean;
  auto_antispam: boolean;
  auto_typing: boolean;
  auto_recording: boolean;
  auto_reject_calls: boolean;
  auto_always_online: boolean;
}

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
  private lastStatsData: StatsUpdate | null = null;
  private statsPollingInterval: ReturnType<typeof setInterval> | null = null;
  private isPollingActive = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.connect();
      this.startStatsPolling();
    }
  }

  private getApiBaseUrl(): string {
    let host = window.location.host;
    if (window.location.port === "4321") {
      host = `${window.location.hostname}:3000`;
    }
    return `${window.location.protocol}//${host}`;
  }

  private async fetchFullStats(): Promise<void> {
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/api/stats/full`);
      const result = (await response.json()) as ApiResponse<StatsUpdate["data"]>;

      if (result.success && result.data) {
        const statsUpdate: StatsUpdate = {
          type: "stats",
          data: result.data,
        };
        this.lastStatsData = statsUpdate;
        this.statsCallbacks.forEach((cb) => cb(statsUpdate));
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }

  private startStatsPolling(): void {
    if (this.isPollingActive) return;
    this.isPollingActive = true;

    // Fetch immediately on start
    this.fetchFullStats();

    // Then poll every 1 second
    this.statsPollingInterval = setInterval(() => {
      this.fetchFullStats();
    }, 1000);
  }

  private stopStatsPolling(): void {
    if (this.statsPollingInterval) {
      clearInterval(this.statsPollingInterval);
      this.statsPollingInterval = null;
    }
    this.isPollingActive = false;
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = window.location.host;

      if (window.location.port === "4321") {
        wsHost = `${window.location.hostname}:3000`;
      }

      const wsUrl = `${protocol}//${wsHost}/ws/stats`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isReconnecting = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error(e);
          return;
        }

        if (data.requestId && this.pendingRequests.has(data.requestId)) {
          const pending = this.pendingRequests.get(data.requestId)!;
          this.pendingRequests.delete(data.requestId);
          pending.resolve(data);
          return;
        }
      };

      this.ws.onerror = (error) => {
        console.error(error);
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        this.connectionPromise = null;
        this.ws = null;

        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error("WebSocket connection closed"));
        });
        this.pendingRequests.clear();

        if (!this.isReconnecting) {
          this.isReconnecting = true;
          console.log("Reconnecting in 3 seconds...");
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

  onStats(callback: (data: StatsUpdate) => void): () => void {
    this.statsCallbacks.add(callback);

    if (this.lastStatsData) setTimeout(() => callback(this.lastStatsData!), 0);

    return () => {
      this.statsCallbacks.delete(callback);
    };
  }

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

  async getAuthStatus(sessionId: string): Promise<ApiResponse<AuthStatus>> {
    return this.send<AuthStatus>("getAuthStatus", { sessionId });
  }

  async getOverallStats(): Promise<ApiResponse<RuntimeStats>> {
    return this.send<RuntimeStats>("getStats");
  }

  async getSessionStats(sessionId: string): Promise<ApiResponse<SessionStats>> {
    return this.send<SessionStats>("getSessionStats", { sessionId });
  }

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

  async getConfig(): Promise<ApiResponse<Config>> {
    return this.send<Config>("getConfig");
  }

  async getGroups(sessionId: string): Promise<ApiResponse<GroupsResponse>> {
    return this.send<GroupsResponse>("getGroups", { sessionId });
  }

  async getActivitySettings(
    sessionId: string,
  ): Promise<ApiResponse<ActivitySettings>> {
    return this.send<ActivitySettings>("getActivitySettings", { sessionId });
  }

  async updateActivitySettings(
    sessionId: string,
    settings: Partial<ActivitySettings>,
  ): Promise<ApiResponse<ActivitySettings>> {
    return this.send<ActivitySettings>("updateActivitySettings", {
      sessionId,
      settings,
    });
  }

  connectStats(onMessage: (data: StatsUpdate) => void): WebSocket | null {
    this.onStats(onMessage);
    return this.ws;
  }

  async sendAction(
    action: WsAction,
    params?: Record<string, unknown>,
  ): Promise<WsResponse> {
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

        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error("Request timeout"));
          }
        }, 30000);
      });

      return response;
    } catch (error) {
      return {
        action,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  destroy() {
    this.stopStatsPolling();
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

let apiClientInstance: WsApiClient | null = null;

function getApiClient(): WsApiClient {
  if (!apiClientInstance && typeof window !== "undefined") {
    apiClientInstance = new WsApiClient();
  }
  return apiClientInstance!;
}

export const api = {
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

  async getAuthStatus(sessionId: string): Promise<ApiResponse<AuthStatus>> {
    return getApiClient().getAuthStatus(sessionId);
  },

  async getOverallStats(): Promise<ApiResponse<RuntimeStats>> {
    return getApiClient().getOverallStats();
  },

  async getSessionStats(sessionId: string): Promise<ApiResponse<SessionStats>> {
    return getApiClient().getSessionStats(sessionId);
  },

  async getMessages(
    sessionId: string,
    limit = 100,
    offset = 0,
  ): Promise<ApiResponse<MessagesResponse>> {
    return getApiClient().getMessages(sessionId, limit, offset);
  },

  async getConfig(): Promise<ApiResponse<Config>> {
    return getApiClient().getConfig();
  },

  async getGroups(sessionId: string): Promise<ApiResponse<GroupsResponse>> {
    return getApiClient().getGroups(sessionId);
  },

  async getActivitySettings(
    sessionId: string,
  ): Promise<ApiResponse<ActivitySettings>> {
    return getApiClient().getActivitySettings(sessionId);
  },

  async updateActivitySettings(
    sessionId: string,
    settings: Partial<ActivitySettings>,
  ): Promise<ApiResponse<ActivitySettings>> {
    return getApiClient().updateActivitySettings(sessionId, settings);
  },

  async sendAction(
    action: WsAction,
    params?: Record<string, unknown>,
  ): Promise<WsResponse> {
    return getApiClient().sendAction(action, params);
  },

  onStats(callback: (data: StatsUpdate) => void): () => void {
    return getApiClient().onStats(callback);
  },

  connectStats: (onMessage: (data: StatsUpdate) => void): WebSocket | null => {
    return getApiClient().connectStats(onMessage);
  },
};
