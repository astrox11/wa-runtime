import { bunql, execWithParams } from "./_sql";
import {
  createUserGroupEventTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate group_event table for a session
 */
function getGroupEventTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserGroupEventTable(phoneNumber);
  return getUserTableName(phoneNumber, "group_event");
}

/**
 * Set group event status
 */
export const setGroupEventStatus = (sessionId: string, status: boolean) => {
  const tableName = getGroupEventTable(sessionId);
  const statusValue = status ? 1 : 0;
  const rows = bunql.query<{ status: number }>(
    `SELECT status FROM "${tableName}" WHERE id = 1`,
  );
  const current = rows[0];

  if (current) {
    execWithParams(`UPDATE "${tableName}" SET status = ? WHERE id = 1`, [
      statusValue,
    ]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (id, status) VALUES (1, ?)`, [
      statusValue,
    ]);
  }

  return { session_id: sessionId, status: statusValue };
};

/**
 * Get group event status
 */
export const getGroupEventStatus = (sessionId: string) => {
  const tableName = getGroupEventTable(sessionId);
  const rows = bunql.query<{ status: number }>(
    `SELECT status FROM "${tableName}" WHERE id = 1`,
  );
  return rows[0]?.status || 0;
};
