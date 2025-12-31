import { EventEmitter } from "events";
import type { WASocket, WAMessage, proto } from "baileys";
import { DisconnectReason } from "baileys";
import { Boom } from "@hapi/boom";
import { log } from "../core/util";

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
export * from "./api";
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

  get sessionId(): string {
    return this.options.sessionId;
  }

  setRegistry(registry: CommandRegistry): void {
    this.registry = registry;
  }

  setEventHandlers(handlers: CommandDefinition[]): void {
    this.eventHandlers = handlers.filter((h) => h.event === true);
  }

  emit<K extends keyof MiddlewareEvents>(
    event: K,
    ...args: Parameters<MiddlewareEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof MiddlewareEvents>(
    event: K,
    listener: MiddlewareEvents[K],
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof MiddlewareEvents>(
    event: K,
    listener: MiddlewareEvents[K],
  ): this {
    return super.once(event, listener);
  }

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
    const message = normalizeMessage(
      client,
      rawMessage,
      this.options.sessionId,
    );

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

  createEvent<T>(type: EventType, payload: T): NormalizedEvent<T> {
    return {
      type,
      sessionId: this.options.sessionId,
      payload,
      receivedAt: Date.now(),
    };
  }

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

  processMessageDelete(deleteInfo: {
    keys: proto.IMessageKey[];
  }): NormalizedEvent<MessageDeletePayload> {
    const event = this.createEvent<MessageDeletePayload>("message_delete", {
      keys: deleteInfo.keys,
    });

    this.emit("message_delete", event);
    return event;
  }

  processCredentialsUpdate(): NormalizedEvent<void> {
    const event = this.createEvent<void>("credentials", undefined);
    this.emit("credentials", event);
    return event;
  }

  emitError(error: Error, context: string): void {
    this.emit("error", error, context);
    if (this.options.debug) {
      log.error(`[middleware] Error in ${context}:`, error);
    }
  }
}

export function createMiddleware(
  options: MiddlewareOptions = {},
): MiddlewareService {
  return new MiddlewareService(options);
}

export const middleware = createMiddleware();
