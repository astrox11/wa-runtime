import config from "../../../config";
import { getMessagesCount, sessionManager } from "../../../core";
import { formatUptime } from "../utils";
import type { OverallStatsData } from "../../types";

export class RuntimeStats {
  private messageCount: Map<string, number> = new Map();
  private sessionStartTimes: Map<string, number> = new Map();
  private hourlyActivity: Map<string, number[]> = new Map();

  recordMessage(sessionId: string) {
    const current = this.messageCount.get(sessionId) || 0;
    this.messageCount.set(sessionId, current + 1);

    const hour = new Date().getHours();
    const hourlyKey = `${sessionId}_${new Date().toDateString()}`;
    let hourly = this.hourlyActivity.get(hourlyKey);
    if (!hourly) {
      hourly = new Array(24).fill(0);
      this.hourlyActivity.set(hourlyKey, hourly);
    }
    hourly[hour]++;
  }

  recordSessionStart(sessionId: string) {
    this.sessionStartTimes.set(sessionId, Date.now());
  }

  getStats(sessionId: string) {
    const messages = getMessagesCount(sessionId);
    let startTime = this.sessionStartTimes.get(sessionId);

    if (!startTime) {
      const session = sessionManager.get(sessionId);
      startTime = session?.created_at || Date.now();
      this.sessionStartTimes.set(sessionId, startTime);
    }

    const uptime = Date.now() - startTime;

    const hourlyKey = `${sessionId}_${new Date().toDateString()}`;
    const hourlyData =
      this.hourlyActivity.get(hourlyKey) || new Array(24).fill(0);

    return {
      messages,
      uptime,
      uptimeFormatted: formatUptime(uptime),
      hourlyActivity: hourlyData,
      avgMessagesPerHour: messages / Math.max(1, Math.ceil(uptime / 3600000)),
    };
  }

  getOverallStats(): OverallStatsData {
    const sessions = sessionManager.list();
    let totalMessages = 0;
    if (sessions.length > 0) {
      for (const session of sessions) {
        totalMessages += getMessagesCount(session.id);
      }
    }
    return {
      totalSessions: sessions.length,
      activeSessions: sessionManager.getActiveCount(),
      totalMessages,
      version: config.VERSION,
      serverUptime: process.uptime(),
      serverUptimeFormatted: formatUptime(process.uptime() * 1000),
    };
  }
}

export const runtimeStats = new RuntimeStats();
