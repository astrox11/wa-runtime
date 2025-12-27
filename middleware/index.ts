/**
 * Middleware Service - Main Entry Point
 *
 * This module serves as the abstraction layer between the WhatsApp integration
 * (Baileys) and the rest of the application. It provides a unified interface
 * for processing incoming events and messages.
 *
 * Responsibilities:
 * - Receive raw WhatsApp events and messages from Baileys socket
 * - Normalize and validate incoming data into internal domain-friendly structures
 * - Handle command routing and message classification
 * - Expose a clear interface for downstream services to consume processed events
 * - Remain stateless where possible, delegating persistence to dedicated services
 *
 * Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     WhatsApp Integration                        │
 * │                       (Baileys Socket)                          │
 * └─────────────────────────────────────────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                      MIDDLEWARE LAYER                           │
 * │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
 * │  │ Message Handler │→ │ Command Dispatcher│→ │ Event Handler │  │
 * │  │  (Normalize)    │  │    (Route)        │  │   (Process)   │  │
 * │  └─────────────────┘  └──────────────────┘  └───────────────┘  │
 * └─────────────────────────────────────────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   Application Services                          │
 * │            (Persistence, Business Logic, etc.)                  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Usage Example:
 * ```typescript
 * import { MiddlewareService, createMiddleware } from "./middleware";
 *
 * const middleware = createMiddleware({ debug: true });
 *
 * // Process a message
 * const result = await middleware.processMessage(client, rawMessage);
 *
 * // Process an event
 * await middleware.processEvent(client, eventType, payload);
 * ```
 */

import type { WASocket, WAMessage, proto } from "baileys";
import { DisconnectReason } from "baileys";
import { Boom } from "@hapi/boom";
import { log } from "../lib/util";

// Import sub-modules
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

// Re-export types and sub-module functions for external use
export * from "./types";
export {
  // Message handler exports
  normalizeMessage,
  validateMessage,
  extractText,
  classifyMessage,
  extractCommand,
  // Command dispatcher exports
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
} from "./types";

/**
 * Middleware Service class providing high-level message and event processing.
 *
 * This class encapsulates the middleware logic and provides a clean interface
 * for the main application to process WhatsApp events without dealing with
 * low-level details.
 */
export class MiddlewareService {
  private options: Required<MiddlewareOptions>;
  private registry: CommandRegistry | null = null;
  private eventHandlers: CommandDefinition[] = [];

  constructor(options: MiddlewareOptions = {}) {
    this.options = {
      ignoreSelf: options.ignoreSelf ?? false,
      debug: options.debug ?? false,
    };
  }

  /**
   * Sets the command registry for command dispatch.
   *
   * @param registry - The command registry to use
   */
  setRegistry(registry: CommandRegistry): void {
    this.registry = registry;
  }

  /**
   * Sets event handlers for event-based processing.
   *
   * @param handlers - Array of event handler definitions
   */
  setEventHandlers(handlers: CommandDefinition[]): void {
    this.eventHandlers = handlers.filter((h) => h.event === true);
  }

  /**
   * Processes a raw WhatsApp message through the middleware pipeline.
   *
   * @param client - The WhatsApp socket client
   * @param rawMessage - The raw message from Baileys
   * @param mode - Current bot mode (private/public)
   * @returns Processing result with normalized message and dispatch status
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
    // Normalize the message
    const message = normalizeMessage(client, rawMessage);

    if (this.options.debug) {
      log.debug("[middleware] Processing message:", {
        id: message.id,
        classification: message.classification,
        text: message.text?.slice(0, 50),
      });
    }

    // Validate the message
    const valid = validateMessage(message);
    if (!valid) {
      if (this.options.debug) {
        log.debug("[middleware] Message validation failed");
      }
      return { message, valid: false, dispatched: null, eventResults: [] };
    }

    // Skip self messages if configured
    if (this.options.ignoreSelf && message.isFromSelf) {
      return { message, valid: true, dispatched: null, eventResults: [] };
    }

    // Dispatch command if applicable
    let dispatched: DispatchResult | null = null;
    if (this.registry && shouldDispatch(message, this.registry)) {
      dispatched = await dispatchCommand(message, client, this.registry, mode);
    }

    // Process event handlers
    const eventResults = await dispatchEvents(
      message,
      client,
      this.eventHandlers,
      mode,
    );

    return { message, valid: true, dispatched, eventResults };
  }

  /**
   * Creates a normalized event from raw WhatsApp event data.
   *
   * @param type - The event type
   * @param payload - The raw event payload
   * @returns Normalized event structure
   */
  createEvent<T>(type: EventType, payload: T): NormalizedEvent<T> {
    return {
      type,
      payload,
      receivedAt: Date.now(),
    };
  }

  /**
   * Processes a connection update event.
   *
   * @param update - The connection update from Baileys
   * @returns Normalized connection event
   */
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

    return this.createEvent<ConnectionPayload>("connection", {
      state,
      isLoggedOut,
    });
  }

  /**
   * Processes a group participants update event.
   *
   * @param update - The group participants update from Baileys
   * @returns Normalized group participants event
   */
  processGroupParticipantsUpdate(update: {
    id: string;
    participants: string[];
    action: "add" | "remove" | "promote" | "demote";
  }): NormalizedEvent<GroupParticipantsPayload> {
    return this.createEvent<GroupParticipantsPayload>("group_participants", {
      groupId: update.id,
      participants: update.participants,
      action: update.action,
    });
  }

  /**
   * Processes a group metadata update event.
   *
   * @param update - The group update from Baileys
   * @returns Normalized group update event
   */
  processGroupUpdate(update: {
    id?: string;
    [key: string]: unknown;
  }): NormalizedEvent<GroupUpdatePayload> {
    const { id, ...metadata } = update;
    return this.createEvent<GroupUpdatePayload>("group_update", {
      groupId: id ?? "",
      metadata,
    });
  }

  /**
   * Processes a LID mapping update event.
   *
   * @param update - The LID mapping update from Baileys
   * @returns Normalized LID mapping event
   */
  processLidMappingUpdate(update: {
    pn: string;
    lid: string;
  }): NormalizedEvent<LidMappingPayload> {
    return this.createEvent<LidMappingPayload>("lid_mapping", {
      phoneNumber: update.pn,
      lid: update.lid,
    });
  }

  /**
   * Processes a message delete event.
   *
   * @param deleteInfo - The delete information from Baileys
   * @returns Normalized message delete event
   */
  processMessageDelete(deleteInfo: {
    keys: proto.IMessageKey[];
  }): NormalizedEvent<MessageDeletePayload> {
    return this.createEvent<MessageDeletePayload>("message_delete", {
      keys: deleteInfo.keys,
    });
  }
}

/**
 * Factory function to create a configured middleware instance.
 *
 * @param options - Configuration options for the middleware
 * @returns A configured MiddlewareService instance
 */
export function createMiddleware(
  options: MiddlewareOptions = {},
): MiddlewareService {
  return new MiddlewareService(options);
}

/**
 * Default middleware instance for simple use cases.
 * For more control, use createMiddleware() or instantiate MiddlewareService directly.
 */
export const middleware = createMiddleware();
