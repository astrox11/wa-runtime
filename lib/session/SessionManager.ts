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
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
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
  deleteSession as deleteSessionRecord,
  updateSessionStatus,
  sessionExists,
  type SessionRecord,
} from "../";
import { useSessionAuth } from "./auth";

const logger = MAIN_LOGGER({ level: "silent" });

interface ActiveSession {
  id: string;
  phoneNumber: string;
  socket: WASocket | null;
  msgRetryCounterCache: CacheStore;
  status: "connecting" | "connected" | "disconnected" | "pairing";
}

class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private static instance: SessionManager | null = null;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Sanitize and validate phone number, ensuring it includes country code without +
   */
  sanitizePhoneNumber(phoneNumber: string): string | null {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, "");

    // Ensure it starts with + for validation
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    if (!isValidPhoneNumber(cleaned)) {
      return null;
    }

    // Parse and format to E.164, then remove the +
    const parsed = parsePhoneNumber(cleaned);
    return parsed.number.replace("+", "");
  }

  /**
   * Generate a unique session ID from phone number
   */
  private generateSessionId(phoneNumber: string): string {
    return `session_${phoneNumber}`;
  }

  /**
   * Create a new session for the given phone number
   */
  async create(
    phoneNumber: string,
  ): Promise<{ success: boolean; code?: string; error?: string; id?: string }> {
    const sanitized = this.sanitizePhoneNumber(phoneNumber);
    if (!sanitized) {
      return { success: false, error: "Invalid phone number format" };
    }

    // Check if session already exists
    if (sessionExists(sanitized) || this.sessions.has(sanitized)) {
      return {
    const sessionId = this.generateSessionId(sanitized);

    // Check if session already exists
    if (sessionExists(sessionId) || this.sessions.has(sessionId)) {
      return { success: false, error: "Session already exists for this number" };
    }
    // Create session record in database
    createSession(sessionId, sanitized);

    // Initialize session
    const activeSession: ActiveSession = {
      id: sessionId,
      phoneNumber: sanitized,
      socket: null,
      msgRetryCounterCache: new NodeCache() as CacheStore,
      status: "pairing",
    };

    this.sessions.set(sessionId, activeSession);

    try {
      const code = await this.initializeSession(activeSession, true);
      return { success: true, code, id: sessionId };
    } catch (error) {
      // Cleanup on failure
      this.sessions.delete(sessionId);
      deleteSessionRecord(sessionId);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Initialize a WhatsApp session
   */
  private async initializeSession(
    session: ActiveSession,
    requestPairingCode: boolean,
  ): Promise<string | undefined> {
    const { state, saveCreds } = await useSessionAuth(session.id);
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
      msgRetryCounterCache: session.msgRetryCounterCache,
      generateHighQualityLinkPreview: true,
    });

    session.socket = sock;

    let pairingCode: string | undefined;

    // Request pairing code if needed
    if (requestPairingCode && !sock.authState.creds.registered) {
      await delay(10000);
      pairingCode = await sock.requestPairingCode(session.phoneNumber);
      log.info(
        `Session ${session.id} pairing code: ${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`,
      );
    }

    // Set up event handlers
    this.setupEventHandlers(session, sock, saveCreds);

    return pairingCode;
  }

  /**
   * Set up event handlers for a session
   */
  private setupEventHandlers(
    session: ActiveSession,
    sock: WASocket,
    saveCreds: () => Promise<void>,
  ): void {
    let hasSynced = false;

    sock.ev.process(async (events) => {
      if (events["connection.update"]) {
        const update = events["connection.update"];
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          if (statusCode !== DisconnectReason.loggedOut) {
            // Reconnect
            session.status = "connecting";
            log.info(`Session ${session.id} reconnecting...`);
            await this.initializeSession(session, false);
          } else {
            // Logged out - cleanup
            session.status = "disconnected";
            updateSessionStatus(session.id, "inactive");
            log.error(`Session ${session.id} logged out`);
          }
        }

        if (connection === "open") {
          session.status = "connected";
          updateSessionStatus(session.id, "active");
          log.info(`Session ${session.id} connected to WhatsApp`);

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
        addContact(pn, lid);
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
    // Try to find session by ID first, then by phone number
    let sessionId = idOrPhone;
    const sanitized = this.sanitizePhoneNumber(idOrPhone);

    if (sanitized) {
      const record = getSession(sanitized);
      if (record) {
        sessionId = record.id;
      } else {
        sessionId = this.generateSessionId(sanitized);
      }
    }

    const activeSession = this.sessions.get(sessionId);
    if (activeSession?.socket) {
      try {
        await activeSession.socket.logout();
      } catch {
        // Ignore logout errors
      }
      activeSession.socket = null;
    }

    this.sessions.delete(sessionId);
    const deleted =
      deleteSessionRecord(sessionId) || deleteSessionRecord(idOrPhone);

    if (!deleted && !activeSession) {
      return { success: false, error: "Session not found" };
    }

    log.info(`Session ${sessionId} deleted`);
    return { success: true };
  }

  /**
   * List all sessions
   */
  list(): SessionRecord[] {
    return getAllSessions();
  }

  /**
   * Get a specific session
   */
  get(idOrPhone: string): SessionRecord | null {
    const sanitized = this.sanitizePhoneNumber(idOrPhone);
    return getSession(sanitized || idOrPhone);
  }

  /**
   * Restore all sessions from database on startup
   */
  async restoreAllSessions(): Promise<void> {
    const sessions = getAllSessions();

    for (const sessionRecord of sessions) {
      if (sessionRecord.status === "inactive") {
        continue;
      }

      log.info(`Restoring session ${sessionRecord.id}...`);

      const activeSession: ActiveSession = {
        id: sessionRecord.id,
        phoneNumber: sessionRecord.phone_number,
        socket: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
        status: "connecting",
      };

      this.sessions.set(sessionRecord.id, activeSession);

      try {
        await this.initializeSession(activeSession, false);
      } catch (error) {
        log.error(`Failed to restore session ${sessionRecord.id}:`, error);
        activeSession.status = "disconnected";
      }
    }
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return [...this.sessions.values()].filter((s) => s.status === "connected")
      .length;
  }
}

export const sessionManager = SessionManager.getInstance();
