import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  type CacheStore,
  useMultiFileAuthState,
} from "baileys";
import { Boom } from "@hapi/boom";
import MAIN_LOGGER from "pino";
import NodeCache from "@cacheable/node-cache";
import {
  log,
  parseEnv,
  getMessage,
  findEnvFile,
  Message,
  Plugins,
  useBunqlAuth,
} from "./lib";

const msgRetryCounterCache = new NodeCache() as CacheStore;
const groupCache = new NodeCache({
  stdTTL: 5 * 60,
  useClones: false,
}) as CacheStore;
const logger = MAIN_LOGGER({ level: "silent" });
const config = findEnvFile("./");

const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('test');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    msgRetryCounterCache,
    getMessage,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    generateHighQualityLinkPreview: true,
  });

  if (!sock.authState.creds.registered) {
    await delay(10000);
    const phone = parseEnv(config || "").PHONE_NUMBER?.replace(/\D+/g, "");
    if (phone.length < 10)
      return log.error("Invalid PHONE_NUMBER in .env file");
    const code = await sock.requestPairingCode(phone);
    log.info(`Code: ${code.slice(0, 4)}-${code.slice(4)}`);
  }

  sock.ev.on("creds.update", async () => await saveCreds());

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    log.info(`Connection status: ${connection}`);

    if (connection === "open") log.info("Connected");

    if (connection === "close") {
      const status = (lastDisconnect?.error as Boom)?.output?.statusCode;
      log.info(`Disconnect status: ${status}`);

      if (status !== DisconnectReason.loggedOut) {
        log.info("Reconnecting...");
        start();
      } else {
        log.error("Logged out. Please restart the application.");
      }
    }
  });

  sock.ev.on("groups.update", async ([event]) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {
      /** */
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {
      /** */
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      const m = new Message(sock, msg);

      if (m.isGroup) {
        const exists = groupCache.get(m.chat);
        if (!exists) {
          try {
            const metadata = await sock.groupMetadata(m.chat);
            groupCache.set(m.chat, metadata);
          } catch {
            /** */
          }
        }
      }

      const p = new Plugins(m, sock);
      await p.load("./lib/cmd");
      p.text();
      p.sticker();
      p.event();
    }
  });
};
start();
