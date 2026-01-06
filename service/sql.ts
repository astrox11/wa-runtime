import type { GroupMetadata, GroupParticipant, WASocket, WAMessageKey, WAMessage, Contact } from "baileys";
import { proto, jidNormalizedUser } from "baileys";
import { Database } from "bun:sqlite";
import config from "../config";
import { log } from "./util";

const GO_SERVER = process.env.GO_SERVER || `http://localhost:${config.API_PORT}`;

const db = new Database("database.db", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

const createdTables = new Set<string>();

export const bunql = {
  query: <T>(sql: string, params: any[] = []): T[] => {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  },
  exec: (sql: string) => {
    db.exec(sql);
  },
  getDatabase: () => db,
};

export function execWithParams(sql: string, params: any[] = []): void {
  const stmt = db.prepare(sql);
  stmt.run(...params);
}

export function queryWithParams<T>(sql: string, params: any[] = []): T[] {
  return bunql.query<T>(sql, params);
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function getPhoneFromSessionId(sessionId: string): string {
  return sessionId.replace("session_", "");
}

export function getUserTableName(phone: string, suffix: string): string {
  return `user_${sanitizePhoneNumber(phone)}_${suffix}`;
}

export function createUserAuthTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "auth");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (name TEXT PRIMARY KEY, data TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserMessagesTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "messages");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, msg TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserContactsTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "contacts");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (pn TEXT PRIMARY KEY, lid TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserGroupsTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "groups");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, data TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserSudoTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "sudo");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (pn TEXT PRIMARY KEY, lid TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserBanTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "ban");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (pn TEXT PRIMARY KEY, lid TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserModeTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "mode");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), mode TEXT NOT NULL)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserPrefixTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "prefix");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), prefix TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserAntideleteTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "antidelete");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), active INTEGER NOT NULL, mode TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserAliveTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "alive");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), alive_message TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserMentionTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "mention");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (groupId TEXT PRIMARY KEY, message TEXT, type TEXT DEFAULT 'text', data TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserFilterTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "filter");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (trigger TEXT PRIMARY KEY, reply TEXT, status INTEGER)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserAfkTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "afk");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), status INTEGER, message TEXT, time BIGINT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserGroupEventTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "group_event");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (id INTEGER PRIMARY KEY CHECK (id = 1), status INTEGER)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserStickerTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "sticker");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (name TEXT PRIMARY KEY, sha256 TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserBgmTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "bgm");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (trigger TEXT PRIMARY KEY, audioData TEXT)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserActivitySettingsTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "activity_settings");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_read_messages INTEGER NOT NULL DEFAULT 0,
      auto_recover_deleted_messages INTEGER NOT NULL DEFAULT 0,
      auto_antispam INTEGER NOT NULL DEFAULT 0,
      auto_typing INTEGER NOT NULL DEFAULT 0,
      auto_recording INTEGER NOT NULL DEFAULT 0,
      auto_reject_calls INTEGER NOT NULL DEFAULT 0,
      auto_always_online INTEGER NOT NULL DEFAULT 0
    )`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function createUserAntilinkTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "antilink");
  if (!createdTables.has(tableName)) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (groupId TEXT PRIMARY KEY, mode INTEGER NOT NULL DEFAULT 0)`);
    createdTables.add(tableName);
  }
  return tableName;
}

export function initializeSql(phoneNumber: string): void {
  createUserAuthTable(phoneNumber);
  createUserMessagesTable(phoneNumber);
  createUserContactsTable(phoneNumber);
  createUserGroupsTable(phoneNumber);
  createUserSudoTable(phoneNumber);
  createUserBanTable(phoneNumber);
  createUserModeTable(phoneNumber);
  createUserPrefixTable(phoneNumber);
  createUserAntideleteTable(phoneNumber);
  createUserAliveTable(phoneNumber);
  createUserMentionTable(phoneNumber);
  createUserFilterTable(phoneNumber);
  createUserAfkTable(phoneNumber);
  createUserGroupEventTable(phoneNumber);
  createUserStickerTable(phoneNumber);
  createUserBgmTable(phoneNumber);
  createUserActivitySettingsTable(phoneNumber);
  createUserAntilinkTable(phoneNumber);
  log.debug(`Initialized tables for user ${phoneNumber}`);
}

