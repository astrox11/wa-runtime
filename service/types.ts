/**
 * Service layer type definitions
 * Types for API responses and WebSocket communication
 */

/** Generic API response structure */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Session data returned from API */
export interface SessionData {
  id: string;
  phone_number: string;
  status: number;
  user_info?: {
    id?: string;
    name?: string;
    lid?: string;
  } | null;
  created_at?: number;
}

/** Result of session creation */
export interface SessionCreateResult {
  id: string;
  code?: string;
}

/** Auth status data */
export interface AuthStatusData {
  isAuthenticated: boolean;
  qrCode?: string;
  pairingCode?: string;
}

/** Session stats data */
export interface SessionStatsData {
  messagesReceived: number;
  messagesSent: number;
  uptime: number;
}

/** Overall runtime stats data */
export interface OverallStatsData {
  totalSessions: number;
  activeSessions: number;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

/** Messages data returned from API */
export interface MessagesData {
  messages: Array<{
    id: string;
    message: unknown;
  }>;
  total: number;
}

/** Configuration data */
export interface ConfigData {
  version: string;
  botName: string;
  debug: boolean;
}

/** Group data */
export interface GroupData {
  id: string;
  subject: string;
  participantCount: number;
}

/** Groups data returned from API */
export interface GroupsData {
  groups: GroupData[];
  total: number;
}

/** Session creation request parameters */
export interface SessionCreateRequest {
  phoneNumber: string;
  botName?: string;
}

/** WebSocket action types for bidirectional communication */
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
  | "getNetworkState"
  | "getGroups"
  | "pauseSession"
  | "resumeSession";

/** WebSocket request structure */
export interface WsRequest {
  action: WsAction;
  requestId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

/** WebSocket response structure */
export interface WsResponse {
  action: WsAction;
  requestId?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Known WebSocket response types for type-safe handling */
export interface WsResponsePayloads {
  getSessions: SessionData[];
  getSession: SessionData;
  createSession: SessionCreateResult;
  deleteSession: MessageResult;
  getAuthStatus: AuthStatusData;
  getStats: OverallStatsData;
  getSessionStats: SessionStatsData;
  getMessages: MessagesData;
  getConfig: ConfigData;
  getNetworkState: NetworkStateData;
  getGroups: GroupsData;
  pauseSession: MessageResult;
  resumeSession: MessageResult;
}

/** Generic message result for operations */
export interface MessageResult {
  message: string;
}

/** Network health state */
export interface NetworkStateData {
  isHealthy: boolean;
  consecutiveFailures: number;
  lastCheck: number;
  isPaused: boolean;
}

/** Stats update push from server */
export interface StatsUpdate {
  type: "stats";
  data: {
    overall: OverallStatsData;
    sessions: Array<
      SessionData & {
        stats: SessionStatsData;
      }
    >;
    network: NetworkStateData;
  };
}

/** Route handler function type */
export type RouteHandler = (
  req: Request,
  params?: Record<string, string>,
) => Promise<ApiResponse>;
