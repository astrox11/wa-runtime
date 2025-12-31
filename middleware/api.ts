/**
 * API Middleware Layer
 *
 * This module encapsulates all business logic for the API layer including:
 * - Data fetching from session manager and database
 * - Validation of inputs
 * - Transformation of data
 * - Error handling
 * - Runtime statistics tracking
 *
 * The service layer should only aggregate and compose data from these functions.
 */

import {
  sessionManager,
  log,
  getAllMessages,
  getMessagesCount,
  getAllGroups,
} from "../lib";
import config from "../config";

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionData {
  id: string;
  phoneNumber: string;
  status: string;
  createdAt?: number;
  pushName?: string;
}

export interface SessionCreateResult {
  id: string;
  pairingCode: string | null;
  pairingCodeFormatted: string | null;
}

export interface AuthStatusData {
  sessionId: string;
  phoneNumber: string;
  status: string;
  isAuthenticated: boolean;
  isPairing: boolean;
}

export interface SessionStatsData {
  session: SessionData;
  messages: number;
  uptime: number;
  uptimeFormatted: string;
  hourlyActivity: number[];
  avgMessagesPerHour: number;
}

export interface OverallStatsData {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  version: string;
  serverUptime: number;
  serverUptimeFormatted: string;
}

export interface MessagesData {
  messages: Array<{ id: string; message: unknown }>;
  total: number;
  limit: number;
  offset: number;
}

export interface ConfigData {
  version: string;
  defaultBotName: string;
}

export interface GroupData {
  id: string;
  subject: string;
  participantCount: number;
}

export interface GroupsData {
  groups: GroupData[];
  count: number;
}

