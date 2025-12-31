import { bunql, execWithParams } from "./_sql";
import {
  createUserMentionTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate mention table for a session
 */
function getMentionTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserMentionTable(phoneNumber);
  return getUserTableName(phoneNumber, "mention");
}

/**
 * Set mention message for a group
 */
export const setMentionMessage = (
  sessionId: string,
  groupId: string,
  content: { message?: string; type: string; data?: any },
) => {
  const tableName = getMentionTable(sessionId);
  const dataStr = content.data ? JSON.stringify(content.data) : null;

  execWithParams(
    `INSERT INTO "${tableName}" (groupId, message, type, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(groupId) DO UPDATE SET
      message = excluded.message, type = excluded.type, data = excluded.data`,
    [groupId, content.message || null, content.type, dataStr],
  );
  return { session_id: sessionId, groupId };
};
/**
 * Get mention message for a group
 */
export const getMentionMessage = (sessionId: string, groupId: string) => {
  const tableName = getMentionTable(sessionId);
  const rows = bunql.query<{ message: string }>(
    `SELECT message FROM "${tableName}" WHERE groupId = ?`,
    [groupId],
  );
  return rows[0]?.message || null;
};

/**
 * Delete mention message for a group
 */
export const deleteMentionMessage = (sessionId: string, groupId: string) => {
  const tableName = getMentionTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE groupId = ?`, [groupId]);
  return { session_id: sessionId, groupId };
};

export const getMentionData = (sessionId: string, groupId: string) => {
  const tableName = getMentionTable(sessionId);
  const rows = bunql.query<{ message: string; type: string; data: string }>(
    `SELECT * FROM "${tableName}" WHERE groupId = ?`,
    [groupId],
  );
  const res = rows[0];
  if (!res) return null;
  return { ...res, data: res.data ? JSON.parse(res.data) : null };
};