export function deleteUserTables(phoneNumber: string): void {
  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
  const suffixes = ["auth", "messages", "contacts", "groups", "sudo", "ban", "mode", "prefix", "antidelete", "alive", "mention", "filter", "afk", "group_event", "sticker", "bgm", "activity_settings", "antilink"];
  for (const table of suffixes) {
    const tableName = `user_${sanitizedPhone}_${table}`;
    db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
    createdTables.delete(tableName);
  }
  log.debug(`Deleted tables for user ${phoneNumber}`);
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

function getSudoTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserSudoTable(phoneNumber);
  return getUserTableName(phoneNumber, "sudo");
}

function getModeTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserModeTable(phoneNumber);
  return getUserTableName(phoneNumber, "mode");
}

function getPrefixTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserPrefixTable(phoneNumber);
  return getUserTableName(phoneNumber, "prefix");
}

function getMessagesTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserMessagesTable(phoneNumber);
  return getUserTableName(phoneNumber, "messages");
}

function getStickerTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserStickerTable(phoneNumber);
  return getUserTableName(phoneNumber, "sticker");
}

function getBgmTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserBgmTable(phoneNumber);
  return getUserTableName(phoneNumber, "bgm");
}

function getFilterTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserFilterTable(phoneNumber);
  return getUserTableName(phoneNumber, "filter");
}

function getActivitySettingsTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserActivitySettingsTable(phoneNumber);
  return getUserTableName(phoneNumber, "activity_settings");
}

function getAntilinkTable(sessionId: string): string {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAntilinkTable(phoneNumber);
  return getUserTableName(phoneNumber, "antilink");
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
    execWithParams(`UPDATE "${tableName}" SET data = ? WHERE id = ?`, [JSON.stringify(mergedData), metadata.id]);
  } else {
    if (metadata.participants) {
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
    }
    execWithParams(`INSERT INTO "${tableName}" (id, data) VALUES (?, ?)`, [metadata.id, JSON.stringify(metadata)]);
  }
};

export const removeGroupMetadata = async (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE id = ?`, [id]);
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
    for (const [id, metadata] of Object.entries(groups) as [string, GroupMetadata][]) {
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
      execWithParams(`UPDATE "${tableName}" SET lid = ? WHERE pn = ?`, [lid, pn]);
    } else {
      execWithParams(`INSERT INTO "${tableName}" (pn, lid) VALUES (?, ?)`, [pn, lid]);
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
  execWithParams(`DELETE FROM "${tableName}" WHERE pn = ? OR lid = ?`, [id, id]);
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
    execWithParams(`UPDATE "${tableName}" SET alive_message = ? WHERE id = 1`, [message]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (id, alive_message) VALUES (1, ?)`, [message]);
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
    execWithParams(`UPDATE "${tableName}" SET status = ?, message = ?, time = ? WHERE id = 1`, [statusValue, message || null, timeValue]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (id, status, message, time) VALUES (1, ?, ?, ?)`, [statusValue, message || null, timeValue]);
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
  const dataStr = content.data ? JSON.stringify(content.data) : null;
  execWithParams(`INSERT OR REPLACE INTO "${tableName}" (groupId, message, type, data) VALUES (?, ?, ?, ?)`, [groupId, content.message || null, content.type, dataStr]);
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
  execWithParams(`DELETE FROM "${tableName}" WHERE groupId = ?`, [groupId]);
  return { session_id: sessionId, groupId };
};

export const getMentionData = (sessionId: string, groupId: string): { type: string; message?: string; data?: any } | null => {
  const tableName = getMentionTable(sessionId);
  const stmt = db.query<{ message: string; type: string; data: string }, [string]>(`SELECT message, type, data FROM "${tableName}" WHERE groupId = ?`);
  const res = stmt.get(groupId);
  if (!res) return null;
  return { type: res.type, message: res.message, data: res.data ? JSON.parse(res.data) : null };
};

export const isSudo = (sessionId: string, id: string): boolean => {
  const tableName = getSudoTable(sessionId);
  const rows = bunql.query<{ pn: string; lid: string }>(`SELECT pn, lid FROM "${tableName}"`);
  const pn = rows.map((e) => e.pn);
  const lid = rows.map((e) => e.lid);
  return [...pn, ...lid].includes(id);
};

export const addSudo = (sessionId: string, id: string, lid: string): boolean => {
  id = jidNormalizedUser(id);
  lid = jidNormalizedUser(lid);
  if (!isSudo(sessionId, id)) {
    const tableName = getSudoTable(sessionId);
    execWithParams(`INSERT INTO "${tableName}" (pn, lid) VALUES (?, ?)`, [id, lid]);
    return true;
  }
  return false;
};

export const removeSudo = (sessionId: string, id: string): boolean => {
  if (isSudo(sessionId, id)) {
    const tableName = getSudoTable(sessionId);
    execWithParams(`DELETE FROM "${tableName}" WHERE pn = ? OR lid = ?`, [id, id]);
    return true;
  }
  return false;
};

export const getSudos = (sessionId: string) => {
  const tableName = getSudoTable(sessionId);
  return bunql.query<{ pn: string; lid: string }>(`SELECT * FROM "${tableName}"`);
};

type Mode = "private" | "public";

export const setMode = (sessionId: string, type: Mode): boolean | null => {
  const tableName = getModeTable(sessionId);
  const rows = bunql.query<{ mode: string }>(`SELECT mode FROM "${tableName}" WHERE id = 1`);
  const row = rows[0];
  if (row?.mode === type) return null;
  if (row) {
    execWithParams(`UPDATE "${tableName}" SET mode = ? WHERE id = 1`, [type]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (id, mode) VALUES (1, ?)`, [type]);
  }
  return true;
};

