import {
  getDevice,
  getContentType,
  downloadMediaMessage,
  normalizeMessageContent,
} from "baileys";
import type { proto, WASocket, WAMessageKey, WAMessageContent } from "baileys";
import { getAlternateId, isSudo, ExtractTextFromMessage } from "..";

export class Quoted {
  key: WAMessageKey;
  sender: string;
  sender_alt: string | null | undefined;
  message: WAMessageContent | undefined;
  type: string | undefined;
  image: boolean;
  video: boolean;
  audio: boolean;
  sticker: boolean;
  sudo: boolean;
  text: string | undefined;
  client: WASocket;
  sessionId: string;
  media: boolean;
  viewonce: boolean;
  device: "web" | "unknown" | "android" | "ios" | "desktop";

  constructor(
    quoted: proto.IContextInfo,
    client: WASocket,
    sessionId: string = "main",
  ) {
    this.sessionId = sessionId;
    this.key = {
      remoteJid: quoted.remoteJid,
      id: quoted.stanzaId,
      participant: quoted.participant,
      participantAlt: quoted.participant
        ? (getAlternateId(this.sessionId, quoted.participant) ?? undefined)
        : undefined,
    };
    this.sender = quoted.participant ?? "";
    this.sender_alt = this.key.participantAlt;
    this.message = normalizeMessageContent(quoted.quotedMessage ?? undefined);
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";
    this.sudo = isSudo(this.sessionId, this.sender);

    this.text = this.message ? ExtractTextFromMessage(this.message) : undefined;
    this.client = client;
    this.media = [this.image, this.video, this.audio, this.sticker].includes(
      true,
    );
    const messageContent =
      this.message && this.type
        ? (this.message as Record<string, unknown>)[this.type]
        : undefined;
    this.viewonce =
      this.media &&
      typeof messageContent === "object" &&
      messageContent !== null &&
      (messageContent as { viewOnce?: boolean }).viewOnce === true;
    this.device = getDevice(this.key.id ?? "");

    Object.defineProperty(this, "client", { value: client, enumerable: false });
  }
  async download() {
    return await downloadMediaMessage(this, "buffer", {});
  }
}
