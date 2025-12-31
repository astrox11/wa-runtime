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
import parsePhoneNumberFromString, {
  isValidPhoneNumber,
} from "libphonenumber-js";
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
  updateSessionPushName,
  sessionExists,
  initializeUserTables,
  deleteUserTables,
  type SessionRecord,
} from "../";
import { useSessionAuth } from "./auth";

const logger = MAIN_LOGGER({ level: "silent" });

interface ActiveSession {
  id: string;
  phoneNumber: string;
  socket: WASocket | null;
  msgRetryCounterCache: CacheStore;
  status: "connecting" | "connected" | "disconnected" | "pairing" | "paused";
  pushNameInterval?: ReturnType<typeof setInterval>;
}

/**
 * Network monitoring state
 */
interface NetworkState {
  isHealthy: boolean;
  consecutiveFailures: number;
  lastCheck: number;
  isPaused: boolean;
}

class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private static instance: SessionManager | null = null;
  private networkState: NetworkState = {
    isHealthy: true,
    consecutiveFailures: 0,
    lastCheck: Date.now(),
    isPaused: false,
  };
  private networkCheckInterval?: ReturnType<typeof setInterval>;

  // Configurable thresholds
  private static readonly NETWORK_FAILURE_THRESHOLD = 3;
  private static readonly NETWORK_CHECK_INTERVAL_MS = 5000;
  private static readonly PUSHNAME_CHECK_INTERVAL_MS = 10000;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  constructor() {
    // Start network monitoring
    this.startNetworkMonitoring();
  }

  /**
   * Start continuous network health monitoring
   */
  private startNetworkMonitoring() {
    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkHealth();
    }, SessionManager.NETWORK_CHECK_INTERVAL_MS);
  }

  /**
   * Check network health and pause/resume sessions accordingly
   */
  private checkNetworkHealth() {
    const now = Date.now();
    this.networkState.lastCheck = now;

    // Count disconnected sessions
    const disconnectedCount = [...this.sessions.values()].filter(
      (s) => s.status === "disconnected" || s.status === "connecting",
    ).length;

    const totalSessions = this.sessions.size;

    log.debug(
      `Network health check: ${disconnectedCount}/${totalSessions} sessions disconnected`,
    );

    // If more than half of sessions are disconnected, assume network issue
    if (
      totalSessions > 0 &&
      disconnectedCount >= Math.ceil(totalSessions / 2)
    ) {
      this.networkState.consecutiveFailures++;

      log.debug(
        `Network failures: ${this.networkState.consecutiveFailures}/${SessionManager.NETWORK_FAILURE_THRESHOLD}`,
      );

      if (
        this.networkState.consecutiveFailures >=
        SessionManager.NETWORK_FAILURE_THRESHOLD
      ) {
        if (!this.networkState.isPaused) {
          this.pauseAllSessions();
        }
        this.networkState.isHealthy = false;
      }
    } else {
      // Network is healthy
      this.networkState.consecutiveFailures = 0;

      if (this.networkState.isPaused && !this.networkState.isHealthy) {
        // Resume sessions when network recovers
        this.resumeAllSessions();
      }
      this.networkState.isHealthy = true;
    }
  }

  /**
   * Pause all sessions to prevent reconnection spam
   */
  private pauseAllSessions() {
    log.warn(
      "Network appears unhealthy, pausing all sessions to prevent reconnection spam",
    );
    this.networkState.isPaused = true;
  }

  /**
   * Resume all sessions after network recovery
   */
  private resumeAllSessions() {
    log.info("Network recovered, resuming sessions");
    this.networkState.isPaused = false;

    // Restart disconnected sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.status === "disconnected") {
        log.info(`Resuming session ${sessionId}...`);
        this.initializeSession(session, false).catch((error) => {
          log.error(`Failed to resume session ${sessionId}:`, error);
        });
      }
    }
  }

  /**
   * Get network state for monitoring
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Start continuous pushName fetching for a session
   */
  private startPushNameFetching(session: ActiveSession) {
    // Clear existing interval if any
    if (session.pushNameInterval) {
      clearInterval(session.pushNameInterval);
    }

    // Check immediately
    this.fetchAndSavePushName(session);

    // Then check periodically until we have it
    session.pushNameInterval = setInterval(() => {
      const dbSession = getSession(session.id);

      // Stop checking once we have a pushName saved
      if (dbSession?.push_name) {
        if (session.pushNameInterval) {
          clearInterval(session.pushNameInterval);
          session.pushNameInterval = undefined;
        }
        return;
      }

      this.fetchAndSavePushName(session);
    }, SessionManager.PUSHNAME_CHECK_INTERVAL_MS);
  }

  /**
   * Fetch pushName from socket and save to database
   */
  private fetchAndSavePushName(session: ActiveSession) {
    if (session.socket?.user?.name) {
      const pushName = session.socket.user.name;
      updateSessionPushName(session.id, pushName);
      log.debug(`Saved pushName "${pushName}" for session ${session.id}`);

      // Clear interval once saved
      if (session.pushNameInterval) {
        clearInterval(session.pushNameInterval);
        session.pushNameInterval = undefined;
      }
    }
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
    const parsed = parsePhoneNumberFromString(cleaned);
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
      log.debug("Invalid phone number format:", phoneNumber);
      return { success: false, error: "Invalid phone number format" };
    }

    const sessionId = this.generateSessionId(sanitized);

    log.debug("Creating new session:", sessionId);

    // Check if session already exists
    if (sessionExists(sessionId) || this.sessions.has(sessionId)) {
      log.debug("Session already exists:", sessionId);
      return {
        success: false,
        error: "Session already exists for this number",
      };
    }

    // Initialize user-specific database tables
    initializeUserTables(sanitized);
    log.debug("Initialized user tables for:", sanitized);

    // Initialize session in memory first (before database record)
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
      // Create database record only after successful initialization
      createSession(sessionId, sanitized);
      log.debug("Session created successfully:", sessionId);
      return { success: true, code, id: sessionId };
    } catch (error) {
      // Cleanup on failure - only need to remove from memory since DB record wasn't created
      this.sessions.delete(sessionId);
      deleteUserTables(sanitized);
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
    session: ActiveSession,
    requestPairingCode: boolean,
  ): Promise<string | undefined> {
    // Check if network is paused
    if (this.networkState.isPaused) {
      log.info(
        `Session ${session.id} initialization deferred due to network pause`,
      );
      session.status = "disconnected";
      return undefined;
    }

    log.debug("Initializing session:", session.id);

    const { state, saveCreds } = await useSessionAuth(session.id);
    const { version } = await fetchLatestBaileysVersion();

    log.debug("Fetched Baileys version:", version.join("."));

    // Create a session-scoped getMessage function
    const sessionGetMessage = async (key: any) => getMessage(session.id, key);

    // Create a session-scoped cachedGroupMetadata function
    const sessionCachedGroupMetadata = async (id: string) =>
      cachedGroupMetadata(session.id, id);

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

    session.socket = sock;

    let pairingCode: string | undefined;

    // Request pairing code if needed
    if (requestPairingCode && !sock.authState.creds.registered) {
      log.debug("Requesting pairing code for session:", session.id);
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
            // Reconnect only if network is not paused
            session.status = "connecting";
            log.info(`Session ${session.id} reconnecting...`);

            if (!this.networkState.isPaused) {
              await this.initializeSession(session, false);
            } else {
              session.status = "disconnected";
              log.info(
                `Session ${session.id} reconnection deferred due to network pause`,
              );
            }
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

          // Start pushName fetching
          this.startPushNameFetching(session);

          if (!hasSynced) {
            hasSynced = true;
            log.debug(`Syncing groups for session ${session.id}`);
            addSudo(session.id, sock.user.id, sock.user.lid);
            await delay(15000);
            await syncGroupMetadata(session.id, sock);
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
          const metadata = await sock.groupMetadata(update.id);
          cacheGroupMetadata(session.id, metadata);
        }
      }

      if (events["groups.upsert"]) {
        const groups = events["groups.upsert"];
        for (const group of groups) {
          const metadata = await sock.groupMetadata(group.id);
          cacheGroupMetadata(session.id, metadata);
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
    let phoneNumber: string | null = null;
    const sanitized = this.sanitizePhoneNumber(idOrPhone);

    if (sanitized) {
      const record = getSession(sanitized);
      if (record) {
        sessionId = record.id;
        phoneNumber = record.phone_number;
      } else {
        sessionId = this.generateSessionId(sanitized);
        phoneNumber = sanitized;
      }
    } else {
      // Try to get phone number from session record
      const record = getSession(idOrPhone);
      if (record) {
        phoneNumber = record.phone_number;
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
      phoneNumber = phoneNumber || activeSession.phoneNumber;

      // Clear pushName interval
      if (activeSession.pushNameInterval) {
        clearInterval(activeSession.pushNameInterval);
      }
    }

    this.sessions.delete(sessionId);
    const deleted =
      deleteSessionRecord(sessionId) || deleteSessionRecord(idOrPhone);

    if (!deleted && !activeSession) {
      return { success: false, error: "Session not found" };
    }

    // Clean up user-specific database tables
    if (phoneNumber) {
      deleteUserTables(phoneNumber);
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

    if (activeSession.status === "paused") {
      return { success: false, error: "Session already paused" };
    }

    log.debug(`Pausing session ${sessionId}...`);

    if (activeSession.socket) {
      try {
        await activeSession.socket.end(undefined);
      } catch (error) {
        log.debug(`Error ending socket for session ${sessionId}:`, error);
      }
      activeSession.socket = null;
    }

    if (activeSession.pushNameInterval) {
      clearInterval(activeSession.pushNameInterval);
      activeSession.pushNameInterval = undefined;
    }

    activeSession.status = "paused";
    updateSessionStatus(sessionId, "inactive");

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
        phoneNumber: dbSession.phone_number,
        socket: null,
        msgRetryCounterCache: new NodeCache() as CacheStore,
        status: "connecting",
      };
      this.sessions.set(sessionId, activeSession);
    }

    if (activeSession.status === "connected" || activeSession.status === "connecting") {
      return { success: false, error: "Session already active" };
    }

    log.debug(`Resuming session ${sessionId}...`);

    activeSession.status = "connecting";
    
    try {
      await this.initializeSession(activeSession, false);
      log.info(`Session ${sessionId} resumed`);
      return { success: true };
    } catch (error) {
      log.error(`Failed to resume session ${sessionId}:`, error);
      activeSession.status = "paused";
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resume session",
      };
    }
  }

  /**
   * Helper to resolve session ID from ID or phone number
   */
  private resolveSessionId(idOrPhone: string): string | null {
    const sanitized = this.sanitizePhoneNumber(idOrPhone);
    const record = getSession(sanitized || idOrPhone);
    return record?.id || null;
  }

  /**
   * Restore all sessions from database on startup
   */
  async restoreAllSessions(): Promise<void> {
    const sessions = getAllSessions();

    // Filter out inactive sessions and prepare active sessions for concurrent restoration
    const sessionsToRestore = sessions.filter(
      (sessionRecord) => sessionRecord.status !== "inactive",
    );

    if (sessionsToRestore.length === 0) {
      return;
    }

    // Restore sessions concurrently for faster startup
    const restorationPromises = sessionsToRestore.map(async (sessionRecord) => {
      log.info(`Restoring session ${sessionRecord.id}...`);

      // Initialize user-specific database tables
      initializeUserTables(sessionRecord.phone_number);

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
    });

    await Promise.allSettled(restorationPromises);
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return [...this.sessions.values()].filter((s) => s.status === "connected")
      .length;
  }

  /**
   * Get pushName for a session from the active socket or database
   */
  getPushName(sessionId: string): string | undefined {
    // First check the active socket
    const activeSession = this.sessions.get(sessionId);
    if (activeSession?.socket?.user?.name) {
      return activeSession.socket.user.name;
    }

    // Fall back to database
    const dbSession = getSession(sessionId);
    return dbSession?.push_name;
  }

  /**
   * List all sessions with extended info (including pushName and actual status)
   */
  listExtended(): Array<SessionRecord & { pushName?: string }> {
    const sessions = getAllSessions();
    return sessions.map((session) => {
      const activeSession = this.sessions.get(session.id);
      return {
        ...session,
        status: activeSession?.status === "paused" ? "inactive" : session.status,
        pushName: this.getPushName(session.id) || session.push_name,
      };
    });
  }
}

export const sessionManager = SessionManager.getInstance();
