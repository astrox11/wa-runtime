/**
 * API Client for communicating with wa-runtime backend
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
  | "getNetworkState";

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
  status: 'active' | 'inactive' | 'pairing';
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
  type: 'stats';
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

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/stats`);

      this.ws.onopen = () => {
        this.isReconnecting = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a response to a pending request
          if (data.requestId && this.pendingRequests.has(data.requestId)) {
            const pending = this.pendingRequests.get(data.requestId)!;
            this.pendingRequests.delete(data.requestId);
            pending.resolve(data);
            return;
          }

          // Otherwise it's a broadcast (stats update)
          if (data.type === 'stats') {
            this.statsCallbacks.forEach(callback => callback(data));
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.connectionPromise = null;
        this.ws = null;
        
        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('WebSocket connection closed'));
        });
        this.pendingRequests.clear();

        // Reconnect after delay
        if (!this.isReconnecting) {
          this.isReconnecting = true;
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
    });

    return this.connectionPromise;
  }

  private async send<T>(action: WsAction, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      await this.connect();
      
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
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
            reject(new Error('Request timeout'));
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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Subscribe to stats updates
  onStats(callback: (data: StatsUpdate) => void): () => void {
    this.statsCallbacks.add(callback);
    return () => {
      this.statsCallbacks.delete(callback);
    };
  }

  // Session management
  async getSessions(): Promise<ApiResponse<Session[]>> {
    return this.send<Session[]>('getSessions');
  }

  async getSession(id: string): Promise<ApiResponse<Session>> {
    return this.send<Session>('getSession', { id });
  }

  async createSession(phoneNumber: string): Promise<ApiResponse<SessionCreateResponse>> {
    return this.send<SessionCreateResponse>('createSession', { phoneNumber });
  }

  async deleteSession(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.send<{ message: string }>('deleteSession', { id });
  }

  // Authentication
  async getAuthStatus(sessionId: string): Promise<ApiResponse<AuthStatus>> {
    return this.send<AuthStatus>('getAuthStatus', { sessionId });
  }

  // Statistics
  async getOverallStats(): Promise<ApiResponse<RuntimeStats>> {
    return this.send<RuntimeStats>('getStats');
  }

  async getSessionStats(sessionId: string): Promise<ApiResponse<SessionStats>> {
    return this.send<SessionStats>('getSessionStats', { sessionId });
  }

  // Messages
  async getMessages(sessionId: string, limit = 100, offset = 0): Promise<ApiResponse<MessagesResponse>> {
    return this.send<MessagesResponse>('getMessages', { sessionId, limit, offset });
  }

  // Config
  async getConfig(): Promise<ApiResponse<Config>> {
    return this.send<Config>('getConfig');
  }

  // Network
  async getNetworkState(): Promise<ApiResponse<NetworkState>> {
    return this.send<NetworkState>('getNetworkState');
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
  if (!apiClientInstance && typeof window !== 'undefined') {
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

  async createSession(phoneNumber: string): Promise<ApiResponse<SessionCreateResponse>> {
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
  async getMessages(sessionId: string, limit = 100, offset = 0): Promise<ApiResponse<MessagesResponse>> {
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
