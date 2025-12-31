import { bunql } from "./_sql";
import { log } from "../util/logger";

export interface SessionRecord {
  id: string;
  phone_number: string;
  created_at: number;
  status: "active" | "inactive" | "pairing";
  push_name?: string;
}

const Session = bunql.define("sessions", {
  id: { type: "TEXT", primary: true },
  phone_number: { type: "TEXT", notNull: true },
  created_at: { type: "INTEGER", notNull: true },
  status: { type: "TEXT", notNull: true },
  push_name: { type: "TEXT" },
});

// Ensure push_name column exists (migration for existing databases)
try {
  const columns = bunql.query<{ name: string }>(
    `PRAGMA table_info("sessions")`,
  );
  const hasPushName = columns.some((c) => c.name === "push_name");
  if (!hasPushName) {
    bunql.exec(`ALTER TABLE "sessions" ADD COLUMN push_name TEXT`);
    log.info("Added push_name column to sessions table");
  }
} catch (error) {
  // Log the error but continue - table might not exist yet on first run
  log.debug("Session table migration check:", error);
}

export const createSession = (
  id: string,
  phoneNumber: string,
): SessionRecord => {
  const record: SessionRecord = {
    id,
    phone_number: phoneNumber,
    created_at: Date.now(),
    status: "pairing",
  };
  Session.insert({
    id: record.id,
    phone_number: record.phone_number,
    created_at: record.created_at,
    status: record.status,
  });
  return record;
};

export const getSession = (idOrPhone: string): SessionRecord | null => {
  const row = Session.query()
    .where("id", "=", idOrPhone)
    .orWhere("phone_number", "=", idOrPhone)
    .first();
  return row
    ? {
        id: row.id,
        phone_number: row.phone_number,
        created_at: row.created_at,
        status: row.status as SessionRecord["status"],
        push_name: row.push_name,
      }
    : null;
};

export const getAllSessions = (): SessionRecord[] => {
  return Session.all().map((row) => ({
    id: row.id,
    phone_number: row.phone_number,
    created_at: row.created_at,
    status: row.status as SessionRecord["status"],
    push_name: row.push_name,
  }));
};

const VALID_STATUSES: SessionRecord["status"][] = [
  "active",
  "inactive",
  "pairing",
];

export const updateSessionStatus = (
  id: string,
  status: SessionRecord["status"],
): boolean => {
  // Validate status parameter
  if (!VALID_STATUSES.includes(status)) {
    return false;
  }
  const exists = Session.find({ id }).run()[0];
  if (exists) {
    Session.update({ status }).where("id", "=", id).run();
    return true;
  }
  return false;
};

export const deleteSession = (idOrPhone: string): boolean => {
  const session = getSession(idOrPhone);
  if (session) {
    Session.delete().where("id", "=", session.id).run();
    return true;
  }
  return false;
};

export const sessionExists = (idOrPhone: string): boolean => {
  return getSession(idOrPhone) !== null;
};

/**
 * Update pushName for a session
 */
export const updateSessionPushName = (
  id: string,
  pushName: string,
): boolean => {
  const exists = Session.find({ id }).run()[0];
  if (exists) {
    Session.update({ push_name: pushName }).where("id", "=", id).run();
    return true;
  }
  return false;
};
