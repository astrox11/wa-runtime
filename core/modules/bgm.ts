import type { WAMessage } from "baileys";
import { log, type CommandProperty } from "..";
import { saveBgm, deleteBgm, getAllBgms } from "..";

export default [
  {
    pattern: "bgm",
    alias: ["setbgm"],
    isSudo: true,
    category: "media",
    async exec(msg, _, args) {
      if (!msg?.quoted?.audio) {
        return await msg.reply("```Reply to an audio message```");
      }

      if (!args) {
        return await msg.reply("```Usage: bgm <trigger>```");
      }

      try {
        const audioData = JSON.stringify(msg.quoted);
        saveBgm(msg.sessionId, args.trim(), audioData);
        await msg.reply(`\`\`\`BGM saved with trigger: ${args.trim()}\`\`\``);
      } catch (error) {
        const e = error instanceof Error ? error.message : String(error);
        await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
      }
    },
  },
  {
    pattern: "delbgm",
    isSudo: true,
    category: "media",
    async exec(msg, _, args) {
      if (!args) {
        return await msg.reply("```Usage: delbgm <trigger>```");
      }

      try {
        deleteBgm(msg.sessionId, args.trim());
        await msg.reply(`\`\`\`BGM deleted: ${args.trim()}\`\`\``);
      } catch (error) {
        const e = error instanceof Error ? error.message : String(error);
        await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
      }
    },
  },
  {
    pattern: "getbgm",
    isSudo: true,
    category: "media",
    async exec(msg) {
      try {
        const bgms = getAllBgms(msg.sessionId);

        if (bgms.length === 0) {
          return await msg.reply("```No BGMs found```");
        }

        let reply = "```Saved BGMs:\n";
        for (const bgm of bgms) {
          reply += `- ${bgm.trigger}\n`;
        }
        reply += "```";

        await msg.reply(reply);
      } catch (error) {
        const e = error instanceof Error ? error.message : String(error);
        await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
      }
    },
  },
  {
    event: true,
    async exec(msg) {
      if (!msg.text || msg.key.fromMe) return;

      try {
        const bgms = getAllBgms(msg.sessionId);
        const match = bgms.find(
          (b) => b.trigger.toLowerCase() === msg.text.toLowerCase().trim(),
        );
        if (match) {
          const audioMsg = JSON.parse(match.audioData) as WAMessage;
          await msg.forward(msg.chat, audioMsg);
        }
      } catch (e) {
        log.error(e);
      }
    },
  },
] satisfies CommandProperty[];
