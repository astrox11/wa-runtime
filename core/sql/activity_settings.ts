import { bunql, execWithParams } from "./_sql";
import {
  createUserActivitySettingsTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "./tables";

/**
 * Get the appropriate activity settings table for a session
 */
function getActivitySettingsTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserActivitySettingsTable(phoneNumber);
  return getUserTableName(phoneNumber, "activity_settings");
}

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

/**
 * Get activity settings for a session
 */
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
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }

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

/**
 * Update activity settings for a session
 */
export const setActivitySettings = (
  sessionId: string,
  settings: Partial<ActivitySettings>,
): ActivitySettings => {
  const tableName = getActivitySettingsTable(sessionId);
  const current = getActivitySettings(sessionId);

  const updated: ActivitySettings = {
    ...current,
    ...settings,
  };

  const rows = bunql.query<{ id: number }>(
    `SELECT id FROM "${tableName}" WHERE id = 1`,
  );

  if (rows.length > 0) {
    execWithParams(
      `UPDATE "${tableName}" SET 
        auto_read_messages = ?,
        auto_recover_deleted_messages = ?,
        auto_antispam = ?,
        auto_typing = ?,
        auto_recording = ?,
        auto_reject_calls = ?,
        auto_always_online = ?
       WHERE id = 1`,
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

/**
 * Toggle a specific activity setting for a session
 */
export const toggleActivitySetting = (
  sessionId: string,
  setting: keyof ActivitySettings,
): ActivitySettings => {
  const current = getActivitySettings(sessionId);
  return setActivitySettings(sessionId, {
    [setting]: !current[setting],
  });
};
