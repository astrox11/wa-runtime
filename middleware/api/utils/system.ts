import config from "../../../config";
import { sessionManager } from "../../../core";
import type { ApiResponse } from "../../types";
import { runtimeStats } from "../classes";
import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "./constants";

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

export function getConfig(): ApiResponse {
  return {
    success: true,
    data: {
      version: config.VERSION,
      defaultBotName: config.BOT_NAME,
    },
  };
}

export function getNetworkState(): ApiResponse {
  return {
    success: true,
    data: sessionManager.getNetworkState(),
  };
}

export function getOverallStats(): ApiResponse {
  return { success: true, data: runtimeStats.getOverallStats() };
}
