import { log, sessionManager } from "../../../core";
import type { ApiResponse } from "../../types";
import { runtimeStats } from "../classes";
import { formatPairingCode } from "./system";
import {
  validatePhoneNumber,
  validateSessionExists,
  validateSessionId,
} from "./vaildators";

export function getSessions(): ApiResponse {
  log.debug("Getting all sessions");
  return { success: true, data: sessionManager.listExtended() };
}

export function getSession(sessionId: string): ApiResponse {
  const validationError = validateSessionId(sessionId);
  if (validationError) return validationError;

  log.debug("Getting session:", sessionId);
  const result = validateSessionExists(sessionId);
  if ("success" in result) return result;

  return { success: true, data: result.session };
}

export async function createSession(phoneNumber: string): Promise<ApiResponse> {
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

export function getSessionStats(sessionId: string): ApiResponse {
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
