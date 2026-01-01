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
import { type Session, type NetworkState, SessionErrorType, StatusType } from "./types";
import { UserPausedStatus } from "./util";

const logger = MAIN_LOGGER({ level: "silent" });

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private static instance: SessionManager | null = null;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Create a new session for the given phone number
   */
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

    if (sessionExists(sessionId) || this.sessions.has(sessionId)) {
      log.debug("Session already exists:", sessionId);
      return {
        success: false,
        error: "Session already exists for this number",
      };
    }

    initializeSql(phone_number);
    log.debug("Initialized user tables for:", phone_number);

    const sessionState: Session = {
      id: sessionId,
      client: null,
      phone_number,
      status: StatusType.Pairing,
      msgRetryCounterCache: new NodeCache() as CacheStore,
      created_at: Date.now(),
    };

    this.sessions.set(sessionId, sessionState);

    try {
      const code = await this.initializeSession(sessionState, true);
      createSession(sessionId, phone_number);
      log.debug("Session created:", sessionId);
      return { success: true, code, id: sessionId };
    } catch (error) {
      this.sessions.delete(sessionId);
      deleteUserTables(phone_number);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      log.error("Failed to create session:", sessionId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Initialize a WhatsApp session
   */
  private async initializeSession(
    session: Session,
    requestPairingCode: boolean,
  ): Promise<string | undefined> {
    log.debug("Session State:", session);

    if (UserPausedStatus(session.status)) {
      log.info(
        `Session ${session.id} initialization skipped - session is paused`,
      );
      return undefined;
    }

    const dbSession = getSession(session.id);
    if (dbSession && UserPausedStatus(dbSession.status)) {
      log.info(
        `Session ${session.id} initialization skipped - session is paused in database`,
      );

      if (dbSession.status === StatusType.PausedUser) {
        session.status = StatusType.PausedUser;
      } else if (dbSession.status === StatusType.PausedNetwork) {
        session.status = StatusType.PausedNetwork;
      }
      return undefined;
    }

    log.debug("Initializing session:", session.id);
    const session_state = getSession(session.id);

    const { state, saveCreds } = await useSessionAuth(session.id);
    const { version } = await fetchLatestBaileysVersion();

    log.debug("Baileys version:", version.join("."));

    const sessionGetMessage = async (key: any) =>
      await getMessage(session.id, key);

    const sessionCachedGroupMetadata = async (id: string) =>
      await cachedGroupMetadata(session.id, id);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      version,
      getMessage: sessionGetMessage,
      cachedGroupMetadata: sessionCachedGroupMetadata,
      msgRetryCounterCache: session.msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
    });

    session.client = sock;

    let pairingCode: string | undefined;

    if (requestPairingCode && !sock.authState.creds.registered) {
      log.debug("Requesting pairing code for session:", session.id);
      await delay(10000);
      pairingCode = await sock.requestPairingCode(session.phone_number);
      log.info(
        `Session ${session.id} pairing code: ${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`,
      );
    }

    this.setupEventHandlers(session, sock, saveCreds);

    return pairingCode;
  }

  /**
   * Set up event handlers for a session
   */
  private setupEventHandlers(
    session: Session,
    sock: WASocket,
    saveCreds: () => Promise<void>,
  ): void {
    let hasSynced = false;

    sock.ev.process(async (events) => {
      if (events["connection.update"]) {
        const update = events["connection.update"];
        const { connection, lastDisconnect } = update;

        log.debug(
          `Session ${session.id} connection update:`,
          connection || "no change",
        );

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          log.debug(
            `Session ${session.id} disconnected with status code:`,
            statusCode,
          );
          if (statusCode !== DisconnectReason.loggedOut) {
            const session_status = getSession(session.id).status;
            if (session_status === StatusType.PausedUser) {
              log.info(
                `Session ${session.id} reconnection skipped - session is paused by user`,
              );
              return;
            }

            session.status = StatusType.Connecting;
            log.info(`Session ${session.id} reconnecting...`);
          } else {
            session.status = StatusType.Disconnected;
            updateSessionStatus(session.id, StatusType.Inactive);
            log.error(`Session ${session.id} logged out`);
          }
        }

        if (connection === "open") {
          session.status = StatusType.Connected;
          updateSessionStatus(session.id, StatusType.Active);
          log.info(`Session ${session.id} connected to WhatsApp`);

          if (!hasSynced) {
            hasSynced = true;
            log.debug(`Syncing groups for session ${session.id}`);
            addSudo(session.id, sock.user.id, sock.user.lid);
            await delay(15000);
            await syncGroupMetadata(session.id, sock);
            updateSessionUserInfo(session.id, sock.user);
            log.info(`Session ${session.id} group sync completed`);
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
              saveMessage(session.id, message.key, message);
              const msg = new Message(sock, message, session.id);
              if (msg?.message?.protocolMessage?.type === 0) {
                sock.ev.emit("messages.delete", { keys: [msg.key] });
              }

              const cmd = new Plugins(msg, sock);
              await cmd.load("./core/modules");
              await Promise.allSettled([cmd.text(), cmd.eventUser(type)]);
            } catch (error) {
              log.error(
                `Session ${session.id} failed to handle message:`,
                error,
              );
            }
          }),
        );
      }

      if (events["lid-mapping.update"]) {
        const { pn, lid } = events["lid-mapping.update"];
        addContact(session.id, pn, lid);
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
        cacheGroupMetadata(session.id, metadata);
      }

      if (events["groups.update"]) {
        const updates = events["groups.update"];
        for (const update of updates) {
          try {
            const metadata = await sock.groupMetadata(update.id);
            cacheGroupMetadata(session.id, metadata);
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
            cacheGroupMetadata(session.id, metadata);
          } catch (e) {
            log.error("Group fetch failed:", e);
          }
        }
      }

      if (events["messages.delete"]) {
        log.debug(
          `Session ${session.id} message deleted:`,
          events["messages.delete"],
        );
      }
    });
  }

  /**
   * Delete a session by ID or phone number
   */
  async delete(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    let sessionId = idOrPhone;
    let phoneNumber: string | null = null;
    const i = sanitizePhoneNumber(idOrPhone);

    if (i) {
      const record = getSession(i);
      if (record) {
        sessionId = record.id;
        phoneNumber = record.phone_number;
      } else {
        sessionId = generateSessionId(i);
        phoneNumber = i;
      }
    } else {
      const record = getSession(idOrPhone);
      if (record) {
        phoneNumber = record.phone_number;
      }
    }

    const activeSession = this.sessions.get(sessionId);
    if (activeSession?.client) {
      await activeSession.client.logout();

      activeSession.client = null;
      phoneNumber = phoneNumber || activeSession.phone_number;
    }

    this.sessions.delete(sessionId);
    const deleted = deleteSession(sessionId) || deleteSession(idOrPhone);

    if (!deleted && !activeSession) {
      return { success: false, error: SessionErrorType.SessionNotFound };
    }

    if (phoneNumber) {
      deleteUserTables(phoneNumber);
    }

    log.info(`Session ${sessionId} deleted`);
    return { success: true };
  }

  /**
   * List all sessions
   */
  list(): Session[] {
    return getAllSessions();
  }

  /**
   * Get a specific session
   */
  get(idOrPhone: string): Session | null {
    const i = sanitizePhoneNumber(idOrPhone);
    return getSession(i || idOrPhone);
  }

  /**
   * Pause a session (disconnect but keep in memory for quick resume)
   */
  async pause(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    const sessionId = this.resolveSessionId(idOrPhone);
    if (!sessionId) {
      return { success: false, error: "Session not found" };
    }

    const activeSession = this.sessions.get(sessionId);
    if (!activeSession) {
      return { success: false, error: "Session not active" };
    }

    log.debug("Session To Be Paused:", activeSession);

    if (UserPausedStatus(activeSession.status)) {
      return { success: false, error: SessionErrorType.SessionPaused };
    }

    log.debug(`Pausing session ${sessionId}...`);

    if (activeSession.client) {
      try {
        activeSession.client.end(undefined);
      } catch (error) {
        log.debug(`Error ending client for session ${sessionId}:`, error);
      }
      activeSession.client = null;
    }

    activeSession.status = StatusType.PausedUser;

    log.debug("Session Status:", activeSession);

    updateSessionStatus(sessionId, StatusType.PausedUser);

    log.info(`Session ${sessionId} paused`);
    return { success: true };
  }

  /**
   * Resume a paused session
   */
  async resume(
    idOrPhone: string,
  ): Promise<{ success: boolean; error?: string }> {
    const sessionId = this.resolveSessionId(idOrPhone);
    if (!sessionId) {
      return { success: false, error: "Session not found" };
    }

    let activeSession = this.sessions.get(sessionId);

    if (!activeSession) {
      const dbSession = getSession(sessionId);
      if (!dbSession) {
        return { success: false, error: "Session not found" };
      }

      activeSession = {
        id: sessionId,
        phone_number: dbSession.phone_number,
        client: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
        status: StatusType.Connecting,
      };
      this.sessions.set(sessionId, activeSession);
    }

    if (
      activeSession.status === StatusType.Connected ||
      activeSession.status === StatusType.Connecting
    ) {
      return { success: false, error: SessionErrorType.SessionAlreadyActive };
    }

    log.debug(`Resuming session ${sessionId}...`);

    activeSession.status = StatusType.Connecting;

    try {
      await this.initializeSession(activeSession, false);
      log.info(`Session ${sessionId} resumed`);
      return { success: true };
    } catch (error) {
      log.error(`Failed to resume session ${sessionId}:`, error);
      activeSession.status = StatusType.PausedNetwork;
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to resume session",
      };
    }
  }

  /**
   * Helper to resolve session ID from ID or phone number
   */
  private resolveSessionId(idOrPhone: string): string | null {
    const i = sanitizePhoneNumber(idOrPhone);
    const record = getSession(i || idOrPhone);
    return record?.id || null;
  }

  /**
   * Restore all sessions from database on startup
   */
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

    // Restore sessions concurrently for faster startup
    const restorationPromises = sessionsToRestore.map(async (sessionRecord) => {
      log.info(`Restoring session ${sessionRecord.id}...`);

      initializeSql(sessionRecord.phone_number);

      const activeSession: Session = {
        id: sessionRecord.id,
        phone_number: sessionRecord.phone_number,
        client: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
        status: StatusType.Connecting,
      };

      this.sessions.set(sessionRecord.id, activeSession);

      try {
        await this.initializeSession(activeSession, false);
      } catch (error) {
        log.error(`Failed to restore session ${sessionRecord.id}:`, error);
        activeSession.status = StatusType.Disconnected;
      }
    });

    await Promise.allSettled(restorationPromises);
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return [...this.sessions.values()].filter(
      (s) => s.status === StatusType.Connected,
    ).length;
  }

  /**
   * List all sessions with extended information
   * Includes user_info and current status from active sessions
   */
  listExtended(): Session[] {
    const dbSessions = getAllSessions();

    return dbSessions.map((dbSession) => {
      const activeSession = this.sessions.get(dbSession.id);
      return {
        ...dbSession,
        status: activeSession?.status ?? dbSession.status,
        user_info: activeSession?.client?.user ?? dbSession.user_info ?? null,
      };
    });
  }

  /**
   * Get the current network state
   */
  getNetworkState(): NetworkState {
    return {
      isHealthy: true,
      consecutiveFailures: 0,
      lastCheck: Date.now(),
      isPaused: false,
    };
  }
}

export const sessionManager = SessionManager.getInstance();
