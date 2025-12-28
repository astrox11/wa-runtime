import makeWASocket, {
  delay,
  jidNormalizedUser,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type CacheStore,
} from "baileys";
import {
  log,
  addSudo,
  Message,
  Plugins,
  getMessage,
  addContact,
  saveMessage,
  useBunqlAuth,
  cacheGroupMetadata,
  cachedGroupMetadata,
  syncGroupMetadata,
  verify_user_phone_number,
  sessionManager,
} from "./lib";
import {
  isSessionCommand,
  getSessionArgs,
  handleSessionCommand,
  SESSION_COMMANDS,
} from "./cli";
import { rm } from "fs/promises";
import { Boom } from "@hapi/boom";
import MAIN_LOGGER from "pino";
import NodeCache from "@cacheable/node-cache";

const msgRetryCounterCache = new NodeCache() as CacheStore;
const logger = MAIN_LOGGER({
  level: "silent",
});

/**
 * Start the legacy single-session mode using PHONE_NUMBER from config/.env
 */
const startLegacySession = async () => {
  const phone = verify_user_phone_number();
  const { state, saveCreds } = await useBunqlAuth();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    version,
    getMessage,
    cachedGroupMetadata,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
  });

  if (!sock.authState.creds.registered) {
    await delay(10000);
    const code = await sock.requestPairingCode(phone?.replace(/\D+/g, ""));
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
          startLegacySession();
        } else {
          ["database.db", "database.dn-shm", "database.db-wal"].forEach(
            async (file) => await rm(file, { force: true }),
          );
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
      const { messages, type } = events["messages.upsert"];
      // Fire everything at once
      await Promise.all(
        messages.map(async (message) => {
          try {
            saveMessage(message.key, message);
            const msg = new Message(sock, message);
            if (msg?.message?.protocolMessage?.type === 0) {
              sock.ev.emit("messages.delete", { keys: [msg.key] });
            }

            const cmd = new Plugins(msg, sock);
            await cmd.load("./lib/modules");
            await Promise.allSettled([cmd.text(), cmd.eventUser(type)]);
          } catch (error) {
            log.error(`failed to handle_message:`, error);
            // Continue processing other messages
          }
        }),
      );
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

/**
 * Main entry point - handles CLI commands or starts sessions
 */
const main = async () => {
  const args = process.argv.slice(2);

  // Handle session CLI commands
  if (isSessionCommand(args)) {
    const sessionArgs = getSessionArgs(args);
    const result = await handleSessionCommand(sessionArgs);

    if (result.success) {
      log.info(result.message);
    } else {
      log.error(result.message);
      process.exit(1);
    }

    // For create command, keep process running to complete pairing
    if (sessionArgs[0]?.toLowerCase() === SESSION_COMMANDS.CREATE && result.success) {
      log.info("Waiting for pairing to complete...");
      // Process stays alive for pairing
      return;
    }

    // For list/delete, exit after completion
    process.exit(0);
  }

  // No CLI command - start in normal mode
  // First, restore any existing sessions from database
  const sessions = sessionManager.list();

  if (sessions.length > 0) {
    log.info(`Found ${sessions.length} existing session(s), restoring...`);
    await sessionManager.restoreAllSessions();
    log.info("All sessions restored. Running in multi-session mode.");
  } else {
    // No sessions in database - start legacy single-session mode
    log.info("Starting in single-session mode...");
    await startLegacySession();
  }
};

main();
