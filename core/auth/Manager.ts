import makeWASocket, {
  delay,
  jidNormalizedUser,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type CacheStore,
  type WASocket,
} from "baileys";
import { Boom } from "@hapi/boom";
import MAIN_LOGGER from "pino";
import NodeCache from "@cacheable/node-cache";
import {
  log,
  addSudo,
  Message,
  Plugins,
  getMessage,
  addContact,
  saveMessage,
  cacheGroupMetadata,
  cachedGroupMetadata,
  syncGroupMetadata,
  createSession,
  getSession,
  getAllSessions,
  deleteSession,
  updateSessionStatus,
  sessionExists,
  initializeSql,
  deleteUserTables,
  sanitizePhoneNumber,
  generateSessionId,
  updateSessionUserInfo,
} from "..";
import { useSessionAuth } from "./session";
import { type Session, SessionErrorType, StatusType } from "./types";
import { UserPausedStatus } from "./util";

const logger = MAIN_LOGGER({ level: "silent" });

interface RuntimeSession {
  client: WASocket | null;
  msgRetryCounterCache: CacheStore;
}

class SessionManager {
  private runtimeData: Map<string, RuntimeSession> = new Map();
  private static instance: SessionManager | null = null;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async create(
    phone: string,
  ): Promise<{ success: boolean; code?: string; error?: string; id?: string }> {
    const phone_number = sanitizePhoneNumber(phone);

    if (!phone_number) {
      log.debug("Invalid phone number format:", phone);
      return { success: false, error: "Invalid phone number format" };
    }

    const sessionId = generateSessionId(phone_number);

    log.debug("Creating new session:", sessionId);

    if (sessionExists(sessionId)) {
      log.debug("Session already exists:", sessionId);
      return {
        success: false,
        error: "Session already exists for this number",
      };
    }

    initializeSql(phone_number);
    log.debug("Initialized user tables for:", phone_number);

    const runtime: RuntimeSession = {
      client: null,
      msgRetryCounterCache: new NodeCache() as CacheStore,
    };
    this.runtimeData.set(sessionId, runtime);

    try {
      const code = await this.initializeSession(
        sessionId,
        phone_number,
        runtime,
        true,
      );
      createSession(sessionId, phone_number);
      log.debug("Session created:", sessionId);
      return { success: true, code, id: sessionId };
    } catch (error) {
      this.runtimeData.delete(sessionId);
      deleteUserTables(phone_number);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      log.error("Failed to create session:", sessionId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async initializeSession(
    sessionId: string,
    phoneNumber: string,
    runtime: RuntimeSession,
    requestPairingCode: boolean,
  ): Promise<string | undefined> {
    const dbSession = getSession(sessionId);
    if (dbSession && UserPausedStatus(dbSession.status)) {
      log.info(
        `Session ${sessionId} initialization skipped - session is paused in database`,
      );
      return undefined;
    }

    if (runtime.client) {
      log.info(
        `Session ${sessionId} initialization skipped - client already exists`,
      );
      return undefined;
    }

    log.debug("Initializing session:", sessionId);

    const { state, saveCreds } = await useSessionAuth(sessionId);
    const { version } = await fetchLatestBaileysVersion();

    log.debug("Baileys version:", version.join("."));

    const sessionGetMessage = async (key: any) =>
      await getMessage(sessionId, key);

    const sessionCachedGroupMetadata = async (id: string) =>
      await cachedGroupMetadata(sessionId, id);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      version,
      getMessage: sessionGetMessage,
      cachedGroupMetadata: sessionCachedGroupMetadata,
      msgRetryCounterCache: runtime.msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
    });

    runtime.client = sock;

    let pairingCode: string | undefined;

    if (requestPairingCode && !sock.authState.creds.registered) {
      log.debug("Requesting pairing code for session:", sessionId);
      await delay(10000);
      pairingCode = await sock.requestPairingCode(phoneNumber);
      log.info(
        `Session ${sessionId} pairing code: ${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`,
      );
    }

    this.setupEventHandlers(sessionId, phoneNumber, runtime, sock, saveCreds);

    return pairingCode;
  }

  private setupEventHandlers(
    sessionId: string,
    phoneNumber: string,
    runtime: RuntimeSession,
    sock: WASocket,
    saveCreds: () => Promise<void>,
  ): void {
    let hasSynced = false;

    sock.ev.process(async (events) => {
      if (events["connection.update"]) {
        const update = events["connection.update"];
        const { connection, lastDisconnect } = update;

        log.debug(
          `Session ${sessionId} connection update:`,
          connection || "no change",
        );

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          log.debug(
            `Session ${sessionId} disconnected with status code:`,
            statusCode,
          );

          runtime.client = null;

          if (statusCode !== DisconnectReason.loggedOut) {
            const dbSession = getSession(sessionId);
            if (dbSession?.status === StatusType.PausedUser) {
              log.info(
                `Session ${sessionId} reconnection skipped - session is paused by user`,
              );
              return;
            }

            updateSessionStatus(sessionId, StatusType.Connecting);
            log.info(`Session ${sessionId} reconnecting...`);
            this.initializeSession(
              sessionId,
              phoneNumber,
              runtime,
              false,
            ).catch((error) => {
              log.error(`Session ${sessionId} reconnection failed:`, error);
            });
          } else {
            updateSessionStatus(sessionId, StatusType.Inactive);
            log.error(`Session ${sessionId} logged out`);
          }
        }

        if (connection === "open") {
          updateSessionStatus(sessionId, StatusType.Active);
          log.info(`Session ${sessionId} connected to WhatsApp`);

          if (!hasSynced) {
            hasSynced = true;
            log.debug(`Syncing groups for session ${sessionId}`);
            addSudo(sessionId, sock.user.id, sock.user.lid);
            await delay(15000);
            await syncGroupMetadata(sessionId, sock);
            updateSessionUserInfo(sessionId, sock.user);
            log.info(`Session ${sessionId} group sync completed`);
          }
        }
      }

      if (events["creds.update"]) {
        await saveCreds();
      }

      if (events["messages.upsert"]) {
        const { messages, type } = events["messages.upsert"];
        await Promise.all(
          messages.map(async (message) => {
            try {
              saveMessage(sessionId, message.key, message);
              const msg = new Message(sock, message, sessionId);
              if (msg?.message?.protocolMessage?.type === 0) {
                sock.ev.emit("messages.delete", { keys: [msg.key] });
              }

              const cmd = new Plugins(msg, sock);
              await cmd.load("./core/plugins");
              await Promise.allSettled([cmd.text(), cmd.eventUser(type)]);
            } catch (error) {
              log.error(
                `Session ${sessionId} failed to handle message:`,
                error,
              );
            }
          }),
        );
      }

      if (events["lid-mapping.update"]) {
        const { pn, lid } = events["lid-mapping.update"];
        addContact(sessionId, pn, lid);
      }

      if (events["group-participants.update"]) {
        const { id, participants, action } =
          events["group-participants.update"];
        if (
          action === "remove" &&
          participants[0].id === jidNormalizedUser(sock.user.lid)
        ) {
          return;
        }
        const metadata = await sock.groupMetadata(id);
        cacheGroupMetadata(sessionId, metadata);
      }

      if (events["groups.update"]) {
        const updates = events["groups.update"];
        for (const update of updates) {
          try {
            const metadata = await sock.groupMetadata(update.id);
            cacheGroupMetadata(sessionId, metadata);
          } catch (e) {
            log.error("Group fetch failed:", e);
          }
        }
      }

      if (events["groups.upsert"]) {
        const groups = events["groups.upsert"];
        for (const group of groups) {
          try {
            const metadata = await sock.groupMetadata(group.id);
            cacheGroupMetadata(sessionId, metadata);
          } catch (e) {
            log.error("Group fetch failed:", e);
          }
        }
      }

      if (events["messages.delete"]) {
        log.debug(
          `Session ${sessionId} message deleted:`,
          events["messages.delete"],
        );
      }
    });
  }

