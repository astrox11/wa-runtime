import type { GroupMetadata, GroupParticipant, WASocket } from "baileys";
import { Database } from "bun:sqlite";
import config from "../config";
import { log } from "./util";

const GO_SERVER = process.env.GO_SERVER || `http://localhost:${config.PORT}`;

const db = new Database("whatsaly.db", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

function getPhoneFromSessionId(sessionId: string): string {
  return sessionId.replace("session_", "");
}

function getUserTableName(phone: string, suffix: string): string {
  return `user_${phone}_${suffix}`;
}

function createUserGroupsTable(phoneNumber: string): void {
  const tableName = getUserTableName(phoneNumber, "groups");
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, data TEXT)`);
}

function createUserContactsTable(phoneNumber: string): void {
  const tableName = getUserTableName(phoneNumber, "contacts");
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (pn TEXT PRIMARY KEY, lid TEXT)`);
}

function createUserAliveTable(phoneNumber: string): void {
  const tableName = getUserTableName(phoneNumber, "alive");
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY, alive_message TEXT)`);
}

function createUserAfkTable(phoneNumber: string): void {
  const tableName = getUserTableName(phoneNumber, "afk");
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY, status INTEGER DEFAULT 0, message TEXT, time INTEGER)`);
}

function createUserMentionTable(phoneNumber: string): void {
  const tableName = getUserTableName(phoneNumber, "mention");
  db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (groupId TEXT PRIMARY KEY, message TEXT, type TEXT, data TEXT)`);
}

function getGroupsTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserGroupsTable(phoneNumber);
  return getUserTableName(phoneNumber, "groups");
}

function getContactsTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserContactsTable(phoneNumber);
  return getUserTableName(phoneNumber, "contacts");
}

function getAliveTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAliveTable(phoneNumber);
  return getUserTableName(phoneNumber, "alive");
}

function getAfkTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAfkTable(phoneNumber);
  return getUserTableName(phoneNumber, "afk");
}

function getMentionTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserMentionTable(phoneNumber);
  return getUserTableName(phoneNumber, "mention");
}

export const cachedGroupMetadata = async (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const row = stmt.get(id);
  return row?.data ? JSON.parse(row.data) : undefined;
};

export const GetGroupMeta = (sessionId: string, id: string): GroupMetadata | undefined => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const row = stmt.get(id);
  return row?.data ? JSON.parse(row.data) : undefined;
};

export const GetParticipants = (sessionId: string, id: string): string[] => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const row = stmt.get(id);
  if (!row?.data) return [];
  const metadata = JSON.parse(row.data) as GroupMetadata;
  return [
    ...metadata.participants.map((p) => p.id),
    ...metadata.participants.map((p) => p.phoneNumber),
  ].filter((x): x is string => typeof x === "string");
};

export const isParticipant = (sessionId: string, chat: string, participantId: string): boolean => {
  return GetParticipants(sessionId, chat).includes(participantId);
};

export const cacheGroupMetadata = async (
  sessionId: string,
  metadata: GroupMetadata | (Partial<GroupMetadata> & { id: string }),
) => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const exists = stmt.get(metadata.id);

  if (exists) {
    const existingData = JSON.parse(exists.data) as GroupMetadata;
    const mergedData: GroupMetadata = {
      ...existingData,
      ...metadata,
      participants: metadata.participants !== undefined ? metadata.participants : existingData.participants,
    };
    if (metadata.participants) {
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
    }
    db.exec(`UPDATE "${tableName}" SET data = '${JSON.stringify(mergedData).replace(/'/g, "''")}' WHERE id = '${metadata.id}'`);
  } else {
    if (metadata.participants) {
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
    }
    db.exec(`INSERT INTO "${tableName}" (id, data) VALUES ('${metadata.id}', '${JSON.stringify(metadata).replace(/'/g, "''")}')`);
  }
};

export const removeGroupMetadata = async (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  db.exec(`DELETE FROM "${tableName}" WHERE id = '${id}'`);
};

export const isAdmin = (sessionId: string, chat: string, participantId: string): boolean => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const row = stmt.get(chat);
  if (!row?.data) return false;
  const metadata = JSON.parse(row.data) as GroupMetadata;
  const admins = metadata?.participants.filter((p) => p.admin !== null);
  return [
    ...admins.map((p) => p.id),
    ...admins.map((p) => p.phoneNumber),
  ].filter((x): x is string => typeof x === "string").includes(participantId);
};

export const getGroupAdmins = (sessionId: string, chat: string): string[] => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ data: string }, [string]>(`SELECT data FROM "${tableName}" WHERE id = ?`);
  const row = stmt.get(chat);
  if (!row?.data) return [];
  const metadata = JSON.parse(row.data) as GroupMetadata;
  return metadata.participants.filter((p) => p.admin !== null).map((p) => p.id);
};

