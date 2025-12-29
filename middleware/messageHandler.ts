/**
 * Message Handler Module
 *
 * Normalizes raw WhatsApp messages into domain-friendly structures
 * and classifies them for appropriate routing.
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
 */
export function normalizeMessage(
  client: WASocket,
  rawMessage: WAMessage,
  sessionId: string = "main",
): NormalizedMessage {
  const chatId = rawMessage.key.remoteJid!;
  const isGroup = isJidGroup(chatId);
  const isFromSelf = rawMessage.key.fromMe ?? false;

  const senderId = determineSenderId(client, rawMessage, isGroup);
  const altId = getAlternateId(sessionId, senderId);
  const senderAltId = altId ?? undefined;

  const messageContent = normalizeMessageContent(rawMessage.message!);
  const contentType = getContentType(messageContent);

  const text = extractText(messageContent);
  const classification = classifyMessage(messageContent, contentType, text);
  const command =
    classification === "command" && text ? extractCommand(text) : undefined;
  const mediaType = getMediaType(contentType);
  const hasQuoted = hasQuotedMessage(messageContent, contentType);

  const messageTimestamp = rawMessage.messageTimestamp;
  const timestamp =
    typeof messageTimestamp === "number"
      ? messageTimestamp * 1000
      : typeof messageTimestamp === "object" && messageTimestamp !== null
        ? Number(messageTimestamp) * 1000
        : Date.now();

  return {
    id: rawMessage.key.id!,
    sessionId,
    chatId,
    senderId,
    senderAltId,
    senderName: rawMessage.pushName ?? "Unknown",
    isGroup,
    isFromSelf,
    isSudo: isSudo(sessionId, senderId),
    classification,
    text,
    command,
    mediaType,
    hasQuoted,
    timestamp,
    device: getDevice(rawMessage.key.id),
    raw: rawMessage,
  };
}

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
 */
export function classifyMessage(
  content: WAMessageContent | null | undefined,
  contentType: string | undefined,
  text: string | undefined,
): MessageClassification {
  if (content?.protocolMessage) {
    return "protocol";
  }
  if (contentType === "buttonsResponseMessage") {
    return "button_response";
  }
  if (
    contentType === "stickerMessage" ||
    contentType === "lottieStickerMessage"
  ) {
    return "sticker";
  }
  if (isMediaContent(contentType)) {
    return "media";
  }
  if (text && isCommand(text)) {
    return "command";
  }
  if (text) {
    return "text";
  }
  return "unknown";
}

function isMediaContent(contentType: string | undefined): boolean {
  const mediaTypes = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
  ];
  return contentType ? mediaTypes.includes(contentType) : false;
}

function isCommand(text: string): boolean {
  const trimmed = text.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord.length > 0 && firstWord.length <= 50;
}

/**
 * Extracts command information from text.
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
 */
export function extractText(
  content: WAMessageContent | null | undefined,
): string | undefined {
  if (!content) return undefined;

  if (content.extendedTextMessage?.text) {
    return content.extendedTextMessage.text;
  }
  if (content.conversation) {
    return content.conversation;
  }
  if (content.imageMessage?.caption) {
    return content.imageMessage.caption;
  }
  if (content.videoMessage?.caption) {
    return content.videoMessage.caption;
  }
  if (content.documentMessage?.caption) {
    return content.documentMessage.caption;
  }
  if (content.buttonsMessage?.contentText) {
    return content.buttonsMessage.contentText;
  }
  if (content.templateMessage?.hydratedTemplate?.hydratedContentText) {
    return content.templateMessage.hydratedTemplate.hydratedContentText;
  }
  if (content.listMessage?.description) {
    return content.listMessage.description;
  }
  if (content.protocolMessage?.editedMessage) {
    return extractText(
      content.protocolMessage.editedMessage as WAMessageContent,
    );
  }
  return undefined;
}

/**
 * Validates that a normalized message has required fields.
 */
export function validateMessage(message: NormalizedMessage): boolean {
  if (!message.id || !message.chatId || !message.senderId) {
    return false;
  }
  if (
    message.classification === "unknown" &&
    !message.text &&
    !message.mediaType
  ) {
    return false;
  }
  return true;
}