  async delete(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    const dbSession = this.get(idOrPhone);
    if (!dbSession) {
      return { success: false, error: SessionErrorType.SessionNotFound };
    }

    const sessionId = dbSession.id;
    const phoneNumber = dbSession.phone_number;

    const runtime = this.runtimeData.get(sessionId);
    if (runtime?.client) {
      try {
        await runtime.client.logout();
      } catch (error) {
        log.debug(`Error logging out session ${sessionId}:`, error);
      }
      runtime.client = null;
    }

    this.runtimeData.delete(sessionId);
    deleteSession(sessionId);
    deleteUserTables(phoneNumber);

    log.info(`Session ${sessionId} deleted`);
    return { success: true };
  }

  list(): Session[] {
    return getAllSessions();
  }

  get(idOrPhone: string): Session | null {
    const i = sanitizePhoneNumber(idOrPhone);
    return getSession(i || idOrPhone);
  }

  async pause(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    const dbSession = this.get(idOrPhone);
    if (!dbSession) {
      return { success: false, error: "Session not found" };
    }

    const sessionId = dbSession.id;

    if (UserPausedStatus(dbSession.status)) {
      return { success: false, error: SessionErrorType.SessionPaused };
    }

    log.debug(`Pausing session ${sessionId}...`);

    updateSessionStatus(sessionId, StatusType.PausedUser);

    const runtime = this.runtimeData.get(sessionId);
    if (runtime?.client) {
      try {
        runtime.client.end(undefined);
      } catch (error) {
        log.debug(`Error ending client for session ${sessionId}:`, error);
      }
      runtime.client = null;
    }

    log.info(`Session ${sessionId} paused`);
    return { success: true };
  }

