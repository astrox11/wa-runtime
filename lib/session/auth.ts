import { bunql } from "../sql/_sql";
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
import { log } from "../util/logger";

const mutex = new Mutex();

// Session-specific auth table
const SessionAuth = bunql.define("session_auth", {
  session_id: { type: "TEXT", notNull: true },
  name: { type: "TEXT", notNull: true },
  data: { type: "TEXT", notNull: true },
});

// Create composite index for efficient lookups
try {
  bunql.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_session_auth_composite ON session_auth(session_id, name)",
  );
} catch (error) {
  log.error(
    "Failed to create index 'idx_session_auth_composite' on 'session_auth':",
    error,
  );
}

export const useSessionAuth = async (sessionId: string) => {
  const writeData = async (data: any, name: string) =>
    mutex.runExclusive(() => {
      const row = SessionAuth.query()
        .where("session_id", "=", sessionId)
        .where("name", "=", name)
        .first();
      const payload = JSON.stringify(data, BufferJSON.replacer);

      if (row) {
        SessionAuth.update({ data: payload })
          .where("session_id", "=", sessionId)
          .where("name", "=", name)
          .run();
      } else {
        SessionAuth.insert({ session_id: sessionId, name, data: payload });
      }
    });

  const readData = async (name: string) =>
    mutex.runExclusive(() => {
      const row = SessionAuth.query()
        .where("session_id", "=", sessionId)
        .where("name", "=", name)
        .first();
      return row ? JSON.parse(row.data, BufferJSON.reviver) : null;
    });

  const removeData = async (name: string) =>
    mutex.runExclusive(() => {
      SessionAuth.delete()
        .where("session_id", "=", sessionId)
        .where("name", "=", name)
        .run();
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
                handleLidMapping(key, value as string);
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
        SessionAuth.delete().where("session_id", "=", sessionId).run();
      });
    },
  };
};

function handleLidMapping(key: string, value: string) {
  const isPn = !key.includes("reverse");

  if (isPn) {
    const pnKey = key.split("-")[2];
    const cleanedValue = value.replace(/^"|"$/g, "");

    addContact(pnKey, cleanedValue);
  } else {
    const lidKey = key.split("-")[2].split("_")[0];
    const cleanedValue = value.replace(/^"|"$/g, "");

    addContact(cleanedValue, lidKey);
  }
}
