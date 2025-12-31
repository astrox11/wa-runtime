import { getAllGroups } from "../../../core";
import type { ApiResponse } from "../../types";
import { validateSessionId } from "./vaildators";

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
      error: ApiResponseErrors.GROUPS_REQUEST_ERROR,
    };
  }
}
