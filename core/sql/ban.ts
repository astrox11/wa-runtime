import { bunql, execWithParams } from "./_sql";
import {
  createUserBanTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate ban table for a session
 */
function getBanTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserBanTable(phoneNumber);
  return getUserTableName(phoneNumber, "ban");
}

export const isBan = (sessionId: string, id: string) => {
  const tableName = getBanTable(sessionId);
  const users = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`,
    [id, id],
  );
  return [...users.map((u) => u.pn), ...users.map((u) => u.lid)].includes(id);
};

export const addBan = (sessionId: string, pn: string, lid: string) => {
  const tableName = getBanTable(sessionId);
  const existing = bunql.query<{ pn: string; lid: string }>(
    `SELECT * FROM "${tableName}" WHERE pn = ?`,
    [pn],
  );
  if (existing.length > 0) {
    return existing[0];
  }
  execWithParams(`INSERT INTO "${tableName}" (pn, lid) VALUES (?, ?)`, [
    pn,
    lid,
  ]);
  return { pn, lid };
};

export const removeBan = (sessionId: string, id: string) => {
  const tableName = getBanTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE pn = ? OR lid = ?`, [
    id,
    id,
  ]);
};
