/**
 * Service layer middleware - API functions backed by core module
 * Provides all session management and data access functions for the service layer
 */

import {
  sessionManager,
  getAllMessages,
  getMessagesCount,
  getAllGroups,
} from "../core";
import config from "../config";
import type {
  ApiResponse,
  SessionData,
  SessionCreateResult,
  AuthStatusData,
  SessionStatsData,
  OverallStatsData,
  MessagesData,
  ConfigData,
  GroupsData,
  NetworkStateData,
} from "./types";

/**
 * Runtime stats tracking for sessions
 */
class RuntimeStats {
  private sessionStats = new Map<
    string,
    { messagesReceived: number; messagesSent: number; startTime: number }
  >();
  private startTime = Date.now();
  private totalMessagesReceived = 0;
  private totalMessagesSent = 0;

  initSession(sessionId: string): void {
    if (!this.sessionStats.has(sessionId)) {
      this.sessionStats.set(sessionId, {
        messagesReceived: 0,
        messagesSent: 0,
        startTime: Date.now(),
      });
    }
  }

  recordMessageReceived(sessionId: string): void {
    const stats = this.sessionStats.get(sessionId);
    if (stats) {
      stats.messagesReceived++;
      this.totalMessagesReceived++;
    }
  }

  recordMessageSent(sessionId: string): void {
    const stats = this.sessionStats.get(sessionId);
    if (stats) {
      stats.messagesSent++;
      this.totalMessagesSent++;
    }
  }

  getStats(sessionId: string): SessionStatsData {
    const stats = this.sessionStats.get(sessionId);
    if (!stats) {
      return { messagesReceived: 0, messagesSent: 0, uptime: 0 };
    }
    return {
      messagesReceived: stats.messagesReceived,
      messagesSent: stats.messagesSent,
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
    };
  }

  getOverallStats(): OverallStatsData {
    const sessions = sessionManager.listExtended();
    const activeSessions = sessions.filter(
      (s) => s.status === 2 || s.status === 7,
    ).length;

    const memUsage = process.memoryUsage();

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalMessagesReceived: this.totalMessagesReceived,
      totalMessagesSent: this.totalMessagesSent,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
      },
    };
  }

  removeSession(sessionId: string): void {
    this.sessionStats.delete(sessionId);
  }
}

export const runtimeStats = new RuntimeStats();

/**
 * Get all sessions
 */
export function getSessions(): ApiResponse<SessionData[]> {
  const sessions = sessionManager.listExtended();
  return {
    success: true,
    data: sessions.map((s) => ({
      id: s.id,
      phone_number: s.phone_number,
      status: s.status,
      user_info: s.user_info ?? null,
      created_at: s.created_at,
    })),
  };
}

/**
 * Get a specific session by ID or phone number
 */
export function getSession(
  idOrPhone: string | undefined,
): ApiResponse<SessionData> {
  if (!idOrPhone) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(idOrPhone);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  return {
    success: true,
    data: {
      id: session.id,
      phone_number: session.phone_number,
      status: session.status,
      user_info: session.user_info ?? null,
      created_at: session.created_at,
    },
  };
}

/**
 * Create a new session
 */
export async function createSession(
  phoneNumber: string,
): Promise<ApiResponse<SessionCreateResult>> {
  const result = await sessionManager.create(phoneNumber);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  runtimeStats.initSession(result.id!);

  return {
    success: true,
    data: {
      id: result.id!,
      code: result.code,
    },
  };
}

/**
 * Delete a session
 */
export async function deleteSession(
  idOrPhone: string,
): Promise<ApiResponse<{ message: string }>> {
  const result = await sessionManager.delete(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  runtimeStats.removeSession(idOrPhone);

  return {
    success: true,
    data: { message: "Session deleted successfully" },
  };
}

/**
 * Pause a session
 */
export async function pauseSession(
  idOrPhone: string,
): Promise<ApiResponse<{ message: string }>> {
  const result = await sessionManager.pause(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session paused successfully" },
  };
}

/**
 * Resume a paused session
 */
export async function resumeSession(
  idOrPhone: string,
): Promise<ApiResponse<{ message: string }>> {
  const result = await sessionManager.resume(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session resumed successfully" },
  };
}

/**
 * Get auth status for a session
 */
export function getAuthStatus(
  sessionId: string | undefined,
): ApiResponse<AuthStatusData> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  // Status 2 = Connected, 7 = Active (authenticated)
  const isAuthenticated = session.status === 2 || session.status === 7;

  return {
    success: true,
    data: {
      isAuthenticated,
    },
  };
}

/**
 * Get overall runtime stats
 */
export function getOverallStats(): ApiResponse<OverallStatsData> {
  return {
    success: true,
    data: runtimeStats.getOverallStats(),
  };
}

/**
 * Get stats for a specific session
 */
export function getSessionStats(
  sessionId: string,
): ApiResponse<SessionStatsData> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  return {
    success: true,
    data: runtimeStats.getStats(sessionId),
  };
}

/**
 * Get messages for a session
 */
export function getMessages(
  sessionId: string,
  limit: number = 100,
  offset: number = 0,
): ApiResponse<MessagesData> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const messages = getAllMessages(sessionId, limit, offset);
    const total = getMessagesCount(sessionId);

    return {
      success: true,
      data: {
        messages,
        total,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get messages",
    };
  }
}

/**
 * Get configuration
 */
export function getConfig(): ApiResponse<ConfigData> {
  return {
    success: true,
    data: {
      version: config.VERSION,
      botName: config.BOT_NAME,
      debug: config.DEBUG,
    },
  };
}

/**
 * Get network state
 */
export function getNetworkState(): ApiResponse<NetworkStateData> {
  const networkState = sessionManager.getNetworkState();
  return {
    success: true,
    data: networkState,
  };
}

/**
 * Get groups for a session
 */
export function getGroups(sessionId: string): ApiResponse<GroupsData> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const groups = getAllGroups(sessionId);

    return {
      success: true,
      data: {
        groups,
        total: groups.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get groups",
    };
  }
}
