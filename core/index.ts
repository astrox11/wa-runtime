import {
  useHybridAuthState,
  getMessage,
  saveMessage,
  cachedGroupMetadata,
  cacheGroupMetadata,
  syncGroupMetadata,
  syncGroupParticipantsToContactList,
} from "auth";
import makeWASocket, {
  delay,
  DisconnectReason,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  type CacheStore,
} from "baileys";
import pino from "pino";
import NodeCache from "@cacheable/node-cache";
import { createClient } from "redis";
import seralize from "seralize";
import { handleCommand, logForGo } from "./util";
import { loadPlugins } from "plugins/_definition";

const logger = pino({
  level: "trace",
  transport: {
    target: "pino/file",
    options: { destination: "./wa-logs.txt" },
    level: "trace",
  },
});

const redis = createClient({ url: "redis://localhost:6379" });
redis.on("error", (err) => console.log("Redis Client Error", err));

await redis.connect();
await loadPlugins();

const msgRetryCounterCache = new NodeCache() as CacheStore;

const Client = async (phone = process.argv?.[2]) => {
  if (!phone) throw new Error("Phone number is required");

  const { state, saveCreds } = await useHybridAuthState(redis, phone);

  const sock = makeWASocket({
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    getMessage,
    cachedGroupMetadata,
  });

  if (!sock.authState?.creds?.registered) {
    await delay(5000);
    console.log("Client not registered");
    const code = await sock.requestPairingCode(phone, "12345678");
    logForGo("PAIRING_CODE", { code });
  }

  sock.ev.process(async (events) => {
    if (events["connection.update"]) {
      const update = events["connection.update"];
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        if (
          (lastDisconnect?.error as any)?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          logForGo("CONNECTION_UPDATE", { status: "needs_restart", phone });
          await delay(10000);
          Client();
        } else {
          logForGo("CONNECTION_UPDATE", { status: "logged_out", phone });
          console.log("Connection closed. You are logged out.");
        }
      }
      if (connection === "open") {
        logForGo("CONNECTION_UPDATE", { status: "connected", phone });
        await delay(15000);
        await syncGroupMetadata(phone, sock);
      }
    }
    if (events["creds.update"]) {
      await saveCreds();
    }

    if (events["messages.upsert"]) {
      const { messages } = events["messages.upsert"];
      for (const msg of messages) {
        const m = await seralize(
          JSON.parse(JSON.stringify({ ...msg, session: phone })),
          sock
        );
        await handleCommand(m);
        await saveMessage(m, phone);
      }
    }

    if (events["group-participants.update"]) {
      const { id, participants, action } = events["group-participants.update"];
      const firstParticipant = participants[0];
      if (
        action === "remove" &&
        firstParticipant &&
        sock.user?.lid &&
        firstParticipant.id === jidNormalizedUser(sock.user.lid)
      ) {
        return;
      }
      const metadata = await sock.groupMetadata(id);
      await cacheGroupMetadata(phone, metadata);
      await syncGroupParticipantsToContactList(phone, metadata);
    }

    if (events["groups.upsert"]) {
      const groups = events["groups.upsert"];
      for (const group of groups) {
        try {
          const metadata = await sock.groupMetadata(group.id);
          await cacheGroupMetadata(phone, metadata);
        } catch (e) {
          console.error(e);
        }
      }
    }

    if (events["groups.update"]) {
      const updates = events["groups.update"];
      for (const update of updates) {
        try {
          if (update.id) {
            const metadata = await sock.groupMetadata(update.id);
            await cacheGroupMetadata(phone, metadata);
            await syncGroupParticipantsToContactList(phone, metadata);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  });

  return sock;
};

Client();
