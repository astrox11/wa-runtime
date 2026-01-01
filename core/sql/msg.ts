import { proto, type WAMessageKey } from "baileys";
import { bunql, execWithParams } from "./_sql";
import type { WAMessage } from "baileys";
import {
  createUserMessagesTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

function getMessagesTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserMessagesTable(phoneNumber);
  return getUserTableName(phoneNumber, "messages");
}

export const getMessage = async (sessionId: string, key: WAMessageKey) => {
  const id = key?.id;
  if (id) {
    const tableName = getMessagesTable(sessionId);
    const result = bunql.query<{ msg: string }>(
      `SELECT msg FROM "${tableName}" WHERE id = ?`,
      [id],
    );
    const row = result[0];
    return row ? proto.Message.fromObject(JSON.parse(row.msg)) : undefined;
  }
  return undefined;
};

export const saveMessage = (
  sessionId: string,
  key: WAMessageKey,
  msg: WAMessage,
) => {
  const id = key?.id;
  if (id) {
    const tableName = getMessagesTable(sessionId);
    const msgData = JSON.stringify(msg || {});

    const existing = bunql.query<{ id: string }>(
      `SELECT id FROM "${tableName}" WHERE id = ?`,
      [id],
    );

    if (existing.length > 0) {
      execWithParams(`UPDATE "${tableName}" SET msg = ? WHERE id = ?`, [
        msgData,
        id,
      ]);
    } else {
      execWithParams(`INSERT INTO "${tableName}" (id, msg) VALUES (?, ?)`, [
        id,
        msgData,
      ]);
    }
  }
};

export const getAllMessages = (
  sessionId: string,
  limit: number | null = 100,
  offset: number | null = 0,
): Array<{ id: string; message: WAMessage }> => {
  const tableName = getMessagesTable(sessionId);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const results = bunql.query<{ id: string; msg: string }>(
    `SELECT id, msg FROM "${tableName}" ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset],
  );

  return results.map((row) => ({
    id: row.id,
    message: JSON.parse(row.msg || "{}") as WAMessage,
  }));
};

export const getMessagesCount = (sessionId: string): number => {
  const tableName = getMessagesTable(sessionId);
  const result = bunql.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM "${tableName}"`,
    [],
  );
  return result[0]?.count || 0;
};
