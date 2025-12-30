import { bunql, execWithParams } from "./_sql";
import {
  createUserBgmTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate bgm table for a session
 */
function getBgmTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserBgmTable(phoneNumber);
  return getUserTableName(phoneNumber, "bgm");
}

/**
 * Save a BGM entry
 */
export const saveBgm = (
  sessionId: string,
  trigger: string,
  audioData: string,
) => {
  const tableName = getBgmTable(sessionId);
  const rows = bunql.query<{ audioData: string }>(
    `SELECT audioData FROM "${tableName}" WHERE trigger = ?`,
    [trigger],
  );
  const current = rows[0];

  if (current) {
    execWithParams(`UPDATE "${tableName}" SET audioData = ? WHERE trigger = ?`, [
      audioData,
      trigger,
    ]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (trigger, audioData) VALUES (?, ?)`, [
      trigger,
      audioData,
    ]);
  }

  return { session_id: sessionId, trigger, audioData };
};

/**
 * Get a BGM by trigger
 */
export const getBgmByTrigger = (sessionId: string, trigger: string) => {
  const tableName = getBgmTable(sessionId);
  const rows = bunql.query<{ trigger: string; audioData: string }>(
    `SELECT trigger, audioData FROM "${tableName}" WHERE trigger = ?`,
    [trigger],
  );
  return rows[0] || null;
};

/**
 * Get all BGMs
 */
export const getAllBgms = (sessionId: string) => {
  const tableName = getBgmTable(sessionId);
  const rows = bunql.query<{ trigger: string; audioData: string }>(
    `SELECT trigger, audioData FROM "${tableName}"`,
  );
  return rows;
};

/**
 * Delete a BGM by trigger
 */
export const deleteBgm = (sessionId: string, trigger: string) => {
  const tableName = getBgmTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return { session_id: sessionId, trigger };
};
