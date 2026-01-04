import type { GroupMetadata, WASocket } from "baileys";
import { bunql, execWithParams } from "./_sql";
import { log } from "../util";
import { syncGroupParticipantsToContactList } from "./contact";
import {
  createUserGroupsTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate groups table for a session
 */
function getGroupsTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserGroupsTable(phoneNumber);
  return getUserTableName(phoneNumber, "groups");
}

export const cachedGroupMetadata = async (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  return row?.data ? JSON.parse(row.data) : undefined;
};

export const GetGroupMeta = (
  sessionId: string,
  id: string,
): GroupMetadata | undefined => {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  return row?.data ? JSON.parse(row.data) : undefined;
};

export const GetParticipants = (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [id],
  );
  const row = rows[0];

  if (!row?.data) return [];

  const metadata = JSON.parse(row.data) as GroupMetadata;
  return [
    ...metadata.participants.map((p) => p.id),
    ...metadata.participants.map((p) => p.phoneNumber),
  ].filter(Boolean);
};

export const isParticipant = (
  sessionId: string,
  chat: string,
  participantId: string,
) => {
  return GetParticipants(sessionId, chat).includes(participantId);
};

export const cacheGroupMetadata = async (
  sessionId: string,
  metadata: GroupMetadata | (Partial<GroupMetadata> & { id: string }),
) => {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [metadata.id],
  );
  const exists = rows[0];

  if (exists) {
    const existingData = JSON.parse(exists.data) as GroupMetadata;

    const mergedData: GroupMetadata = {
      ...existingData,
      ...metadata,
      participants:
        metadata.participants !== undefined
          ? metadata.participants
          : existingData.participants,
    };
    if (metadata.participants) {
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
    }
    execWithParams(`UPDATE "${tableName}" SET data = ? WHERE id = ?`, [
      JSON.stringify(mergedData),
      metadata.id,
    ]);
  } else {
    if (metadata.participants) {
      syncGroupParticipantsToContactList(sessionId, metadata.participants);
    }
    execWithParams(`INSERT INTO "${tableName}" (id, data) VALUES (?, ?)`, [
      metadata.id,
      JSON.stringify(metadata),
    ]);
  }
};

export const removeGroupMetadata = async (sessionId: string, id: string) => {
  const tableName = getGroupsTable(sessionId);
  execWithParams(`DELETE FROM "${tableName}" WHERE id = ?`, [id]);
};

export const isAdmin = function (
  sessionId: string,
  chat: string,
  participantId: string,
) {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [chat],
  );
  const row = rows[0];

  if (!row?.data) return false;

  const metadata = JSON.parse(row.data) as GroupMetadata;
  const participant = metadata?.participants.filter((p) => p.admin !== null);

  return [
    ...participant.map((p) => p.id),
    ...participant.map((p) => p.phoneNumber),
  ].includes(participantId);
};

export const getGroupAdmins = function (sessionId: string, chat: string) {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ data: string }>(
    `SELECT data FROM "${tableName}" WHERE id = ?`,
    [chat],
  );
  const row = rows[0];

  if (!row?.data) return [];

  const metadata = JSON.parse(row.data) as GroupMetadata;
  const admins = metadata.participants
    .filter((p) => p.admin !== null)
    .map((p) => p.id);
  return admins;
};

export const syncGroupMetadata = async (
  sessionId: string,
  client: WASocket,
) => {
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
  return;
};

export const getAllGroups = function (sessionId: string): Array<{
  id: string;
  subject: string;
  participantCount: number;
  isCommunity?: boolean;
  linkedParent?: string;
}> {
  const tableName = getGroupsTable(sessionId);
  const rows = bunql.query<{ id: string; data: string }>(
    `SELECT id, data FROM "${tableName}"`,
  );

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
