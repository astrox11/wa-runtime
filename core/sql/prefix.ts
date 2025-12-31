import { bunql, execWithParams } from "./_sql";
import {
  createUserPrefixTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate prefix table for a session
 */
function getPrefixTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserPrefixTable(phoneNumber);
  return getUserTableName(phoneNumber, "prefix");
}

export const set_prefix = (session_id: string, prefix?: string) => {
  const tableName = getPrefixTable(session_id);
  bunql.exec(`DELETE FROM "${tableName}" WHERE id = 1`);

  execWithParams(`INSERT INTO "${tableName}" (id, prefix) VALUES (1, ?)`, [
    prefix || null,
  ]);
};

export const get_prefix = (session_id: string) => {
  const tableName = getPrefixTable(session_id);
  const rows = bunql.query<{ prefix: string | null }>(
    `SELECT prefix FROM "${tableName}" WHERE id = 1`,
  );
  const row = rows[0];

  return row ? row.prefix?.split("") : null;
};

export const del_prefix = (session_id: string) => {
  const tableName = getPrefixTable(session_id);
  bunql.exec(`DELETE FROM "${tableName}" WHERE id = 1`);
};
