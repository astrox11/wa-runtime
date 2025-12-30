import type { CommandProperty } from "..";
import { saveBgm, deleteBgm, getAllBgms } from "../sql";

export default [
  {
    pattern: "bgm",
    category: "media",
    async exec(msg, _, args) {
      if (!msg?.quoted?.audio) {
        return await msg.reply("```Reply to an audio message```");
      }

      if (!args) {
        return await msg.reply("```Usage: bgm <trigger>```");
      }

      try {
        const audioBuffer = await msg.quoted.download();
        const audioData = audioBuffer.toString("base64");
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
] satisfies CommandProperty[];
