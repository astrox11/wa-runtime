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
  writeExifWebp,
} from "..";
import { readFile } from "fs/promises";

export class Message {
  client: WASocket;
  chat: string;
  key: WAMessageKey;
  message: WAMessageContent;
  isGroup: boolean;
  sender: string;
  pushName: string;
  image: boolean;
  video: boolean;
  audio: boolean;
  sudo: boolean;
  sticker: boolean;
  device: "web" | "unknown" | "android" | "ios" | "desktop";
  mode: "private" | "public";
  quoted: Quoted | undefined;
  text: string | undefined;
  type: string | undefined;
  sender_alt: string | undefined;
  contextInfo: proto.IContextInfo | undefined;

  constructor(client: WASocket, message: WAMessage) {
    this.client = client;
    this.chat = message.key.remoteJid!;
    this.key = message.key;
    this.message = normalizeMessageContent(message.message!);
    this.isGroup = isJidGroup(message.key.remoteJid!);
    this.sender = !this.isGroup
      ? !this.key.fromMe
        ? this.key.remoteJid
        : jidNormalizedUser(this.client.user.id)
      : this.key.participant;
    this.sender_alt = getAlternateId(this.sender);
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";
    this.device = getDevice(this.key.id);
    this.mode = getMode();
    this.sudo = isSudo(this.sender);
    this.pushName = message.pushName;

    const content = this.message?.[this.type!];
    this.contextInfo =
      typeof content === "object" && content !== null
        ? (content as any).contextInfo
        : undefined;

    this.quoted =
      this.contextInfo?.stanzaId && this.contextInfo?.quotedMessage
        ? new Quoted(this.contextInfo, client)
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

  async send_sticker(
    sticker: Buffer | URL | string,
    { author, packname }: { author?: string; packname?: string },
  ) {
    let data: any;

    if (Buffer.isBuffer(sticker)) {
      data = sticker;
    } else if (sticker instanceof URL) {
      const res = await fetch(sticker);
      data = Buffer.from(await res.arrayBuffer());
    } else if (typeof sticker === "string") {
      if (isPath(sticker)) {
        data = await readFile(sticker);
      } else if (isUrl(sticker)) {
        const res = await fetch(sticker);
        data = Buffer.from(await res.arrayBuffer());
      } else {
        throw new TypeError("Invalid sticker input");
      }
    } else {
      throw new TypeError("Unsupported sticker type");
    }

    data = await writeExifWebp(data, { author, packname });
    await this.client.sendMessage(this.chat, {
      sticker: { url: data },
    });
  }

  async send_btn(message: proto.IMessage["buttonsMessage"]) {
    const m = await this.client.relayMessage(
      this.chat,
      {
        documentWithCaptionMessage: { message: { ...message } },
      },
      {
        messageId: generateMessageIDV2(this.client.user.id),
        additionalNodes,
      },
    );
    return new Message(this.client, { key: { id: m } });
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
        messageId: generateMessageIDV2(this.client.user.id),
        additionalNodes,
      },
    );
    return new Message(this.client, { key: { id: m } });
  }

  async sendFile(sticker: Buffer | URL | string) {}

  async reply(text: string) {
    const msg = await this.client.sendMessage(
      this.chat,
      { text },
      { quoted: this },
    );
    return new Message(this.client, msg!);
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
    return await this.client.sendMessage(
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
}