export const getMode = (sessionId: string): Mode => {
  const tableName = getModeTable(sessionId);
  const rows = bunql.query<{ mode: string }>(`SELECT mode FROM "${tableName}" WHERE id = 1`);
  const row = rows[0];
  return (row?.mode as Mode) ?? "private";
};

export const set_prefix = (session_id: string, prefix?: string) => {
  const tableName = getPrefixTable(session_id);
  db.exec(`DELETE FROM "${tableName}" WHERE id = 1`);
  execWithParams(`INSERT INTO "${tableName}" (id, prefix) VALUES (1, ?)`, [prefix || null]);
};

export const get_prefix = (session_id: string): string[] | null => {
  const tableName = getPrefixTable(session_id);
  const rows = bunql.query<{ prefix: string | null }>(`SELECT prefix FROM "${tableName}" WHERE id = 1`);
  const row = rows[0];
  return row ? row.prefix?.split("") ?? null : null;
};

export const del_prefix = (session_id: string) => {
  const tableName = getPrefixTable(session_id);
  db.exec(`DELETE FROM "${tableName}" WHERE id = 1`);
};

export const getMessage = async (sessionId: string, key: WAMessageKey) => {
  const id = key?.id;
  if (id) {
    const tableName = getMessagesTable(sessionId);
    const result = bunql.query<{ msg: string }>(`SELECT msg FROM "${tableName}" WHERE id = ?`, [id]);
    const row = result[0];
    return row ? proto.Message.fromObject(JSON.parse(row.msg).message) : undefined;
  }
  return undefined;
};

export const getMessageRaw = async (sessionId: string, key: WAMessageKey) => {
  const id = key?.id;
  if (id) {
    const tableName = getMessagesTable(sessionId);
    const result = bunql.query<{ msg: string }>(`SELECT msg FROM "${tableName}" WHERE id = ?`, [id]);
    const row = result[0];
    return row ? (proto.WebMessageInfo.fromObject(JSON.parse(row.msg)) as WAMessage) : undefined;
  }
  return undefined;
};

