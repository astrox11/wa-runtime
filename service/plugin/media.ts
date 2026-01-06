import { addStickerMetadata, convertToWebP } from "whatsapp-rust-bridge";
import {
  bufferToPath,
  ToMp3,
  ToMp4,
  ToPTT,
  TrimVideo,
  videoWebp,
  type CommandProperty,
} from "..";
import { log } from "console";

export default [
  {
    pattern: "mp3",
    category: "media",
    async exec(msg, sock) {
      if (!sock) return;
      if (!msg?.quoted?.video) {
        return await msg.reply("```Reply a video```");
      }

      const media = bufferToPath(await msg.quoted.download());
      const mp3 = ToMp3(media);

      return await sock.sendMessage(msg.chat, {
        audio: { url: mp3 },
        mimetype: "audio/mpeg",
      });
    },
  },

  {
    pattern: "mp4",
    category: "media",
    async exec(msg, sock) {
      if (!sock) return;
      if (!msg?.quoted?.video) {
        return await msg.reply("```Reply a video```");
      }

      const media = bufferToPath(await msg.quoted.download());
      const mp4 = ToMp4(media);

      return await sock.sendMessage(msg.chat, {
        video: { url: mp4 },
        mimetype: "video/mp4",
        caption: "✅ Converted to MP4",
      });
    },
  },
  {
    pattern: "trim",
    category: "media",
    async exec(msg, sock, args) {
      if (!sock) return;
      if (!msg?.quoted?.video) {
        return await msg.reply("```Reply a video```");
      }

      if (!args) {
        return await msg.reply(
          "```Usage: trim <start> <end>\n\nExamples:\ntrim 10 30\ntrim 00:01:00 00:02:00```",
        );
      }

      const [start, end] = args.split(" ");

      if (!start || !end) {
        return await msg.reply(
          "```Usage: trim <start> <end>\n\nExamples:\ntrim 10 30\ntrim 00:01:00 00:02:00```",
        );
      }

      const media = bufferToPath(await msg.quoted.download());
      const trimmed = TrimVideo(media, start, end);

      return await sock.sendMessage(msg.chat, {
        video: { url: trimmed },
        mimetype: "video/mp4",
        caption: `✂️ Trimmed: ${start} → ${end}`,
      });
    },
  },
  {
    pattern: "ptt",
    alias: ["opus"],
    category: "media",
    async exec(msg, sock) {
      if (!sock) return;
      if (!msg?.quoted?.video && !msg?.quoted?.audio) {
        return await msg.reply("```Reply to a video or audio```");
      }

      const media = bufferToPath(await msg.quoted.download());
      const ptt = ToPTT(media);

      return await sock.sendMessage(msg.chat, {
        audio: { url: ptt },
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
      });
    },
  },
  {
    pattern: "sticker",
    alias: ["stiker", "s"],
    category: "media",
    async exec(msg, sock, args) {
      if (!sock) return;
      if (!msg?.quoted?.image && !msg?.quoted?.video) {
        return await msg.reply(
          "```Reply to an image or a video\n\nExamples:\nsticker\nsticker Author:PackName```",
        );
      }

      let sticker: Uint8Array;
      const packName = args?.split(":")[1] || "Whatsaly";
      const publisher = args?.split(":")[0] || "αѕтяσχ";

      if (msg.quoted?.image) {
        sticker = convertToWebP(await msg.quoted.download());
        sticker = addStickerMetadata(sticker, {
          packName,
          publisher,
        });
        return await msg.client.sendMessage(msg.chat, {
          sticker: Buffer.from(sticker),
        });
      } else {
        sticker = await videoWebp(bufferToPath(await msg.quoted.download()));
        sticker = addStickerMetadata(sticker, {
          packName,
          publisher,
        });
        return await msg.client.sendMessage(msg.chat, {
          sticker: Buffer.from(sticker),
        });
      }
    },
  },
] satisfies CommandProperty[];
