import { bunql } from "./_sql";
import { log } from "../util/main";

const ALLOWED_TABLE_SUFFIXES = [
  "auth",
  "messages",
  "contacts",
  "groups",
  "sudo",
  "ban",
  "mode",
  "prefix",
  "antidelete",
  "alive",
  "mention",
  "filter",
  "afk",
  "group_event",
  "sticker",
  "bgm",
] as const;

type TableSuffix = (typeof ALLOWED_TABLE_SUFFIXES)[number];

function isValidTableSuffix(suffix: string): suffix is TableSuffix {
  return ALLOWED_TABLE_SUFFIXES.includes(suffix as TableSuffix);
}

function sanitizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

export function getUserTableName(
  phoneNumber: string,
  tableName: TableSuffix,
): string {
  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

  if (!isValidTableSuffix(tableName)) {
    throw new Error(`Invalid table suffix: ${tableName}`);
  }

  return `user_${sanitizedPhone}_${tableName}`;
}

export function getPhoneFromSessionId(sessionId: string): string {
  if (!sessionId) return "";
  return sessionId.replace(/^session_/, "");
}

const createdTables = new Set<string>();

export function createUserAuthTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "auth");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          name TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserMessagesTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "messages");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id TEXT PRIMARY KEY,
          msg TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserContactsTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "contacts");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          pn TEXT PRIMARY KEY,
          lid TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserGroupsTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "groups");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id TEXT PRIMARY KEY,
          data TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserSudoTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "sudo");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          pn TEXT PRIMARY KEY,
          lid TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserBanTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "ban");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          pn TEXT PRIMARY KEY,
          lid TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserModeTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "mode");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserPrefixTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "prefix");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          prefix TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserAntideleteTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "antidelete");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          active INTEGER NOT NULL,
          mode TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserAliveTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "alive");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          alive_message TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserMentionTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "mention");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
         CREATE TABLE IF NOT EXISTS "${tableName}" (
           groupId TEXT PRIMARY KEY,
           message TEXT,
           type TEXT DEFAULT 'text',
           data TEXT
         )
       `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }
  return tableName;
}

export function createUserFilterTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "filter");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          trigger TEXT PRIMARY KEY,
          reply TEXT,
          status INTEGER
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserAfkTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "afk");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
         CREATE TABLE IF NOT EXISTS "${tableName}" (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           status INTEGER,
           message TEXT,
           time BIGINT
         )
       `);

      const columns = bunql.query(`PRAGMA table_info("${tableName}")`);
      const hasTime = columns.some((c: any) => c.name === "time");
      if (!hasTime) {
        bunql.exec(`ALTER TABLE "${tableName}" ADD COLUMN time BIGINT`);
      }

      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserGroupEventTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "group_event");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          status INTEGER
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserStickerTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "sticker");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          name TEXT PRIMARY KEY,
          sha256 TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
  }

  return tableName;
}

export function createUserBgmTable(phoneNumber: string): string {
  const tableName = getUserTableName(phoneNumber, "bgm");

  if (!createdTables.has(tableName)) {
    try {
      bunql.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          trigger TEXT PRIMARY KEY,
          audioData TEXT
        )
      `);
      createdTables.add(tableName);
    } catch (error) {
      log.error(`Failed to create table ${tableName}:`, error);
    }
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
  log.debug(`Initialized tables for user ${phoneNumber}`);
}

export function deleteUserTables(phoneNumber: string): void {
  const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

  for (const table of ALLOWED_TABLE_SUFFIXES) {
    const tableName = `user_${sanitizedPhone}_${table}`;
    try {
      bunql.exec(`DROP TABLE IF EXISTS "${tableName}"`);
      createdTables.delete(tableName);
    } catch (error) {
      log.error(`Failed to drop table ${tableName}:`, error);
    }
  }

  log.debug(`Deleted tables for user ${phoneNumber}`);
}