export const syncGroupMetadata = async (sessionId: string, client: WASocket) => {
  try {
    const groups = await client.groupFetchAllParticipating();
    for (const [id, metadata] of Object.entries(groups)) {
      metadata.id = id;
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
      await cacheGroupMetadata(sessionId, metadata);
    }
  } catch (error) {
    log.error("Error syncing group metadata:", error);
  }
};

export const getAllGroups = (sessionId: string): Array<{
  id: string;
  subject: string;
  participantCount: number;
  isCommunity?: boolean;
  linkedParent?: string;
}> => {
  const tableName = getGroupsTable(sessionId);
  const stmt = db.query<{ id: string; data: string }, []>(`SELECT id, data FROM "${tableName}"`);
  const rows = stmt.all();
  return rows.map((row) => {
    const metadata = JSON.parse(row.data) as GroupMetadata;
    return {
      id: row.id,
      subject: metadata.subject || "Unknown Group",
      participantCount: metadata.participants?.length || 0,
      isCommunity: metadata.isCommunity || false,
      linkedParent: metadata.linkedParent,
    };
  });
};

export const addContact = (sessionId: string, pn: string, lid: string) => {
  if (pn && lid) {
    pn = pn.split("@")[0] ?? pn;
    lid = lid.split("@")[0] ?? lid;
    const tableName = getContactsTable(sessionId);
    const stmt = db.query<{ pn: string }, [string]>(`SELECT pn FROM "${tableName}" WHERE pn = ?`);
    const existing = stmt.get(pn);
    if (existing) {
      db.exec(`UPDATE "${tableName}" SET lid = '${lid}' WHERE pn = '${pn}'`);
    } else {
      db.exec(`INSERT INTO "${tableName}" (pn, lid) VALUES ('${pn}', '${lid}')`);
    }
  }
};

export const getAllContacts = (sessionId: string): string[] => {
  const tableName = getContactsTable(sessionId);
  const stmt = db.query<{ pn: string }, []>(`SELECT pn FROM "${tableName}"`);
  return stmt.all().map((p) => `${p.pn}@s.whatsapp.net`);
};

export const getLidByPn = async (sessionId: string, pn: string): Promise<string | null> => {
  const tableName = getContactsTable(sessionId);
  const stmt = db.query<{ lid: string }, [string]>(`SELECT lid FROM "${tableName}" WHERE pn = ?`);
  const contact = stmt.get(pn);
  return contact?.lid ? contact.lid + "@lid" : null;
};

export const getPnByLid = (sessionId: string, lid: string): string | null => {
  const tableName = getContactsTable(sessionId);
  const stmt = db.query<{ pn: string }, [string]>(`SELECT pn FROM "${tableName}" WHERE lid = ?`);
  const contact = stmt.get(lid);
  return contact?.pn ? contact.pn + "@s.whatsapp.net" : null;
};

export const getBothId = (sessionId: string, id: string): { pn: string; lid: string } | null => {
  const rawId = id.includes(":") ? id.split(":")[1] : id;
  const cleanId = (rawId ?? id).split("@")[0] ?? id;
  const tableName = getContactsTable(sessionId);
  const stmt = db.query<{ pn: string; lid: string }, [string, string]>(`SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`);
  const contact = stmt.get(cleanId, cleanId);
  if (!contact) return null;
  return { pn: contact.pn + "@s.whatsapp.net", lid: contact.lid + "@lid" };
};

export const getAlternateId = (sessionId: string, id: string): string | null => {
  id = id?.split("@")?.[0] ?? id;
  const tableName = getContactsTable(sessionId);
  const stmt = db.query<{ pn: string; lid: string }, [string, string]>(`SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`);
  const contact = stmt.get(id, id);
  if (!contact) return null;
  return contact.pn === id ? contact.lid + "@lid" : contact.pn + "@s.whatsapp.net";
};

export const removeContact = (sessionId: string, id: string) => {
  const tableName = getContactsTable(sessionId);
  db.exec(`DELETE FROM "${tableName}" WHERE pn = '${id}' OR lid = '${id}'`);
};

