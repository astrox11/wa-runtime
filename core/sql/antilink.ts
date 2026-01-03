import { bunql, execWithParams } from "./_sql";
import {
  createUserAntilinkTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the antilink table name for a session
 */
function getAntilinkTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAntilinkTable(phoneNumber);
  return getUserTableName(phoneNumber, "antilink");
}

/**
 * Set antilink mode for a group
 * mode: 0 = off, 1 = delete only, 2 = delete + kick
 */
export const setAntilink = (
  sessionId: string,
  groupId: string,
  mode: number,
) => {
  const tableName = getAntilinkTable(sessionId);
  execWithParams(
    `INSERT OR REPLACE INTO "${tableName}" (groupId, mode) VALUES (?, ?)`,
    [groupId, mode],
  );
  return { session_id: sessionId, groupId, mode };
};

/**
 * Get antilink mode for a group
 * Returns mode (0, 1, or 2) or null if not set
 */
export const getAntilink = (sessionId: string, groupId: string) => {
  const tableName = getAntilinkTable(sessionId);
  const rows = bunql.query<{ groupId: string; mode: number }>(
    `SELECT groupId, mode FROM "${tableName}" WHERE groupId = ?`,
    [groupId],
  );
  return rows[0] || null;
};

/**
 * Get antilink mode value for a group (returns 0 if not set)
 */
export const getAntilinkMode = (sessionId: string, groupId: string): number => {
  const result = getAntilink(sessionId, groupId);
  return result?.mode ?? 0;
};

/**
 * Delete antilink setting for a group
 */
export const deleteAntilink = (sessionId: string, groupId: string) => {
  const tableName = getAntilinkTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE groupId = ?`, [groupId]);
  return { session_id: sessionId, groupId };
};

/**
 * Get all antilink settings for a session
 */
export const getAllAntilink = (sessionId: string) => {
  const tableName = getAntilinkTable(sessionId);
  const rows = bunql.query<{ groupId: string; mode: number }>(
    `SELECT groupId, mode FROM "${tableName}"`,
  );
  return rows;
};
