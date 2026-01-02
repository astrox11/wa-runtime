import {
  sessionManager,
  getAllMessages,
  getMessagesCount,
  getAllGroups,
  StatusType,
  getActivitySettings as getActivitySettingsFromDb,
  setActivitySettings as setActivitySettingsInDb,
} from "../core";
import config from "../config";
import type { SessionStatsData, OverallStatsData, ActivitySettingsData, HourlyActivityData } from "./types";

class RuntimeStats {
  getStats(sessionId: string): SessionStatsData {
    const stats = getAllMessages(sessionId, null, null);

    const m = stats.map((m) => m.message);

    const messagesReceived = m.filter((m) => m.key.fromMe === false).length;
    const messagesSent = m.filter((m) => m.key.fromMe === true).length;

    return {
      messagesReceived,
      messagesSent,
    };
  }

  getHourlyActivity(sessionId: string): HourlyActivityData {
    const messages = getAllMessages(sessionId, null, null);
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Initialize array with 24 zeros (one for each hour)
    const hourlyData: number[] = new Array(24).fill(0);

    for (const { message } of messages) {
      // messageTimestamp can be a number (seconds) or Long object
      let timestamp: number;
      const ts = message.messageTimestamp;
      if (typeof ts === "number") {
        timestamp = ts * 1000; // Convert seconds to milliseconds
      } else if (ts && typeof ts === "object" && "low" in ts) {
        // Handle Long object from protobuf
        timestamp = (ts as { low: number }).low * 1000;
      } else {
        continue;
      }

      // Only include messages from the last 24 hours
      if (timestamp >= twentyFourHoursAgo && timestamp <= now) {
        // Calculate which hour bucket this message belongs to (0 = current hour, 23 = 23 hours ago)
        const hoursAgo = Math.floor((now - timestamp) / (60 * 60 * 1000));
        if (hoursAgo >= 0 && hoursAgo < 24) {
          // Index 0 is the oldest hour (23 hours ago), index 23 is the current hour
          const index = 23 - hoursAgo;
          hourlyData[index]++;
        }
      }
    }

    // Calculate peak and average
    const maxCount = Math.max(...hourlyData);
    const peakHourIndex = hourlyData.indexOf(maxCount);
    const total = hourlyData.reduce((sum, count) => sum + count, 0);
    const average = total / 24;

    // Format peak hour as time string (e.g., "2pm", "10am")
    const currentHour = new Date().getHours();
    const peakHour = (currentHour - (23 - peakHourIndex) + 24) % 24;
    const peakHourFormatted = formatHour(peakHour);

    return {
      hourlyData,
      peakHour: peakHourFormatted,
      average: Math.round(average * 10) / 10,
    };
  }

  getOverallStats(): OverallStatsData {
    const sessions = sessionManager.listExtended();
    const activeSessions = sessions.filter(
      (s) =>
        s.status === StatusType.Connected || s.status === StatusType.Active,
    ).length;
    const totalMessages = sessions.reduce((acc, session) => {
      const count = getMessagesCount(session.id);
      return acc + count;
    }, 0);

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalMessages,
      version: config.VERSION,
    };
  }
}

export const runtimeStats = new RuntimeStats();

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "am" : "pm";
  return `${h}${ampm}`;
}

function getStatusString(status: number): string {
  switch (status) {
    case StatusType.Connected:
    case StatusType.Active:
      return "active";
    case StatusType.Pairing:
      return "pairing";
    case StatusType.PausedUser:
      return "paused_user";
    case StatusType.Disconnected:
    case StatusType.Inactive:
      return "inactive";
    default:
      return "inactive";
  }
}

export function getSessions() {
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

export function getSession(idOrPhone: string | undefined) {
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

export async function createSession(phoneNumber: string) {
  const result = await sessionManager.create(phoneNumber);

  if (!result.success || !result.id) {
    return {
      success: false,
      error: result.error || "Failed to create session",
    };
  }

  return {
    success: true,
    data: {
      id: result.id,
      code: result.code,
    },
  };
}

export async function deleteSession(idOrPhone: string) {
  const result = await sessionManager.delete(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session deleted successfully" },
  };
}

export async function pauseSession(idOrPhone: string) {
  const result = await sessionManager.pause(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session paused successfully" },
  };
}

export async function resumeSession(idOrPhone: string) {
  const result = await sessionManager.resume(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session resumed successfully" },
  };
}

export function getAuthStatus(sessionId: string | undefined) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const isAuthenticated =
    session.status === StatusType.Connected ||
    session.status === StatusType.Active;

  return {
    success: true,
    data: {
      isAuthenticated,
      status: getStatusString(session.status),
      phoneNumber: session.phone_number,
    },
  };
}

export function getOverallStats() {
  return {
    success: true,
    data: runtimeStats.getOverallStats(),
  };
}

export function getFullStats() {
  const overallStats = runtimeStats.getOverallStats();
  const sessions = sessionManager.listExtended();

  return {
    success: true,
    data: {
      overall: overallStats,
      sessions: sessions.map((s) => ({
        id: s.id,
        phone_number: s.phone_number,
        status: getStatusString(s.status),
        user_info: s.user_info ?? null,
        created_at: s.created_at,
        pushName: s.user_info?.name,
        stats: runtimeStats.getStats(s.id),
        hourlyActivity: runtimeStats.getHourlyActivity(s.id),
      })),
    },
  };
}

export function getSessionStats(sessionId: string) {
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

export function getMessages(
  sessionId: string,
  limit: number = 100,
  offset: number = 0,
) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const messages = getAllMessages(sessionId, limit, offset);
  const total = getMessagesCount(sessionId);

  return {
    success: true,
    data: {
      messages,
      total,
    },
  };
}

export function getConfig() {
  return {
    success: true,
    data: {
      version: config.VERSION,
      botName: config.BOT_NAME,
    },
  };
}

export function getGroups(sessionId: string) {
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

export function getActivitySettings(sessionId: string) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const settings = getActivitySettingsFromDb(sessionId);
    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get activity settings",
    };
  }
}

export function updateActivitySettings(
  sessionId: string,
  settings: Partial<ActivitySettingsData>,
) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const updatedSettings = setActivitySettingsInDb(sessionId, settings);
    return {
      success: true,
      data: updatedSettings,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update activity settings",
    };
  }
}
