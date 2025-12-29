import { bunql } from "./_sql";

export interface SessionRecord {
  id: string;
  phone_number: string;
  created_at: number;
  status: "active" | "inactive" | "pairing";
}

const Session = bunql.define("sessions", {
  id: { type: "TEXT", primary: true },
  phone_number: { type: "TEXT", notNull: true },
  created_at: { type: "INTEGER", notNull: true },
  status: { type: "TEXT", notNull: true },
});

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
      }
    : null;
};

export const getAllSessions = (): SessionRecord[] => {
  return Session.all().map((row) => ({
    id: row.id,
    phone_number: row.phone_number,
    created_at: row.created_at,
    status: row.status as SessionRecord["status"],
  }));
};

const VALID_STATUSES: SessionRecord["status"][] = ["active", "inactive", "pairing"];

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
