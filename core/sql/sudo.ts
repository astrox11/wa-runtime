import { jidNormalizedUser } from "baileys";
import { bunql, execWithParams } from "./_sql";
import {
  createUserSudoTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate sudo table for a session
 */
function getSudoTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserSudoTable(phoneNumber);
  return getUserTableName(phoneNumber, "sudo");
}

export const isSudo = (sessionId: string, id: string) => {
  const tableName = getSudoTable(sessionId);
  const rows = bunql.query<{ pn: string; lid: string }>(
    `SELECT pn, lid FROM "${tableName}"`,
  );
  const pn = rows.map((e) => e.pn);
  const lid = rows.map((e) => e.lid);

  return [...pn, ...lid].includes(id);
};

export const addSudo = (sessionId: string, id: string, lid: string) => {
  id = jidNormalizedUser(id);
  lid = jidNormalizedUser(lid);
  if (!isSudo(sessionId, id)) {
    const tableName = getSudoTable(sessionId);
    execWithParams(`INSERT INTO "${tableName}" (pn, lid) VALUES (?, ?)`, [
      id,
      lid,
    ]);
    return true;
  }
  return false;
};

export const removeSudo = (sessionId: string, id: string) => {
  if (isSudo(sessionId, id)) {
    const tableName = getSudoTable(sessionId);
    execWithParams(`DELETE FROM "${tableName}" WHERE pn = ? OR lid = ?`, [
      id,
      id,
    ]);
    return true;
  }
  return false;
};

export const getSudos = (sessionId: string) => {
  const tableName = getSudoTable(sessionId);
  return bunql.query<{ pn: string; lid: string }>(
    `SELECT * FROM "${tableName}"`,
  );
};
