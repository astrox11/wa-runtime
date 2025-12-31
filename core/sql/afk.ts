import { bunql, execWithParams } from "./_sql";
import {
  createUserAfkTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate afk table for a session
 */
function getAfkTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAfkTable(phoneNumber);
  return getUserTableName(phoneNumber, "afk");
}

/**
 * Set AFK status
 */
export const setAfk = (
  sessionId: string,
  status: boolean,
  message?: string,
  time?: number,
) => {
  const tableName = getAfkTable(sessionId);
  const statusValue = status ? 1 : 0;
  const timeValue = status ? time || Date.now() : null;

  const rows = bunql.query<{ status: number; message: string; time: number }>(
    `SELECT status, message, time FROM "${tableName}" WHERE id = 1`,
  );
  const current = rows[0];

  if (current) {
    execWithParams(
      `UPDATE "${tableName}" SET status = ?, message = ?, time = ? WHERE id = 1`,
      [statusValue, message || null, timeValue],
    );
  } else {
    execWithParams(
      `INSERT INTO "${tableName}" (id, status, message, time) VALUES (1, ?, ?, ?)`,
      [statusValue, message || null, timeValue],
    );
  }

  return {
    session_id: sessionId,
    status: statusValue,
    message,
    time: timeValue,
  };
};

/**
 * Get AFK status
 */
export const getAfk = (sessionId: string) => {
  const tableName = getAfkTable(sessionId);
  const rows = bunql.query<{ status: number; message: string; time: number }>(
    `SELECT status, message, time FROM "${tableName}" WHERE id = 1`,
  );
  return rows[0] || null;
};
