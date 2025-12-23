import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  type CacheStore,
  jidNormalizedUser,
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
  cachedGroupMetadata,
  saveMessage,
  addContact,
  cacheGroupMetadata,
  syncGroupMetadata,
  addSudo,
} from "./lib";
import { isValidPhoneNumber as vaildate } from "libphonenumber-js";

const msgRetryCounterCache = new NodeCache() as CacheStore;
const logger = MAIN_LOGGER({
  level: "silent",
});
const config = findEnvFile("./");
const phone = parseEnv(config || "").PHONE_NUMBER?.replace(/\D+/g, "");

const start = async () => {
  if (!vaildate(`+${phone}`)) {
    return log.error("Invalid PHONE_NUMBER in .env file");
  }
  const { state, saveCreds } = await useBunqlAuth();
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
    cachedGroupMetadata,
    generateHighQualityLinkPreview: true,
  });

  if (!sock.authState.creds.registered) {
    await delay(10000);
    const code = await sock.requestPairingCode(phone);
    log.info(`Code: ${code.slice(0, 4)}-${code.slice(4)}`);
  }

  sock.ev.process(async (events) => {
    let hasSynced = false;

    if (events["connection.update"]) {
      const update = events["connection.update"];
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        if (
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          start();
        } else {
          log.error("Connection closed. You are logged out.");
        }
      }
      if (connection === "open") {
        log.info("Connected to WhatsApp");
        if (!hasSynced) {
          hasSynced = true;
          addSudo(sock.user.id, sock.user.lid);
          await delay(15000);
          await syncGroupMetadata(sock);
        }
      }
    }

    if (events["creds.update"]) {
      await saveCreds();
    }

    if (events["messages.upsert"]) {
      const { messages } = events["messages.upsert"];
      for (const msg of messages) {
        saveMessage(msg.key, msg);
        const m = new Message(sock, msg);

        if (m?.message?.protocolMessage?.type === 0) {
          sock.ev.emit("messages.delete", { keys: [m.key] });
        }

        const p = new Plugins(m, sock);
        await p.load("./lib/modules");
        p.text();
        p.sticker();
        p.event();
      }
    }

    if (events["lid-mapping.update"]) {
      const { pn, lid } = events["lid-mapping.update"];
      addContact(pn, lid);
    }

    if (events["group-participants.update"]) {
      const { id, participants, action } = events["group-participants.update"];
      if (
        action == "remove" &&
        participants[0].id == jidNormalizedUser(sock.user.lid)
      ) {
        return;
      }
      const metadata = await sock.groupMetadata(id);
      cacheGroupMetadata(metadata);
    }

    if (events["groups.update"]) {
      const updates = events["groups.update"];
      for (const update of updates) {
        const metadata = await sock.groupMetadata(update.id);
        cacheGroupMetadata(metadata);
      }
    }

    if (events["groups.upsert"]) {
      const groups = events["groups.upsert"];
      for (const group of groups) {
        const metadata = await sock.groupMetadata(group.id);
        cacheGroupMetadata(metadata);
      }
    }

    if (events["messages.delete"]) {
      log.debug("Message deleted:", events["messages.delete"]);
    }
  });
};

start();
