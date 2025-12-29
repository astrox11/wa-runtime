/**
 * Middleware Service - Event-Emitter Based Architecture
 *
 * Provides an abstraction layer between WhatsApp (Baileys) and the application.
 * Uses Node.js EventEmitter for decoupled event handling.
 */

import { EventEmitter } from "events";
import type { WASocket, WAMessage, proto } from "baileys";
import { DisconnectReason } from "baileys";
import { Boom } from "@hapi/boom";
import { log } from "../lib/util";

import {
  normalizeMessage,
  validateMessage,
  extractText,
  classifyMessage,
  extractCommand,
} from "./messageHandler";
import {
  dispatchCommand,
  dispatchEvents,
  checkPermissions,
  createRegistry,
  shouldDispatch,
  getCommandsByCategory,
  getCategories,
  requiresDispatch,
  type CommandDefinition,
  type CommandRegistry,
} from "./commandDispatcher";

export * from "./types";
export {
  normalizeMessage,
  validateMessage,
  extractText,
  classifyMessage,
  extractCommand,
  dispatchCommand,
  dispatchEvents,
  checkPermissions,
  createRegistry,
  shouldDispatch,
  getCommandsByCategory,
  getCategories,
  requiresDispatch,
  type CommandDefinition,
  type CommandRegistry,
};

import type {
  NormalizedMessage,
  NormalizedEvent,
  EventType,
  ConnectionPayload,
  GroupParticipantsPayload,
  GroupUpdatePayload,
  LidMappingPayload,
  MessageDeletePayload,
  DispatchResult,
  MiddlewareOptions,
  MiddlewareEvents,
} from "./types";

/**
 * Event-emitter based middleware service for WhatsApp message processing.
 */
export class MiddlewareService extends EventEmitter {
  private readonly options: Required<MiddlewareOptions>;
  private registry: CommandRegistry | null = null;
  private eventHandlers: CommandDefinition[] = [];

  constructor(options: MiddlewareOptions = {}) {
    super();
    this.options = {
      sessionId: options.sessionId ?? "main",
      ignoreSelf: options.ignoreSelf ?? false,
      debug: options.debug ?? false,
    };
  }

  /** Gets the session ID for this middleware instance */
  get sessionId(): string {
    return this.options.sessionId;
  }

  /** Sets the command registry */
  setRegistry(registry: CommandRegistry): void {
    this.registry = registry;
  }

  /** Sets event handlers */
  setEventHandlers(handlers: CommandDefinition[]): void {
    this.eventHandlers = handlers.filter((h) => h.event === true);
  }

