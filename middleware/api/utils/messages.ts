import { getAllMessages, getMessagesCount } from "../../../core";
import type { ApiResponse } from "../../types";
import { validateSessionId } from "./vaildators";

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
