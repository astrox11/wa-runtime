import {
  bufferToPath,
  ToMp3,
  ToMp4,
  ToPTT,
  TrimVideo,
  type CommandProperty,
} from "..";

export default [
  {
    pattern: "mp3",
    category: "media",
    async exec(msg, sock) {
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
      if (!msg?.quoted?.video) {
        return await msg.reply("```Reply a video```");
      }

      const [start, end] = args;

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
] satisfies CommandProperty[];