export const saveMessage = (sessionId: string, key: WAMessageKey, msg: WAMessage) => {
  const id = key?.id;
  if (id) {
    const tableName = getMessagesTable(sessionId);
    const msgData = JSON.stringify(msg || {});
    const existing = bunql.query<{ id: string }>(`SELECT id FROM "${tableName}" WHERE id = ?`, [id]);
    if (existing.length > 0) {
      execWithParams(`UPDATE "${tableName}" SET msg = ? WHERE id = ?`, [msgData, id]);
    } else {
      execWithParams(`INSERT INTO "${tableName}" (id, msg) VALUES (?, ?)`, [id, msgData]);
    }
  }
};

export const getAllMessages = (sessionId: string, limit: number | null = 100, offset: number | null = 0): Array<{ id: string; message: WAMessage }> => {
  const tableName = getMessagesTable(sessionId);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const results = bunql.query<{ id: string; msg: string }>(`SELECT id, msg FROM "${tableName}" ORDER BY rowid DESC LIMIT ? OFFSET ?`, [safeLimit, safeOffset]);
  return results.map((row) => ({
    id: row.id,
    message: JSON.parse(row.msg || "{}") as WAMessage,
  }));
};

export const getMessagesCount = (sessionId: string): number => {
  const tableName = getMessagesTable(sessionId);
  const result = bunql.query<{ count: number }>(`SELECT COUNT(*) as count FROM "${tableName}"`, []);
  return result[0]?.count || 0;
};

export const saveSticker = (sessionId: string, name: string, sha256: string) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ sha256: string }>(`SELECT sha256 FROM "${tableName}" WHERE name = ?`, [name]);
  const current = rows[0];
  if (current) {
    execWithParams(`UPDATE "${tableName}" SET sha256 = ? WHERE name = ?`, [sha256, name]);
  } else {
    execWithParams(`INSERT INTO "${tableName}" (name, sha256) VALUES (?, ?)`, [name, sha256]);
  }
  return { session_id: sessionId, name, sha256 };
};

export const getStickerByName = (sessionId: string, name: string) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ name: string; sha256: string }>(`SELECT name, sha256 FROM "${tableName}" WHERE name = ?`, [name]);
  return rows[0] || null;
};

export const getAllStickers = (sessionId: string) => {
  const tableName = getStickerTable(sessionId);
  const rows = bunql.query<{ name: string; sha256: string }>(`SELECT name, sha256 FROM "${tableName}"`);
  return rows;
};

export const deleteSticker = (sessionId: string, name: string) => {
  const tableName = getStickerTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE name = ?`, [name]);
  return { session_id: sessionId, name };
};

export const saveBgm = (sessionId: string, trigger: string, audioData: string) => {
  const tableName = getBgmTable(sessionId);
  execWithParams(`INSERT OR REPLACE INTO "${tableName}" (trigger, audioData) VALUES (?, ?)`, [trigger, audioData]);
  return { session_id: sessionId, trigger, audioData };
};

export const getBgmByTrigger = (sessionId: string, trigger: string) => {
  const tableName = getBgmTable(sessionId);
  const rows = bunql.query<{ trigger: string; audioData: string }>(`SELECT trigger, audioData FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return rows[0] || null;
};

export const getAllBgms = (sessionId: string) => {
  const tableName = getBgmTable(sessionId);
  const rows = bunql.query<{ trigger: string; audioData: string }>(`SELECT trigger, audioData FROM "${tableName}"`);
  return rows;
};

export const deleteBgm = (sessionId: string, trigger: string) => {
  const tableName = getBgmTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return { session_id: sessionId, trigger };
};

export const setFilter = (sessionId: string, trigger: string, reply: string, status: number) => {
  const tableName = getFilterTable(sessionId);
  execWithParams(`INSERT OR REPLACE INTO "${tableName}" (trigger, reply, status) VALUES (?, ?, ?)`, [trigger, reply, status]);
  return { session_id: sessionId, trigger, reply, status };
};