  /** Type-safe event emission */
  emit<K extends keyof MiddlewareEvents>(
    event: K,
    ...args: Parameters<MiddlewareEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /** Type-safe event listener */
  on<K extends keyof MiddlewareEvents>(
    event: K,
    listener: MiddlewareEvents[K],
  ): this {
    return super.on(event, listener);
  }

  /** Type-safe once listener */
  once<K extends keyof MiddlewareEvents>(
    event: K,
    listener: MiddlewareEvents[K],
  ): this {
    return super.once(event, listener);
  }

  /**
   * Processes a raw WhatsApp message through the middleware pipeline.
   */
  async processMessage(
    client: WASocket,
    rawMessage: WAMessage,
    mode: "private" | "public" = "public",
  ): Promise<{
    message: NormalizedMessage;
    valid: boolean;
    dispatched: DispatchResult | null;
    eventResults: DispatchResult[];
  }> {
    const message = normalizeMessage(client, rawMessage, this.options.sessionId);

    if (this.options.debug) {
      log.debug("[middleware] Processing message:", {
        id: message.id,
        sessionId: message.sessionId,
        classification: message.classification,
        text: message.text?.slice(0, 50),
      });
    }

    const valid = validateMessage(message);
    if (!valid) {
      if (this.options.debug) {
        log.debug("[middleware] Message validation failed");
      }
      return { message, valid: false, dispatched: null, eventResults: [] };
    }

    if (this.options.ignoreSelf && message.isFromSelf) {
      return { message, valid: true, dispatched: null, eventResults: [] };
    }

    // Emit message event
    this.emit("message", message, client);

    let dispatched: DispatchResult | null = null;
    if (this.registry && shouldDispatch(message, this.registry)) {
      this.emit("command", message, client);
      dispatched = await dispatchCommand(message, client, this.registry, mode);
    }

    const eventResults = await dispatchEvents(
      message,
      client,
      this.eventHandlers,
      mode,
    );

    return { message, valid: true, dispatched, eventResults };
  }

  /** Creates a normalized event */
  createEvent<T>(type: EventType, payload: T): NormalizedEvent<T> {
    return {
      type,
      sessionId: this.options.sessionId,
      payload,
      receivedAt: Date.now(),
    };
  }

  /** Processes a connection update event */
  processConnectionUpdate(update: {
    connection?: "close" | "open" | "connecting";
    lastDisconnect?: { error: Error };
  }): NormalizedEvent<ConnectionPayload> {
    const state = update.connection ?? "connecting";
    let isLoggedOut = false;

    if (state === "close" && update.lastDisconnect?.error) {
      const statusCode = (update.lastDisconnect.error as Boom)?.output
        ?.statusCode;
      isLoggedOut = statusCode === DisconnectReason.loggedOut;
    }

    const event = this.createEvent<ConnectionPayload>("connection", {
      state,
      isLoggedOut,
    });

    this.emit("connection", event);
    return event;
  }

  /** Processes a group participants update event */
  processGroupParticipantsUpdate(update: {
    id: string;
    participants: string[];
    action: "add" | "remove" | "promote" | "demote";
  }): NormalizedEvent<GroupParticipantsPayload> {
    const event = this.createEvent<GroupParticipantsPayload>(
      "group_participants",
      {
        groupId: update.id,
        participants: update.participants,
        action: update.action,
      },
    );

    this.emit("group_participants", event);
    return event;
  }

  /** Processes a group metadata update event */
  processGroupUpdate(update: {
    id?: string;
    [key: string]: unknown;
  }): NormalizedEvent<GroupUpdatePayload> {
    const { id, ...metadata } = update;
    const event = this.createEvent<GroupUpdatePayload>("group_update", {
      groupId: id ?? "",
      metadata,
    });

    this.emit("group_update", event);
    return event;
  }

  /** Processes a LID mapping update event */
  processLidMappingUpdate(update: {
    pn: string;
    lid: string;
  }): NormalizedEvent<LidMappingPayload> {
    const event = this.createEvent<LidMappingPayload>("lid_mapping", {
      phoneNumber: update.pn,
      lid: update.lid,
    });

    this.emit("lid_mapping", event);
    return event;
  }

  /** Processes a message delete event */
  processMessageDelete(deleteInfo: {
    keys: proto.IMessageKey[];
  }): NormalizedEvent<MessageDeletePayload> {
    const event = this.createEvent<MessageDeletePayload>("message_delete", {
      keys: deleteInfo.keys,
    });

    this.emit("message_delete", event);
    return event;
  }

  /** Processes credentials update event */
  processCredentialsUpdate(): NormalizedEvent<void> {
    const event = this.createEvent<void>("credentials", undefined);
    this.emit("credentials", event);
    return event;
  }

  /** Emits an error event */
  emitError(error: Error, context: string): void {
    this.emit("error", error, context);
    if (this.options.debug) {
      log.error(`[middleware] Error in ${context}:`, error);
    }
  }
}

/** Factory function to create a configured middleware instance */
export function createMiddleware(
  options: MiddlewareOptions = {},
): MiddlewareService {
  return new MiddlewareService(options);
}

/** Default middleware instance */
export const middleware = createMiddleware();
