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
  sender_alt: string;
  message: WAMessageContent;
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
      participantAlt: getAlternateId(this.sessionId, quoted.participant),
    };
    this.sender = quoted.participant!;
    this.sender_alt = this.key.participantAlt;
    this.message = normalizeMessageContent(quoted.quotedMessage!);
    this.type = getContentType(this.message);
    this.image = this.type === "imageMessage";
    this.video = this.type === "videoMessage";
    this.audio = this.type === "audioMessage";
    this.sticker =
      this.type === "stickerMessage" || this.type === "lottieStickerMessage";
    this.sudo = isSudo(this.sessionId, this.sender);

    this.text = ExtractTextFromMessage(this.message);
    this.client = client;
    this.media = [this.image, this.video, this.audio, this.sticker].includes(
      true,
    );
    this.viewonce = this.media && this.message?.[this.type!]?.viewOnce === true;
    this.device = getDevice(this.key.id);

    Object.defineProperty(this, "client", { value: client, enumerable: false });
  }
  async download() {
    return await downloadMediaMessage(this, "buffer", {});
  }
}