// ============================================================================
// Constants
// ============================================================================

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format uptime in milliseconds to a human-readable string
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const days = Math.floor(hours / HOURS_PER_DAY);

  if (days > 0) {
    return `${days}d ${hours % HOURS_PER_DAY}h ${minutes % MINUTES_PER_HOUR}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % MINUTES_PER_HOUR}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
  }
  return `${seconds}s`;
}

/**
 * Format pairing code with hyphen
 */
export function formatPairingCode(code: string | undefined): string | null {
  if (!code) return null;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// ============================================================================
// Runtime Statistics
// ============================================================================

/**
 * Runtime statistics tracker for session activity
 */
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
    // Sum messages across all sessions, or return 0 if no sessions exist
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

// Singleton instance
export const runtimeStats = new RuntimeStats();

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that a session ID is provided
 */
export function validateSessionId(
  sessionId: string | undefined,
): ApiResponse | null {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }
  return null;
}

/**
 * Validate that a phone number is provided
 */
export function validatePhoneNumber(
  phoneNumber: string | undefined,
): ApiResponse | null {
  if (!phoneNumber) {
    return { success: false, error: "Phone number is required" };
  }
  return null;
}

/**
 * Validate that a session exists
 */
export function validateSessionExists(
  sessionId: string,
): { success: false; error: string } | { session: NonNullable<ReturnType<typeof sessionManager.get>> } {
  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }
  return { session };
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Get all sessions with extended information
 */
export function getSessions(): ApiResponse {
  log.debug("Getting all sessions");
  return { success: true, data: sessionManager.listExtended() };
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId: string): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Getting session:", sessionId);
  const result = validateSessionExists(sessionId);
  if ("success" in result) return result;

  return { success: true, data: result.session };
}

/**
 * Create a new session
 */
export async function createSession(
  phoneNumber: string,
): Promise<ApiResponse> {
  const validationError = validatePhoneNumber(phoneNumber);
  if (validationError) return validationError;

  log.debug("Creating session for:", phoneNumber);
  const createResult = await sessionManager.create(phoneNumber);

  if (createResult.success) {
    runtimeStats.recordSessionStart(createResult.id!);
    log.info("Session created:", createResult.id);
    return {
      success: true,
      data: {
        id: createResult.id!,
        pairingCode: createResult.code || null,
        pairingCodeFormatted: formatPairingCode(createResult.code),
      },
    };
  }

  log.error("Failed to create session:", createResult.error);
  return { success: false, error: createResult.error };
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<ApiResponse> {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Deleting session:", sessionId);
  const deleteResult = await sessionManager.delete(sessionId);

  if (deleteResult.success) {
    log.info("Session deleted:", sessionId);
    return { success: true, data: { message: "Session deleted" } };
  }

  log.error("Failed to delete session:", deleteResult.error);
  return { success: false, error: deleteResult.error };
}

/**
 * Pause a session by ID
 */
export async function pauseSession(sessionId: string): Promise<ApiResponse> {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Pausing session:", sessionId);
  const pauseResult = await sessionManager.pause(sessionId);

  if (pauseResult.success) {
    log.info("Session paused:", sessionId);
    return { success: true, data: { message: "Session paused" } };
  }

  log.error("Failed to pause session:", pauseResult.error);
  return { success: false, error: pauseResult.error };
}

/**
 * Resume a session by ID
 */
export async function resumeSession(sessionId: string): Promise<ApiResponse> {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Resuming session:", sessionId);
  const resumeResult = await sessionManager.resume(sessionId);

  if (resumeResult.success) {
    log.info("Session resumed:", sessionId);
    return { success: true, data: { message: "Session resumed" } };
  }

  log.error("Failed to resume session:", resumeResult.error);
  return { success: false, error: resumeResult.error };
}

// ============================================================================
// Authentication Operations
// ============================================================================

/**
 * Get authentication status for a session
 */
export function getAuthStatus(sessionId: string): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Getting auth status for:", sessionId);
  const result = validateSessionExists(sessionId);
  if ("success" in result) return result;

  const session = result.session;
  return {
    success: true,
    data: {
      sessionId: session.id,
      phoneNumber: session.phone_number,
      status: session.status,
      isAuthenticated: session.status === "active",
      isPairing: session.status === "pairing",
    },
  };
}

// ============================================================================
// Statistics Operations
// ============================================================================

/**
 * Get overall statistics
 */
export function getOverallStats(): ApiResponse {
  return { success: true, data: runtimeStats.getOverallStats() };
}

/**
 * Get statistics for a specific session
 */
export function getSessionStats(
  sessionId: string,
): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  const result = validateSessionExists(sessionId);
  if ("success" in result) return result;

  const session = result.session;
  const stats = runtimeStats.getStats(sessionId);

  return {
    success: true,
    data: {
      session: {
        id: session.id,
        phoneNumber: session.phone_number,
        status: session.status,
        createdAt: session.created_at,
        pushName: session.push_name,
      },
      ...stats,
    },
  };
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Get messages for a session with pagination
 */
export function getMessages(
  sessionId: string,
  limit: number = 100,
  offset: number = 0,
): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  const messages = getAllMessages(sessionId, limit, offset);
  const total = getMessagesCount(sessionId);

  return {
    success: true,
    data: {
      messages,
      total,
      limit,
      offset,
    },
  };
}

// ============================================================================
// Configuration Operations
// ============================================================================

/**
 * Get application configuration
 */
export function getConfig(): ApiResponse {
  return {
    success: true,
    data: {
      version: config.VERSION,
      defaultBotName: config.BOT_NAME,
    },
  };
}

// ============================================================================
// Network Operations
// ============================================================================

/**
 * Get network state
 */
export function getNetworkState(): ApiResponse {
  return {
    success: true,
    data: sessionManager.getNetworkState(),
  };
}

// ============================================================================
// Group Operations
// ============================================================================

/**
 * Get all groups for a session
 */
export function getGroups(sessionId: string): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  try {
    const groups = getAllGroups(sessionId);
    return {
      success: true,
      data: { groups, count: groups.length },
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to retrieve groups",
    };
  }
}