export const syncGroupParticipantsToContactList = (sessionId: string, participants: GroupParticipant[] | undefined) => {
  if (!participants) return;
  for (const participant of participants) {
    if (participant.phoneNumber && participant.id) {
      addContact(sessionId, participant.phoneNumber, participant.id);
    }
  }
};

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function parseId(sessionId: string, input: string): string | null;
export function parseId(sessionId: string, input: string[]): string[];
export function parseId(sessionId: string, input: string | string[]): string | string[] | null {
  if (Array.isArray(input)) {
    return input.map((v) => parseId(sessionId, v)).filter((v): v is string => typeof v === "string");
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
  const stmt = db.query<{ pn: string; lid: string }, [string, string]>(`SELECT pn, lid FROM "${tableName}" WHERE pn = ? OR lid = ?`);
  const contact = stmt.get(base, base);
  if (contact) {
    const resolved = resolve(contact.pn, contact.lid);
    if (resolved) return resolved;
  }
  const escapedBase = escapeLikePattern(base);
  const fuzzyStmt = db.query<{ pn: string; lid: string }, [string, string]>(`SELECT pn, lid FROM "${tableName}" WHERE pn LIKE ? ESCAPE '\\' OR lid LIKE ? ESCAPE '\\' LIMIT 1`);
  const fuzzy = fuzzyStmt.get(`${escapedBase}%`, `${escapedBase}%`);
  if (fuzzy) {
    const resolved = resolve(fuzzy.pn, fuzzy.lid);
    if (resolved) return resolved;
  }
  return null;
}

export const setAliveMessage = (sessionId: string, message: string) => {
  const tableName = getAliveTable(sessionId);
  const stmt = db.query<{ alive_message: string }, []>(`SELECT alive_message FROM "${tableName}" WHERE id = 1`);
  const current = stmt.get();
  if (current) {
    db.exec(`UPDATE "${tableName}" SET alive_message = '${message.replace(/'/g, "''")}' WHERE id = 1`);
  } else {
    db.exec(`INSERT INTO "${tableName}" (id, alive_message) VALUES (1, '${message.replace(/'/g, "''")}')`);
  }
  return { session_id: sessionId, alive_message: message };
};

export const getAliveMessage = (sessionId: string): string | null => {
  const tableName = getAliveTable(sessionId);
  const stmt = db.query<{ alive_message: string }, []>(`SELECT alive_message FROM "${tableName}" WHERE id = 1`);
  const row = stmt.get();
  return row?.alive_message || null;
};

export const setAfk = (sessionId: string, status: boolean, message?: string, time?: number) => {
  const tableName = getAfkTable(sessionId);
  const statusValue = status ? 1 : 0;
  const timeValue = status ? time || Date.now() : 0;
  const stmt = db.query<{ status: number; message: string; time: number }, []>(`SELECT status, message, time FROM "${tableName}" WHERE id = 1`);
  const current = stmt.get();
  if (current) {
    db.exec(`UPDATE "${tableName}" SET status = ${statusValue}, message = ${message ? `'${message.replace(/'/g, "''")}'` : 'NULL'}, time = ${timeValue} WHERE id = 1`);
  } else {
    db.exec(`INSERT INTO "${tableName}" (id, status, message, time) VALUES (1, ${statusValue}, ${message ? `'${message.replace(/'/g, "''")}'` : 'NULL'}, ${timeValue})`);
  }
  return { session_id: sessionId, status: statusValue, message, time: timeValue };
};

export const getAfk = (sessionId: string): { status: number; message?: string; time?: number } | null => {
  const tableName = getAfkTable(sessionId);
  const stmt = db.query<{ status: number; message: string; time: number }, []>(`SELECT status, message, time FROM "${tableName}" WHERE id = 1`);
  const row = stmt.get();
  return row || null;
};

export const setMentionMessage = (sessionId: string, groupId: string, content: { message?: string; type: string; data?: any }) => {
  const tableName = getMentionTable(sessionId);
  const dataStr = content.data ? JSON.stringify(content.data).replace(/'/g, "''") : null;
  const messageStr = content.message ? content.message.replace(/'/g, "''") : null;
  db.exec(`INSERT OR REPLACE INTO "${tableName}" (groupId, message, type, data) VALUES ('${groupId}', ${messageStr ? `'${messageStr}'` : 'NULL'}, '${content.type}', ${dataStr ? `'${dataStr}'` : 'NULL'})`);
  return { session_id: sessionId, groupId };
};

export const getMentionMessage = (sessionId: string, groupId: string): string | null => {
  const tableName = getMentionTable(sessionId);
  const stmt = db.query<{ message: string }, [string]>(`SELECT message FROM "${tableName}" WHERE groupId = ?`);
  const row = stmt.get(groupId);
  return row?.message || null;
};

export const deleteMentionMessage = (sessionId: string, groupId: string) => {
  const tableName = getMentionTable(sessionId);
  db.exec(`DELETE FROM "${tableName}" WHERE groupId = '${groupId}'`);
  return { session_id: sessionId, groupId };
};

export const getMentionData = (sessionId: string, groupId: string): { type: string; message?: string; data?: any } | null => {
  const tableName = getMentionTable(sessionId);
  const stmt = db.query<{ message: string; type: string; data: string }, [string]>(`SELECT message, type, data FROM "${tableName}" WHERE groupId = ?`);
  const res = stmt.get(groupId);
  if (!res) return null;
  return { type: res.type, message: res.message, data: res.data ? JSON.parse(res.data) : null };
};
