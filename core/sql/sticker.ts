import { bunql, execWithParams } from "./_sql";
import {
  createUserStickerTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate sticker table for a session
 */
function getStickerTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserStickerTable(phoneNumber);
  return getUserTableName(phoneNumber, "sticker");
}

/**
 * Save a sticker
 */
export const saveSticker = (
  sessionId: string,
  name: string,
  sha256: string,
) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ sha256: string }>(
    `SELECT sha256 FROM "${tableName}" WHERE name = ?`,
    [name],
  );
  const current = rows[0];

  if (current) {
    execWithParams(`UPDATE "${tableName}" SET sha256 = ? WHERE name = ?`, [
      sha256,
      name,
    ]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (name, sha256) VALUES (?, ?)`, [
      name,
      sha256,
    ]);
  }

  return { session_id: sessionId, name, sha256 };
};

/**
 * Get a sticker by name
 */
export const getStickerByName = (sessionId: string, name: string) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ name: string; sha256: string }>(
    `SELECT name, sha256 FROM "${tableName}" WHERE name = ?`,
    [name],
  );
  return rows[0] || null;
};

/**
 * Get all stickers
 */
export const getAllStickers = (sessionId: string) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ name: string; sha256: string }>(
    `SELECT name, sha256 FROM "${tableName}"`,
  );
  return rows;
};

/**
 * Delete a sticker by name
 */
export const deleteSticker = (sessionId: string, name: string) => {
  const tableName = getStickerTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE name = ?`, [name]);
  return { session_id: sessionId, name };
};
