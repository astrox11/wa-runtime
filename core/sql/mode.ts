import { bunql, execWithParams } from "./_sql";
import {
  createUserModeTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate mode table for a session
 */
function getModeTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserModeTable(phoneNumber);
  return getUserTableName(phoneNumber, "mode");
}

type Mode = "private" | "public";

export const setMode = (sessionId: string, type: Mode): boolean | null => {
  const tableName = getModeTable(sessionId);
  const rows = bunql.query<{ mode: string }>(
    `SELECT mode FROM "${tableName}" WHERE id = 1`,
  );
  const row = rows[0];

  if (row?.mode === type) return null;

  if (row) {
    execWithParams(`UPDATE "${tableName}" SET mode = ? WHERE id = 1`, [type]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (id, mode) VALUES (1, ?)`, [
      type,
    ]);
  }

  return true;
};

export const getMode = (sessionId: string): Mode => {
  const tableName = getModeTable(sessionId);
  const rows = bunql.query<{ mode: string }>(
    `SELECT mode FROM "${tableName}" WHERE id = 1`,
  );
  const row = rows[0];
  return (row?.mode as Mode) ?? "private";
};
