/**
 * Shared Types and Interfaces for the Middleware Layer
 *
 * This module defines domain-friendly structures used across the middleware
 * to normalize and standardize WhatsApp events and messages. These types
 * provide a consistent interface between the WhatsApp integration (Baileys)
 * and downstream application services.
 *
 * Data Flow:
 * 1. Raw WhatsApp events/messages come from Baileys socket
 * 2. Middleware normalizes them into these domain types
 * 3. Downstream services consume the normalized structures
 */

import type { WASocket, WAMessage, proto } from "baileys";

/**
 * Represents the type of incoming WhatsApp event that the middleware can process.
 */
export type EventType =
  | "message"
  | "connection"
  | "group_update"
  | "group_participants"
  | "credentials"
  | "lid_mapping"
  | "message_delete";

/**
 * Message content classification for routing and handling.
 */
export type MessageClassification =
  | "text"
  | "command"
  | "media"
  | "sticker"
  | "button_response"
  | "protocol"
  | "unknown";

/**
 * Represents the type of media content in a message.
 */
export type MediaType = "image" | "video" | "audio" | "document" | "sticker";

/**
 * Command metadata extracted from a message for routing.
 */
export interface CommandInfo {
  /** The command name (without prefix) */
  name: string;
  /** Arguments passed to the command */
  args: string;
  /** Original text that triggered the command */
  rawText: string;
}

/**
 * Normalized message structure for internal use.
 * Abstracts away Baileys-specific details into a domain-friendly format.
 */
export interface NormalizedMessage {
  /** Unique message identifier */
  id: string;
  /** Chat/conversation JID */
  chatId: string;
  /** Sender JID */
  senderId: string;
  /** Alternative sender ID (if available) */
  senderAltId?: string;
  /** Sender's display name */
  senderName: string;
  /** Whether this message is from a group chat */
  isGroup: boolean;
  /** Whether the sender is the bot itself */
  isFromSelf: boolean;
  /** Whether the sender has sudo privileges */
  isSudo: boolean;
  /** Message classification for routing */
  classification: MessageClassification;
  /** Extracted text content (if any) */
  text?: string;
  /** Command information (if message is a command) */
  command?: CommandInfo;
  /** Media type (if message contains media) */
  mediaType?: MediaType;
  /** Whether the message has quoted content */
  hasQuoted: boolean;
  /** Timestamp of the message */
  timestamp: number;
  /** Device type that sent the message */
  device: "web" | "unknown" | "android" | "ios" | "desktop";
  /** Original raw message for cases where full access is needed */
  raw: WAMessage;
}

/**
 * Normalized event structure for internal processing.
 * Provides a unified interface for all WhatsApp events.
 */
export interface NormalizedEvent<T = unknown> {
  /** Type of the event */
  type: EventType;
  /** Event payload data */
  payload: T;
  /** Timestamp when the event was received */
  receivedAt: number;
}

/**
 * Connection update event payload.
 */
export interface ConnectionPayload {
  /** Connection state */
  state: "open" | "close" | "connecting";
  /** Whether the user was logged out (on close) */
  isLoggedOut?: boolean;
}

/**
 * Group participants update payload.
 */
export interface GroupParticipantsPayload {
  /** Group JID */
  groupId: string;
  /** Affected participant JIDs */
  participants: string[];
  /** Action that occurred */
  action: "add" | "remove" | "promote" | "demote";
}

/**
 * Group metadata update payload.
 */
export interface GroupUpdatePayload {
  /** Group JID */
  groupId: string;
  /** Updated group metadata (partial) */
  metadata: Record<string, unknown>;
}

/**
 * LID mapping update payload.
 */
export interface LidMappingPayload {
  /** Phone number */
  phoneNumber: string;
  /** LID identifier */
  lid: string;
}

/**
 * Message delete event payload.
 */
export interface MessageDeletePayload {
  /** Keys of deleted messages */
  keys: proto.IMessageKey[];
}

/**
 * Result of command dispatch operation.
 */
export interface DispatchResult {
  /** Whether a handler was found and executed */
  handled: boolean;
  /** Name of the handler that processed the command (if any) */
  handlerName?: string;
  /** Error that occurred during dispatch (if any) */
  error?: Error;
}

/**
 * Handler function signature for processing normalized messages.
 */
export type MessageHandler = (
  message: NormalizedMessage,
  client: WASocket,
) => Promise<void>;

/**
 * Handler function signature for processing events.
 */
export type EventHandler<T = unknown> = (
  event: NormalizedEvent<T>,
  client: WASocket,
) => Promise<void>;

/**
 * Options for middleware processing.
 */
export interface MiddlewareOptions {
  /** Skip processing for self-sent messages */
  ignoreSelf?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}
