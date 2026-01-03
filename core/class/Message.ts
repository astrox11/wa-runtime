import {
  getDevice,
  isJidGroup,
  getContentType,
  normalizeMessageContent,
  jidNormalizedUser,
  generateMessageIDV2,
} from "baileys";
import type {
  proto,
  WASocket,
  WAMessage,
  WAMessageKey,
  WAMessageContent,
} from "baileys";
import { Quoted } from "./Quoted";
import {
  isSudo,
  getMode,
  getAlternateId,
  additionalNodes,
  ExtractTextFromMessage,
  isUrl,
  isPath,
  get_prefix,
} from "..";
import { readFile } from "fs/promises";

export class Message {
  client: WASocket;
  sessionId: string;
  chat: string;
  key: WAMessageKey;
  message: WAMessageContent | undefined;
  isGroup: boolean;
  sender: string;
  pushName: string;
  image: boolean;
  video: boolean;
  audio: boolean;
  sudo: boolean;
  sticker: boolean;
  prefix: string[] | null;
  device: "web" | "unknown" | "android" | "ios" | "desktop";
  mode: "private" | "public";
  quoted: Quoted | undefined;
  text: string | undefined;
  type: string | undefined;
  sender_alt: string | undefined | null;
  mentions: string[];
  contextInfo: proto.IContextInfo | undefined;

  constructor(
    client: WASocket,
    message: WAMessage,
    sessionId: string = "main",
  ) {
    this.client = client;
    this.sessionId = sessionId;
    this.chat = message.key.remoteJid ?? "";
    this.key = message.key;
    this.message = normalizeMessageContent(message.message ?? undefined);
    const remoteJid = message.key.remoteJid ?? "";
    this.isGroup = isJidGroup(remoteJid) ?? false;
    const senderFromRemote = !this.isGroup
      ? !this.key.fromMe
        ? this.key.remoteJid
        : jidNormalizedUser(this.client.user?.id)
      : this.key.participant;
    this.sender = senderFromRemote ?? "";
    this.sender_alt = this.sender
      ? getAlternateId(this.sessionId, this.sender)
      : undefined;
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";
    this.device = getDevice(this.key.id ?? "");
    this.mode = getMode(this.sessionId);
    this.sudo = isSudo(this.sessionId, this.sender);
    this.pushName = message.pushName ?? "";
    this.prefix = get_prefix(sessionId) ?? null;

    const content =
      this.message && this.type
        ? (this.message as Record<string, unknown>)[this.type]
        : undefined;
    this.contextInfo =
      typeof content === "object" && content !== null
        ? (content as { contextInfo?: proto.IContextInfo }).contextInfo
        : undefined;

    this.mentions = this?.contextInfo?.mentionedJid ?? [];

    this.quoted =
      this.contextInfo?.stanzaId && this.contextInfo?.quotedMessage
        ? new Quoted(this.contextInfo, client, this.sessionId)
        : undefined;

    this.text = this.message ? ExtractTextFromMessage(this.message) : undefined;

    Object.defineProperties(this, {
      contextInfo: {
        value: this.contextInfo,
        enumerable: false,
        writable: true,
        configurable: true,
      },
      client: {
        value: client,
        enumerable: false,
        writable: true,
        configurable: true,
      },
    });
  }

  async send_btn(message: proto.IMessage["buttonsMessage"]) {
    const m = await this.client.relayMessage(
      this.chat,
      {
        documentWithCaptionMessage: { message: { ...message } },
      },
      {
        messageId: generateMessageIDV2(this.client.user?.id),
        additionalNodes,
      },
    );
    return new Message(this.client, { key: { id: m } }, this.sessionId);
  }

  async send_interactive(message: proto.IMessage["interactiveMessage"]) {
    const m = await this.client.relayMessage(
      this.chat,
      {
        documentWithCaptionMessage: {
          message: { interactiveMessage: { ...message } },
        },
      },
      {
        messageId: generateMessageIDV2(this.client.user?.id),
        additionalNodes,
      },
    );
    return new Message(this.client, { key: { id: m } }, this.sessionId);
  }

  async reply(text: string) {
    const msg = await this.client.sendMessage(
      this.chat,
      { text },
      { quoted: this },
    );
    return new Message(this.client, msg!, this.sessionId);
  }

  async send(text: string) {
    const msg = await this.client.sendMessage(this.chat, { text });
    return new Message(this.client, msg!, this.sessionId);
  }

  async edit(text: string) {
    if (this.image) {
      return await this.client.sendMessage(this.chat, {
        edit: this.key,
        image: { url: "" },
        text,
      });
    } else if (this.video) {
      return await this.client.sendMessage(this.chat, {
        edit: this.key,
        video: { url: "" },
        text,
      });
    } else {
      return await this.client.sendMessage(this.chat, { edit: this.key, text });
    }
  }

  async block(user: string) {
    const blocked = await this.client.fetchBlocklist();

    if (!blocked.includes(user)) {
      await this.client.updateBlockStatus(user, "block");
      return true;
    }
    return null;
  }

  async unblock(user: string) {
    const blocked = await this.client.fetchBlocklist();

    if (blocked.includes(user)) {
      await this.client.updateBlockStatus(user, "unblock");
      return true;
    }
    return null;
  }

  async forward(
    jid: string,
    msg: WAMessage,
    opts?: { forceForward?: boolean; forwardScore?: number },
  ) {
    await this.client.sendMessage(
      jid,
      {
        forward: msg,
        contextInfo: {
          forwardingScore: opts?.forwardScore,
          isForwarded: opts?.forceForward,
        },
      },
      { quoted: this },
    );
  }

  async delete() {
    return await this.client.sendMessage(this.chat, { delete: this.key });
  }
}
