import { bunql } from "./_sql";
import { VALID_STATUSES, StatusType, type Session } from "../auth";
import type { Contact } from "baileys";
import { log } from "../util";

const Session = bunql.define("sessions", {
  id: { type: "TEXT", primary: true },
  phone_number: { type: "TEXT", notNull: true },
  status: { type: "INTEGER", notNull: true },
  user_info: { type: "TEXT", notNull: false },
  created_at: { type: "INTEGER", notNull: true },
});

export const createSession = (id: string, phoneNumber: string): Session => {
  const record: Session = {
    id,
    phone_number: phoneNumber,
    status: StatusType.Pairing,
    user_info: null,
    created_at: Date.now(),
  };
  Session.insert({
    id: record.id,
    phone_number: record.phone_number,
    status: record.status,
    user_info:
      typeof record.user_info === "string" ? record.user_info : undefined,
    created_at: record.created_at,
  });
  return record;
};

export const getSession = (idOrPhone: string): Session | null => {
  const row = Session.query()
    .where("id", "=", idOrPhone)
    .orWhere("phone_number", "=", idOrPhone)
    .first();
  return row
    ? {
        id: row.id,
        phone_number: row.phone_number,
        created_at: row.created_at,
        status: row.status,
        user_info: row.user_info ? JSON.parse(row.user_info) : null,
      }
    : null;
};

export const getAllSessions = (): Session[] => {
  return Session.all().map((row) => ({
    id: row.id,
    phone_number: row.phone_number,
    created_at: row.created_at,
    status: row.status,
    user_info: row.user_info ? JSON.parse(row.user_info) : null,
  }));
};

export const updateSessionStatus = (
  id: string,
  status: StatusType,
): boolean => {
  log.debug(`Updating session ${id} status to ${StatusType[status]}`);
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

export const updateSessionUserInfo = (
  id: string,
  userInfo: Contact,
): boolean => {
  const exists = Session.find({ id }).run()[0];
  if (exists) {
    Session.update({ user_info: JSON.stringify(userInfo) })
      .where("id", "=", id)
      .run();
    return true;
  }
  return false;
};
