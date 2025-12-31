import { bunql, execWithParams } from "../sql/_sql";
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "baileys";
import { Mutex } from "async-mutex";
import { addContact } from "../sql/contact";
import {
  createUserAuthTable,
  getPhoneFromSessionId,
  getUserTableName,
} from "../sql/tables";

const mutex = new Mutex();

/**
 * Get the appropriate auth table for a session
 */
function getAuthTable(sessionId: string) {
  const phoneNumber = getPhoneFromSessionId(sessionId);
  createUserAuthTable(phoneNumber);
  return getUserTableName(phoneNumber, "auth");
}

export const useSessionAuth = async (sessionId: string) => {
  const tableName = getAuthTable(sessionId);

  const writeData = async (data: any, name: string) =>
    mutex.runExclusive(() => {
      const rows = bunql.query<{ name: string }>(
        `SELECT name FROM "${tableName}" WHERE name = ?`,
        [name],
      );
      const row = rows[0];
      const payload = JSON.stringify(data, BufferJSON.replacer);

      if (row) {
        execWithParams(`UPDATE "${tableName}" SET data = ? WHERE name = ?`, [
          payload,
          name,
        ]);
      } else {
        execWithParams(
          `INSERT INTO "${tableName}" (name, data) VALUES (?, ?)`,
          [name, payload],
        );
      }
    });

  const readData = async (name: string) =>
    mutex.runExclusive(() => {
      const rows = bunql.query<{ data: string }>(
        `SELECT data FROM "${tableName}" WHERE name = ?`,
        [name],
      );
      const row = rows[0];
      return row ? JSON.parse(row.data, BufferJSON.reviver) : null;
    });

  const removeData = async (name: string) =>
    mutex.runExclusive(() => {
      execWithParams(`DELETE FROM "${tableName}" WHERE name = ?`, [name]);
    });

  const creds: AuthenticationCreds =
    (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ) => {
          const out: { [id: string]: SignalDataTypeMap[T] } = {};

          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);

              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }

              out[id] = value;
            }),
          );

          return out;
        },

        set: async (data: SignalDataSet) => {
          const tasks: Promise<void>[] = [];

          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];

              const key = `${category}-${id}`;
              if (key.includes("lid-mapping")) {
                handleLidMapping(sessionId, key, value as string);
              }
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }

          await Promise.all(tasks);
        },
      },
    },

    saveCreds: async () => {
      await writeData(creds, "creds");
    },

    clearAuth: async () => {
      await mutex.runExclusive(() => {
        bunql.exec(`DELETE FROM "${tableName}"`);
      });
    },
  };
};

function handleLidMapping(sessionId: string, key: string, value: string) {
  const isPn = !key.includes("reverse");

  if (isPn) {
    const pnKey = key.split("-")[2];
    const cleanedValue = value.replace(/^"|"$/g, "");

    addContact(sessionId, pnKey, cleanedValue);
  } else {
    const lidKey = key.split("-")[2].split("_")[0];
    const cleanedValue = value.replace(/^"|"$/g, "");

    addContact(sessionId, cleanedValue, lidKey);
  }
}