export const getFilterByTrigger = (sessionId: string, trigger: string) => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ trigger: string; reply: string; status: number }>(`SELECT trigger, reply, status FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return rows[0] || null;
};

export const getAllFilters = (sessionId: string) => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ trigger: string; reply: string; status: number }>(`SELECT trigger, reply, status FROM "${tableName}"`);
  return rows;
};

export const deleteFilter = (sessionId: string, trigger: string) => {
  const tableName = getFilterTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE trigger = ?`, [trigger]);
  return { session_id: sessionId, trigger };
};

export const getFilterStatus = (sessionId: string): number => {
  const tableName = getFilterTable(sessionId);
  const rows = bunql.query<{ status: number }>(`SELECT status FROM "${tableName}" LIMIT 1`);
  return rows[0]?.status || 0;
};

export interface ActivitySettings {
  auto_read_messages: boolean;
  auto_recover_deleted_messages: boolean;
  auto_antispam: boolean;
  auto_typing: boolean;
  auto_recording: boolean;
  auto_reject_calls: boolean;
  auto_always_online: boolean;
}

const DEFAULT_SETTINGS: ActivitySettings = {
  auto_read_messages: false,
  auto_recover_deleted_messages: false,
  auto_antispam: false,
  auto_typing: false,
  auto_recording: false,
  auto_reject_calls: false,
  auto_always_online: false,
};

export const getActivitySettings = (sessionId: string): ActivitySettings => {
  const tableName = getActivitySettingsTable(sessionId);
  const rows = bunql.query<{
    auto_read_messages: number;
    auto_recover_deleted_messages: number;
    auto_antispam: number;
    auto_typing: number;
    auto_recording: number;
    auto_reject_calls: number;
    auto_always_online: number;
  }>(`SELECT * FROM "${tableName}" WHERE id = 1`);
  const row = rows[0];
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    auto_read_messages: row.auto_read_messages === 1,
    auto_recover_deleted_messages: row.auto_recover_deleted_messages === 1,
    auto_antispam: row.auto_antispam === 1,
    auto_typing: row.auto_typing === 1,
    auto_recording: row.auto_recording === 1,
    auto_reject_calls: row.auto_reject_calls === 1,
    auto_always_online: row.auto_always_online === 1,
  };
};

export const setActivitySettings = (sessionId: string, settings: Partial<ActivitySettings>): ActivitySettings => {
  const tableName = getActivitySettingsTable(sessionId);
  const current = getActivitySettings(sessionId);
  const updated: ActivitySettings = { ...current, ...settings };
  const rows = bunql.query<{ id: number }>(`SELECT id FROM "${tableName}" WHERE id = 1`);
  if (rows.length > 0) {
    execWithParams(
      `UPDATE "${tableName}" SET auto_read_messages = ?, auto_recover_deleted_messages = ?, auto_antispam = ?, auto_typing = ?, auto_recording = ?, auto_reject_calls = ?, auto_always_online = ? WHERE id = 1`,
      [
        updated.auto_read_messages ? 1 : 0,
        updated.auto_recover_deleted_messages ? 1 : 0,
        updated.auto_antispam ? 1 : 0,
        updated.auto_typing ? 1 : 0,
        updated.auto_recording ? 1 : 0,
        updated.auto_reject_calls ? 1 : 0,
        updated.auto_always_online ? 1 : 0,
      ],
    );
  } else {
    execWithParams(
      `INSERT INTO "${tableName}" (id, auto_read_messages, auto_recover_deleted_messages, auto_antispam, auto_typing, auto_recording, auto_reject_calls, auto_always_online) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        updated.auto_read_messages ? 1 : 0,
        updated.auto_recover_deleted_messages ? 1 : 0,
        updated.auto_antispam ? 1 : 0,
        updated.auto_typing ? 1 : 0,
        updated.auto_recording ? 1 : 0,
        updated.auto_reject_calls ? 1 : 0,
        updated.auto_always_online ? 1 : 0,
      ],
    );
  }
  return updated;
};

export const toggleActivitySetting = (sessionId: string, setting: keyof ActivitySettings): ActivitySettings => {
  const current = getActivitySettings(sessionId);
  return setActivitySettings(sessionId, { [setting]: !current[setting] });
};

export const setAntilink = (sessionId: string, groupId: string, mode: number) => {
  const tableName = getAntilinkTable(sessionId);
  execWithParams(`INSERT OR REPLACE INTO "${tableName}" (groupId, mode) VALUES (?, ?)`, [groupId, mode]);
  return { session_id: sessionId, groupId, mode };
};

export const getAntilink = (sessionId: string, groupId: string) => {
  const tableName = getAntilinkTable(sessionId);
  const rows = bunql.query<{ groupId: string; mode: number }>(`SELECT groupId, mode FROM "${tableName}" WHERE groupId = ?`, [groupId]);
  return rows[0] || null;
};

export const getAntilinkMode = (sessionId: string, groupId: string): number => {
  const result = getAntilink(sessionId, groupId);
  return result?.mode ?? 0;
};

export const deleteAntilink = (sessionId: string, groupId: string) => {
  const tableName = getAntilinkTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE groupId = ?`, [groupId]);
  return { session_id: sessionId, groupId };
};

export const getAllAntilink = (sessionId: string) => {
  const tableName = getAntilinkTable(sessionId);
  const rows = bunql.query<{ groupId: string; mode: number }>(`SELECT groupId, mode FROM "${tableName}"`);
  return rows;
};

db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  status INTEGER NOT NULL,
  user_info TEXT,
  created_at INTEGER NOT NULL
)`);

import { StatusType, type Session } from "./auth/types";
import { VALID_STATUSES } from "./auth/util";

export const createSession = (id: string, phoneNumber: string): Session => {
  const record: Session = {
    id,
    phone_number: phoneNumber,
    status: StatusType.Pairing,
    user_info: null,
    created_at: Date.now(),
  };
  execWithParams(
    `INSERT OR REPLACE INTO sessions (id, phone_number, status, user_info, created_at) VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.phone_number, record.status, null, record.created_at],
  );
  return record;
};