  async resume(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    const dbSession = this.get(idOrPhone);
    if (!dbSession) {
      return { success: false, error: "Session not found" };
    }

    const sessionId = dbSession.id;

    if (
      dbSession.status === StatusType.Connected ||
      dbSession.status === StatusType.Active ||
      dbSession.status === StatusType.Connecting
    ) {
      return { success: false, error: SessionErrorType.SessionAlreadyActive };
    }

    log.debug(`Resuming session ${sessionId}...`);

    let runtime = this.runtimeData.get(sessionId);
    if (!runtime) {
      runtime = {
        client: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
      };
      this.runtimeData.set(sessionId, runtime);
    }

    if (runtime.client) {
      try {
        runtime.client.end(undefined);
      } catch (error) {
        log.debug(`Error ending existing client for session ${sessionId}:`, error);
      }
      runtime.client = null;
    }

    updateSessionStatus(sessionId, StatusType.Connecting);

    try {
      await this.initializeSession(
        sessionId,
        dbSession.phone_number,
        runtime,
        false,
      );
      log.info(`Session ${sessionId} resumed`);
      return { success: true };
    } catch (error) {
      log.error(`Failed to resume session ${sessionId}:`, error);
      updateSessionStatus(sessionId, StatusType.PausedNetwork);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to resume session",
      };
    }
  }

  async restoreAllSessions(): Promise<void> {
    const sessions = getAllSessions();

    const sessionsToRestore = sessions.filter(
      (sessionRecord) =>
        sessionRecord.status !== StatusType.Inactive &&
        sessionRecord.status !== StatusType.PausedUser,
    );

    if (sessionsToRestore.length === 0) {
      return;
    }

    const restorationPromises = sessionsToRestore.map(async (sessionRecord) => {
      log.info(`Restoring session ${sessionRecord.id}...`);

      initializeSql(sessionRecord.phone_number);

      const runtime: RuntimeSession = {
        client: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
      };
      this.runtimeData.set(sessionRecord.id, runtime);

      try {
        await this.initializeSession(
          sessionRecord.id,
          sessionRecord.phone_number,
          runtime,
          false,
        );
      } catch (error) {
        log.error(`Failed to restore session ${sessionRecord.id}:`, error);
        updateSessionStatus(sessionRecord.id, StatusType.Disconnected);
      }
    });

    await Promise.allSettled(restorationPromises);
  }

  getActiveCount(): number {
    return getAllSessions().filter(
      (s) =>
        s.status === StatusType.Connected || s.status === StatusType.Active,
    ).length;
  }

  listExtended(): Session[] {
    const dbSessions = getAllSessions();
    log.debug("Listing extended sessions, count:", dbSessions.length);
    log.debug("session object:", dbSessions);

    return dbSessions.map((dbSession) => {
      const runtime = this.runtimeData.get(dbSession.id);
      return {
        ...dbSession,
        user_info: runtime?.client?.user ?? dbSession.user_info ?? null,
      };
    });
  }

  getClient(sessionId: string): WASocket | null {
    return this.runtimeData.get(sessionId)?.client ?? null;
  }
}

export const sessionManager = SessionManager.getInstance();
