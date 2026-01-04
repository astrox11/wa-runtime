import type { GroupParticipant } from "baileys";
import { bunql, execWithParams } from "./_sql";
import {
  createUserContactsTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate contacts table for a session
 */
function getContactsTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserContactsTable(phoneNumber);
  return getUserTableName(phoneNumber, "contacts");
}

/**
 * Escape special LIKE characters to prevent wildcard injection
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export const addContact = (sessionId: string, pn: string, lid: string) => {
  if (pn && lid) {
    pn = pn.split("@")[0] ?? pn;
    lid = lid.split("@")[0] ?? lid;
    const tableName = getContactsTable(sessionId);

    const existing = bunql.query<{ pn: string }>(
      `SELECT pn FROM "${tableName}" WHERE pn = ?`,
      [pn],
    );

    if (existing.length > 0) {
      execWithParams(`UPDATE "${tableName}" SET lid = ? WHERE pn = ?`, [
        lid,
        pn,
      ]);
    } else {
      execWithParams(`INSERT INTO "${tableName}" (pn, lid) VALUES (?, ?)`, [
        pn,
        lid,
      ]);
    }
  }
  return;
};

export const getAllContacts = (sessionId: string) => {
  const tableName = getContactsTable(sessionId);
  const rows = bunql.query<{ pn: string }>(`SELECT pn FROM "${tableName}"`);
  return rows.map((p) => `${p.pn}@s.whatsapp.net`);
};

export const getLidByPn = async (sessionId: string, pn: string) => {
  const tableName = getContactsTable(sessionId);
  const rows = bunql.query<{ lid: string }>(
    `SELECT lid FROM "${tableName}" WHERE pn = ?`,
    [pn],
  );
  const contact = rows[0];
  return contact?.lid + "@lid" || null;
};

export const getPnByLid = (sessionId: string, lid: string) => {
  const tableName = getContactsTable(sessionId);
  const rows = bunql.query<{ pn: string }>(
    `SELECT pn FROM "${tableName}" WHERE lid = ?`,
    [lid],
  );
  const contact = rows[0];
  return contact?.pn + "@s.whatsapp.net" || null;
};

export const getBothId = (sessionId: string, id: string) => {
  const rawId = id.includes(":") ? id.split(":")[1] : id;
  const cleanId = (rawId ?? id).split("@")[0] ?? id;
  const tableName = getContactsTable(sessionId);

  const rows = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`,
    [cleanId, cleanId],
  );
  const contact = rows[0];

  if (!contact) return null;

  return {
    pn: contact.pn + "@s.whatsapp.net",
    lid: contact.lid + "@lid",
  };
};

export const getAlternateId = (sessionId: string, id: string) => {
  id = id?.split("@")?.[0] ?? id;
  const tableName = getContactsTable(sessionId);

  const rows = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`,
    [id, id],
  );
  const contact = rows[0];

  if (!contact) return null;
  return contact.pn === id
    ? contact.lid + "@lid"
    : contact.pn + "@s.whatsapp.net";
};

export const removeContact = (sessionId: string, id: string) => {
  const tableName = getContactsTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE pn = ? OR lid = ?`, [
    id,
    id,
  ]);
};

export const syncGroupParticipantsToContactList = (
  sessionId: string,
  participants: GroupParticipant[] | undefined,
) => {
  if (!participants) return;
  for (const participant of participants) {
    if (participant.phoneNumber && participant.id) {
      addContact(sessionId, participant.phoneNumber, participant.id);
    }
  }
};

export function parseId(sessionId: string, input: string): string | null;
export function parseId(sessionId: string, input: string[]): string[];
export function parseId(
  sessionId: string,
  input: string | string[],
): string | string[] | null {
  if (Array.isArray(input)) {
    return input
      .map((v) => parseId(sessionId, v))
      .filter((v): v is string => typeof v === "string");
  }

  if (!input) return null;

  let clean = input.includes(":") ? (input.split(":")[1] ?? input) : input;
  if (clean?.startsWith("@")) clean = clean.replace(/^@+/, "");
  const [rawBase, suffix] = clean.split("@");
  const base = (rawBase ?? clean).replace(/^@+/, "");

  if (suffix === "s.whatsapp.net") return `${base}@s.whatsapp.net`;
  if (suffix === "lid") return `${base}@lid`;

  const tableName = getContactsTable(sessionId);

  const resolve = (pn?: string, lid?: string) => {
    if (pn === base || pn?.startsWith(base)) return `${pn}@s.whatsapp.net`;
    if (lid === base || lid?.startsWith(base)) return `${lid}@lid`;
    return null;
  };

  const rows = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`,
    [base, base],
  );
  const contact = rows[0];

  if (contact) {
    const resolved = resolve(contact.pn, contact.lid);
    if (resolved) return resolved;
  }

  // Escape special LIKE characters to prevent wildcard injection
  const escapedBase = escapeLikePattern(base);
  const fuzzyRows = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}" WHERE pn LIKE ? ESCAPE '\\' OR lid LIKE ? ESCAPE '\\' LIMIT 1`,
    [`${escapedBase}%`, `${escapedBase}%`],
  );
  const fuzzy = fuzzyRows[0];

  if (fuzzy) {
    const resolved = resolve(fuzzy.pn, fuzzy.lid);
    if (resolved) return resolved;
  }

  return null;
}
