/**
 * Service layer error definitions
 * Defines all error constants for API and WebSocket responses
 */

/**
 * API Response Errors - used for HTTP API responses
 */
export enum ApiResponseErrors {
  INVALID_SESSION = "invalid_session_id",
  INVALID_PHONE_NUMBER = "invalid_phone_number",
  INVALID_PARAMETERS = "invalid_parameters",
  SESSION_NOT_FOUND = "session_not_found",
  ROUTE_NOT_FOUND = "route_not_found",
  INTERNAL_ERROR = "internal_error",
}

/**
 * WebSocket Response Errors - service-specific for WebSocket action responses
 */
export enum WsResponseErrors {
  UNKNOWN_ACTION = "unknown_action",
  INVALID_REQUEST = "invalid_request",
  MISSING_PARAMS = "missing_required_params",
  SESSION_NOT_FOUND = "session_not_found",
  ACTION_FAILED = "action_failed",
  CONNECTION_ERROR = "connection_error",
}
