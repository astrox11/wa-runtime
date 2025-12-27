/**
 * Message Handler Module
 *
 * This module is responsible for:
 * - Receiving raw WhatsApp messages from Baileys
 * - Normalizing and validating incoming message data
 * - Transforming messages into domain-friendly structures
 * - Classifying messages for appropriate routing
 *
 * Data Flow:
 * 1. Raw WAMessage received from Baileys socket event
 * 2. normalizeMessage() transforms it into NormalizedMessage
 * 3. classifyMessage() determines the message type
 * 4. extractCommand() parses command information if applicable
 * 5. Downstream services receive the processed NormalizedMessage
 *
 * Design Principles:
 * - Stateless: No internal state is maintained
 * - Pure Functions: Same input produces same output
 * - Transport Agnostic: Works with any message source implementing WAMessage
 */

import {
  getDevice,
  isJidGroup,
  getContentType,
  normalizeMessageContent,
  jidNormalizedUser,
} from "baileys";
import type { WASocket, WAMessage, WAMessageContent } from "baileys";
import { getAlternateId, isSudo } from "../lib/sql";
import type {
  NormalizedMessage,
  MessageClassification,
  CommandInfo,
  MediaType,
} from "./types";

/**
 * Normalizes a raw WhatsApp message into a domain-friendly structure.
 *
 * @param client - The WhatsApp socket client
 * @param rawMessage - The raw message from Baileys
 * @returns Normalized message structure ready for processing
 */
export function normalizeMessage(
  client: WASocket,
  rawMessage: WAMessage,
): NormalizedMessage {
  const chatId = rawMessage.key.remoteJid!;
  const isGroup = isJidGroup(chatId);
  const isFromSelf = rawMessage.key.fromMe ?? false;

  // Determine sender based on message context
  const senderId = determineSenderId(client, rawMessage, isGroup);
  const senderAltId = getAlternateId(senderId);

  // Normalize message content
  const messageContent = normalizeMessageContent(rawMessage.message!);
  const contentType = getContentType(messageContent);

  // Extract text content
  const text = extractText(messageContent);

  // Classify the message
  const classification = classifyMessage(messageContent, contentType, text);

  // Extract command info if applicable
  const command =
    classification === "command" && text ? extractCommand(text) : undefined;

  // Determine media type if applicable
  const mediaType = getMediaType(contentType);

  // Check for quoted content
  const hasQuoted = hasQuotedMessage(messageContent, contentType);

  return {
    id: rawMessage.key.id!,
    chatId,
    senderId,
    senderAltId,
    senderName: rawMessage.pushName ?? "Unknown",
    isGroup,
    isFromSelf,
    isSudo: isSudo(senderId),
    classification,
    text,
    command,
    mediaType,
    hasQuoted,
    timestamp: Date.now(),
    device: getDevice(rawMessage.key.id),
    raw: rawMessage,
  };
}

/**
 * Determines the sender ID based on message context.
 *
 * @param client - The WhatsApp socket client
 * @param message - The raw message
 * @param isGroup - Whether the message is from a group
 * @returns The sender's JID
 */
function determineSenderId(
  client: WASocket,
  message: WAMessage,
  isGroup: boolean,
): string {
  if (!isGroup) {
    return message.key.fromMe
      ? jidNormalizedUser(client.user?.id ?? "")
      : message.key.remoteJid!;
  }
  return message.key.participant ?? message.key.remoteJid!;
}

/**
 * Classifies a message based on its content type and text.
 *
 * @param content - Normalized message content
 * @param contentType - The content type identifier
 * @param text - Extracted text content
 * @returns The message classification
 */
export function classifyMessage(
  content: WAMessageContent | null | undefined,
  contentType: string | undefined,
  text: string | undefined,
): MessageClassification {
  // Check for protocol messages (edits, deletes, etc.)
  if (content?.protocolMessage) {
    return "protocol";
  }

  // Check for button response
  if (contentType === "buttonsResponseMessage") {
    return "button_response";
  }

  // Check for sticker
  if (
    contentType === "stickerMessage" ||
    contentType === "lottieStickerMessage"
  ) {
    return "sticker";
  }

  // Check for media content
  if (isMediaContent(contentType)) {
    return "media";
  }

  // Check if text looks like a command (starts with common prefixes)
  if (text && isCommand(text)) {
    return "command";
  }

  // Check for regular text
  if (text) {
    return "text";
  }

  return "unknown";
}

