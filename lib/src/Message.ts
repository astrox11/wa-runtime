import {
  downloadMediaMessage,
  getContentType,
  isJidGroup,
  normalizeMessageContent,
} from "baileys";
import type {
  WASocket,
  WAMessage,
  proto,
  WAMessageContent,
  WAMessageKey,
} from "baileys";
import { fileTypeFromBuffer } from "file-type";

export class Message {
  client: WASocket;
  chat: string;
  key: WAMessageKey;
  message: WAMessageContent;
  isGroup: boolean;
  sender: string;
  sender_alt: string | undefined;
  type: string | undefined;
  image: boolean;
  video: boolean;
  audio: boolean;
  sticker: boolean;
  contextInfo: proto.IContextInfo | undefined;
  quoted: Quoted | undefined;
  text: string | undefined;

  constructor(client: WASocket, message: WAMessage) {
    this.client = client;
    this.chat = message.key.remoteJid!;
    this.key = message.key;
    this.message = normalizeMessageContent(message.message!);
    this.isGroup = isJidGroup(message.key.remoteJid!);
    this.sender = !this.isGroup ? this.key.remoteJid : this.key.participant;
    this.sender_alt = !this.isGroup
      ? this.key.remoteJidAlt
      : this.key.participantAlt;
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";

    const content = this.message?.[this.type!];
    this.contextInfo =
      typeof content === "object" && content !== null
        ? (content as any).contextInfo
        : undefined;

    this.quoted =
      this.contextInfo?.stanzaId && this.contextInfo?.quotedMessage
        ? new Quoted(this.contextInfo, client)
        : undefined;

    this.text = this.message ? extract_text(this.message) : undefined;

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

  async send(
    content: string | Buffer,
    options: {
      caption?: string;
      mimetype?: string;
      filename?: string;
      gifPlayback?: boolean;
    } = {},
  ) {
    const isBuffer = Buffer.isBuffer(content);
    const isUrl = typeof content === "string" && /^https?:\/\//i.test(content);
    const isText = typeof content === "string" && !isUrl;

    if (isText) {
      const msg = await this.client.sendMessage(
        this.chat,
        { text: content },
        { quoted: this },
      );
      return new Message(this.client, msg!);
    }

    let mediaType: string;
    let detectedMimetype: string | undefined = options.mimetype;

    if (isBuffer) {
      try {
        const fileType = await fileTypeFromBuffer(content);
        if (fileType) {
          detectedMimetype = detectedMimetype || fileType.mime;
          mediaType = this.mimetypeToMediaType(fileType.mime);
        } else {
          // Fallback for text-based or unrecognized formats
          mediaType = "document";
          detectedMimetype = detectedMimetype || "application/octet-stream";
        }
      } catch {
        mediaType = "document";
        detectedMimetype = detectedMimetype || "application/octet-stream";
      }
    } else {
      const detection = this.detectFromUrl(content, options.mimetype);
      mediaType = detection.type;
      detectedMimetype = detectedMimetype || detection.mimetype;
    }
    const mediaContent: any = isUrl ? { url: content } : content;
    const messageData: any = {
      [mediaType]: mediaContent,
      ...(options.caption && { caption: options.caption }),
      ...(detectedMimetype && { mimetype: detectedMimetype }),
      ...(options.filename &&
        mediaType === "document" && { fileName: options.filename }),
      ...(options.gifPlayback &&
        mediaType === "video" && { gifPlayback: true }),
    };

    const msg = await this.client.sendMessage(this.chat, messageData, {
      quoted: this,
    });
    return new Message(this.client, msg!);
  }

  private mimetypeToMediaType(mimetype: string): string {
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype.startsWith("audio/")) return "audio";
    return "document";
  }

  private detectFromUrl(
    url: string,
    mimetype?: string,
  ): { type: string; mimetype?: string } {
    if (mimetype) {
      return { type: this.mimetypeToMediaType(mimetype), mimetype };
    }

    // Extension-based fallback
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    const extMap: Record<string, { type: string; mimetype: string }> = {
      jpg: { type: "image", mimetype: "image/jpeg" },
      jpeg: { type: "image", mimetype: "image/jpeg" },
      png: { type: "image", mimetype: "image/png" },
      gif: { type: "image", mimetype: "image/gif" },
      webp: { type: "image", mimetype: "image/webp" },
      mp4: { type: "video", mimetype: "video/mp4" },
      webm: { type: "video", mimetype: "video/webm" },
      mkv: { type: "video", mimetype: "video/x-matroska" },
      mp3: { type: "audio", mimetype: "audio/mpeg" },
      ogg: { type: "audio", mimetype: "audio/ogg" },
      wav: { type: "audio", mimetype: "audio/wav" },
      m4a: { type: "audio", mimetype: "audio/mp4" },
      pdf: { type: "document", mimetype: "application/pdf" },
    };

    return (
      extMap[ext!] || { type: "document", mimetype: "application/octet-stream" }
    );
  }
}

class Quoted {
  key: WAMessageKey;
  message: WAMessageContent;
  type: string | undefined;
  image: boolean;
  video: boolean;
  audio: boolean;
  sticker: boolean;
  client: WASocket;
  media: boolean;
  viewonce: boolean;

  constructor(quoted: proto.IContextInfo, client: WASocket) {
    this.key = {
      remoteJid: quoted.remoteJid,
      id: quoted.stanzaId,
      participant: quoted.participant,
      participantAlt: undefined,
    };
    this.message = normalizeMessageContent(quoted.quotedMessage!);
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";

    this.client = client;
    this.media = [this.image, this.video, this.audio, this.sticker].includes(
      true,
    );
    this.viewonce = this.media && this.message?.[this.type!]?.viewOnce === true;

    Object.defineProperty(this, "client", { value: client, enumerable: false });
  }
  async download() {
    return await downloadMediaMessage(this, "buffer", {});
  }
}

function extract_text(message: WAMessageContent): string | undefined {
  if (message?.extendedTextMessage?.text)
    return message.extendedTextMessage.text;
  if (message?.conversation) return message.conversation;
  if (message?.imageMessage?.caption) return message.imageMessage.caption;
  if (message?.videoMessage?.caption) return message.videoMessage.caption;
  if (message?.documentMessage?.caption) return message.documentMessage.caption;
  if (message?.buttonsMessage?.contentText)
    return message.buttonsMessage.contentText;
  if (message?.templateMessage?.hydratedTemplate?.hydratedContentText)
    return message.templateMessage.hydratedTemplate.hydratedContentText;
  if (message?.listMessage?.description) return message.listMessage.description;
  if (message?.protocolMessage?.editedMessage) {
    const text = extract_text(message.protocolMessage.editedMessage);
    if (text) return text;
  }
  return undefined;
}