export const getSession = (idOrPhone: string): Session | null => {
  const rows = bunql.query<{ id: string; phone_number: string; status: number; user_info: string | null; created_at: number }>(
    `SELECT id, phone_number, status, user_info, created_at FROM sessions WHERE id = ? OR phone_number = ?`,
    [idOrPhone, idOrPhone],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        phone_number: row.phone_number,
        created_at: row.created_at,
        status: row.status as StatusType,
        user_info: row.user_info ? JSON.parse(row.user_info) : null,
      }
    : null;
};

export const getAllSessions = (): Session[] => {
  const rows = bunql.query<{ id: string; phone_number: string; status: number; user_info: string | null; created_at: number }>(
    `SELECT id, phone_number, status, user_info, created_at FROM sessions`,
  );
  return rows.map((row) => ({
    id: row.id,
    phone_number: row.phone_number,
    created_at: row.created_at,
    status: row.status as StatusType,
    user_info: row.user_info ? JSON.parse(row.user_info) : null,
  }));
};

export const updateSessionStatus = (id: string, status: StatusType): boolean => {
  log.debug(`Updating session ${id} status to ${StatusType[status]}`);
  if (!VALID_STATUSES.includes(status)) return false;
  const exists = bunql.query<{ id: string }>(`SELECT id FROM sessions WHERE id = ?`, [id]);
  if (exists.length > 0) {
    execWithParams(`UPDATE sessions SET status = ? WHERE id = ?`, [status, id]);
    return true;
  }
  return false;
};

export const deleteSession = (idOrPhone: string): boolean => {
  const session = getSession(idOrPhone);
  if (session) {
    execWithParams(`DELETE FROM sessions WHERE id = ?`, [session.id]);
    return true;
  }
  return false;
};

export const sessionExists = (idOrPhone: string): boolean => {
  return getSession(idOrPhone) !== null;
};

export const updateSessionUserInfo = (id: string, userInfo: Contact): boolean => {
  const exists = bunql.query<{ id: string }>(`SELECT id FROM sessions WHERE id = ?`, [id]);
  if (exists.length > 0) {
    execWithParams(`UPDATE sessions SET user_info = ? WHERE id = ?`, [JSON.stringify(userInfo), id]);
    return true;
  }
  return false;
};
