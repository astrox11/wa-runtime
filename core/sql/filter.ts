import { bunql, execWithParams } from "./_sql";
import {
  createUserFilterTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

function getFilterTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserFilterTable(phoneNumber);
  return getUserTableName(phoneNumber, "filter");
}

export const setFilter = (
  sessionId: string,
  trigger: string,
  reply: string,
  status: number,
) => {
  const tableName = getFilterTable(sessionId);
  execWithParams(
    `INSERT OR REPLACE INTO "${tableName}" (trigger, reply, status) VALUES (?, ?, ?)`,
    [trigger, reply, status],
  );
  return { session_id: sessionId, trigger, reply, status };
};

export const getFilterByTrigger = (sessionId: string, trigger: string) => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ trigger: string; reply: string; status: number }>(
    `SELECT trigger, reply, status FROM "${tableName}" WHERE trigger = ?`,
    [trigger],
  );
  return rows[0] || null;
};

export const getAllFilters = (sessionId: string) => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ trigger: string; reply: string; status: number }>(
    `SELECT trigger, reply, status FROM "${tableName}"`,
  );
  return rows;
};

export const deleteFilter = (sessionId: string, trigger: string) => {
  const tableName = getFilterTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return { session_id: sessionId, trigger };
};

export const getFilterStatus = (sessionId: string) => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ status: number }>(
    `SELECT status FROM "${tableName}" LIMIT 1`,
  );
  return rows[0]?.status || 0;
};
