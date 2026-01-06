import { replacePlaceholders, type CommandProperty } from "..";
import {
  getMentionData,
  setMentionMessage,
  deleteMentionMessage,
} from "../sql";
import config from "../../config";
import { jidNormalizedUser } from "baileys";

export default [
  {
    pattern: "mention",
    alias: ["setmention"],
    category: "groups",
    isGroup: true,
    async exec(msg, sock, args) {
      if (args) {
        setMentionMessage(msg.sessionId, msg.chat, {
          message: args,
          type: "text",
        });
        return await msg.reply("```Mention text updated.```");
      }

      if (msg.quoted) {
        const type = msg.quoted.type ?? "unknown";
        setMentionMessage(msg.sessionId, msg.chat, {
          type: type,
          data: msg.quoted,
        });
        return await msg.reply(`\`\`\`Mention set as ${type}\`\`\``);
      }

      return await msg.reply(
        "```Provide text or reply to media to set mention.```",
      );
    },
  },
  {
    pattern: "getmention",
    category: "groups",
    isGroup: true,
    async exec(msg) {
      const data = getMentionData(msg.sessionId, msg.chat);
      if (!data) return msg.reply("```No mention found.```");
      await msg.reply(
        `\`\`\`Type: ${data.type}\nContent: ${data.message || "Media File"}\`\`\``,
      );
    },
  },
  {
    pattern: "delmention",
    category: "groups",
    isGroup: true,
    async exec(msg) {
      deleteMentionMessage(msg.sessionId, msg.chat);
      await msg.reply("```Mention message deleted.```");
    },
  },
  {
    event: true,
    async exec(msg, sock) {
      if (!sock) return;
      if (
        !msg.isGroup ||
        !(
          (sock.user?.id &&
            msg.mentions?.includes(jidNormalizedUser(sock.user.id))) ||
          (sock.user?.lid &&
            msg.mentions?.includes(jidNormalizedUser(sock.user.lid)))
        )
      )
        return;

      const data = getMentionData(msg.sessionId, msg.chat);
      if (!data) return;

      if (data.type === "text" && data.message) {
        const processed = await replacePlaceholders(
          data.message,
          msg.sender,
          sock.user?.id ?? "",
          config.BOT_NAME,
        );
        await sock.sendMessage(
          msg.chat,
          {
            text: processed,
            mentions: [msg.sender, sock.user?.id].filter(
              (m): m is string => typeof m === "string",
            ),
          },
          { quoted: msg },
        );
      } else {
        await msg.forward(msg.chat, data?.data as any);
      }
    },
  },
] satisfies CommandProperty[];
