/**
 * Service Layer
 *
 * Provides HTTP API and WebSocket request handling for the Whatsaly dashboard.
 * Uses core module directly for session management.
 */

// Re-export middleware functions for service access
export {
  runtimeStats,
  getSessions,
  getSession,
  createSession,
  deleteSession,
  pauseSession,
  resumeSession,
  getAuthStatus,
  getOverallStats,
  getSessionStats,
  getMessages,
  getConfig,
  getNetworkState,
  getGroups,
} from "./middleware";

// Export all types
export type {
  ApiResponse,
  SessionData,
  SessionCreateResult,
  AuthStatusData,
  SessionStatsData,
  OverallStatsData,
  MessagesData,
  ConfigData,
  GroupData,
  GroupsData,
  SessionCreateRequest,
  WsAction,
  WsRequest,
  WsResponse,
  WsResponsePayloads,
  MessageResult,
  NetworkStateData,
  StatsUpdate,
  RouteHandler,
} from "./types";

// Export service-specific errors
export { ApiResponseErrors, WsResponseErrors } from "./errors";

// Export predicates/validators
export {
  validateSessionId,
  validatePhoneNumber,
  validateNumericParam,
  validatePagination,
  isValidWsAction,
  validateWsRequest,
  parseWsRequest,
  requiresSessionId,
  requiresPhoneNumber,
  validateActionParams,
} from "./predicates";

// Export handler utilities
export {
  parseBody,
  createWsResponse,
  createWsErrorResponse,
  handleWsAction,
  handleRawWsMessage,
  matchRoute,
  createApiError,
  createApiSuccess,
} from "./handler";

// Export API handling
export { handleApiRequest } from "./api";
