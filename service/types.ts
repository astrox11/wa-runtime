import type { SessionStats } from "./src/lib/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionData {
  id: string;
  phone_number: string;
  created_at: number;
  status: "active" | "inactive" | "pairing" | "paused_user" | "connecting";
  user_info?: {
    id: string;
    lid: string;
    name: string;
  };
  stats: SessionStats;
}

export interface SessionCreateResult {
  id: string;
  code?: string;
}

export interface AuthStatusData {
  isAuthenticated: boolean;
  status: string;
  phoneNumber: string;
}

export interface SessionStatsData {
  messagesReceived: number;
  messagesSent: number;
}

export interface HourlyActivityData {
  hourlyData: number[];
  peakHour: string;
  average: number;
}

export interface OverallStatsData {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  version: string;
}

export interface MessagesData {
  messages: Array<{
    id: string;
    message: Record<string, unknown>;
  }>;
  total: number;
}

export interface ConfigData {
  version: string;
  botName: string;
}

export interface GroupData {
  id: string;
  subject: string;
  participantCount: number;
}

export interface GroupsData {
  groups: GroupData[];
  total: number;
}

export interface SessionCreateRequest {
  phoneNumber: string;
}

export interface ActivitySettingsData {
  auto_read_messages: boolean;
  auto_recover_deleted_messages: boolean;
  auto_antispam: boolean;
  auto_typing: boolean;
  auto_recording: boolean;
  auto_reject_calls: boolean;
  auto_always_online: boolean;
}

export interface UpdateActivitySettingsRequest {
  sessionId: string;
  settings: Partial<ActivitySettingsData>;
}

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
  params?: Record<string, string | number | boolean | undefined>;
}

export interface WsResponse {
  action: WsAction;
  requestId?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

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
  getGroups: GroupsData;
  pauseSession: MessageResult;
  resumeSession: MessageResult;
  getActivitySettings: ActivitySettingsData;
  updateActivitySettings: ActivitySettingsData;
}

export interface MessageResult {
  message: string;
}

export interface StatsUpdate {
  type: "stats";
  data: {
    overall: OverallStatsData;
    sessions: Array<SessionData & { stats: SessionStatsData; hourlyActivity: HourlyActivityData }>;
  };
}

export type RouteHandler = (
  req: Request,
  params?: Record<string, string>,
) => Promise<ApiResponse>;