/**
 * Checks if a content type represents media.
 */
function isMediaContent(contentType: string | undefined): boolean {
  const mediaTypes = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
  ];
  return contentType ? mediaTypes.includes(contentType) : false;
}

/**
 * Checks if text appears to be a command.
 * Commands typically start with specific patterns loaded from plugins.
 *
 * @param text - The text to check
 * @returns Whether the text appears to be a command
 */
function isCommand(text: string): boolean {
  // Simple heuristic: commands are typically single words or start with prefix
  // The actual command validation happens in the command dispatcher
  const trimmed = text.trim();
  const firstWord = trimmed.split(/\s+/)[0];

  // If the first word is short and alphanumeric, it might be a command
  // This is a lightweight pre-filter; actual validation occurs in dispatcher
  return firstWord.length > 0 && firstWord.length <= 50;
}

/**
 * Extracts command information from text.
 *
 * @param text - The raw text containing the command
 * @returns Command information object
 */
export function extractCommand(text: string): CommandInfo {
  const trimmed = text.trim();
  const spaceIndex = trimmed.indexOf(" ");

  if (spaceIndex === -1) {
    return {
      name: trimmed.toLowerCase(),
      args: "",
      rawText: trimmed,
    };
  }

  return {
    name: trimmed.slice(0, spaceIndex).toLowerCase(),
    args: trimmed.slice(spaceIndex + 1).trim(),
    rawText: trimmed,
  };
}

/**
 * Gets the media type from content type.
 */
function getMediaType(contentType: string | undefined): MediaType | undefined {
  const mediaMap: Record<string, MediaType> = {
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    documentMessage: "document",
    stickerMessage: "sticker",
    lottieStickerMessage: "sticker",
  };

  return contentType ? mediaMap[contentType] : undefined;
}

/**
 * Checks if the message has quoted content.
 */
function hasQuotedMessage(
  content: WAMessageContent | null | undefined,
  contentType: string | undefined,
): boolean {
  if (!content || !contentType) return false;

  const messageContent = content[contentType as keyof WAMessageContent];
  if (typeof messageContent === "object" && messageContent !== null) {
    const contextInfo = (messageContent as Record<string, unknown>).contextInfo;
    if (typeof contextInfo === "object" && contextInfo !== null) {
      const info = contextInfo as Record<string, unknown>;
      return !!(info.stanzaId && info.quotedMessage);
    }
  }

  return false;
}

/**
 * Extracts text content from various message types.
 *
 * @param content - Normalized message content
 * @returns Extracted text or undefined
 */
export function extractText(
  content: WAMessageContent | null | undefined,
): string | undefined {
  if (!content) return undefined;

  // Extended text message
  if (content.extendedTextMessage?.text) {
    return content.extendedTextMessage.text;
  }

  // Plain conversation
  if (content.conversation) {
    return content.conversation;
  }

  // Image caption
  if (content.imageMessage?.caption) {
    return content.imageMessage.caption;
  }

  // Video caption
  if (content.videoMessage?.caption) {
    return content.videoMessage.caption;
  }

  // Document caption
  if (content.documentMessage?.caption) {
    return content.documentMessage.caption;
  }

  // Buttons message content
  if (content.buttonsMessage?.contentText) {
    return content.buttonsMessage.contentText;
  }

  // Template message
  if (content.templateMessage?.hydratedTemplate?.hydratedContentText) {
    return content.templateMessage.hydratedTemplate.hydratedContentText;
  }

  // List message
  if (content.listMessage?.description) {
    return content.listMessage.description;
  }

  // Edited message
  if (content.protocolMessage?.editedMessage) {
    return extractText(
      content.protocolMessage.editedMessage as WAMessageContent,
    );
  }

  return undefined;
}

/**
 * Validates that a normalized message has required fields.
 *
 * @param message - The message to validate
 * @returns Whether the message is valid for processing
 */
export function validateMessage(message: NormalizedMessage): boolean {
  // Must have basic identifiers
  if (!message.id || !message.chatId || !message.senderId) {
    return false;
  }

  // Must have a valid classification
  if (
    message.classification === "unknown" &&
    !message.text &&
    !message.mediaType
  ) {
    return false;
  }

  return true;
}
