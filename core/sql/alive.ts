import { bunql, execWithParams } from "./_sql";
import {
  createUserAliveTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate alive table for a session
 */
function getAliveTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAliveTable(phoneNumber);
  return getUserTableName(phoneNumber, "alive");
}

/**
 * Set alive message
 */
export const setAliveMessage = (sessionId: string, message: string) => {
  const tableName = getAliveTable(sessionId);
  const rows = bunql.query<{ alive_message: string }>(
    `SELECT alive_message FROM "${tableName}" WHERE id = 1`,
  );
  const current = rows[0];

  if (current) {
    execWithParams(`UPDATE "${tableName}" SET alive_message = ? WHERE id = 1`, [
      message,
    ]);
  } else {
    execWithParams(
      `INSERT INTO "${tableName}" (id, alive_message) VALUES (1, ?)`,
      [message],
    );
  }

  return { session_id: sessionId, alive_message: message };
};

/**
 * Get alive message
 */
export const getAliveMessage = (sessionId: string) => {
  const tableName = getAliveTable(sessionId);
  const rows = bunql.query<{ alive_message: string }>(
    `SELECT alive_message FROM "${tableName}" WHERE id = 1`,
  );
  return rows[0]?.alive_message || null;
};
