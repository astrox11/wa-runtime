import type { CommandProperty } from "..";
import { saveBgm } from "../sql";

export default {
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
      // Download the quoted audio
      const audioBuffer = await msg.quoted.download();
      
      // Convert buffer to base64 for storage
      const audioData = audioBuffer.toString("base64");

      // Save trigger and audio data to BGM table
      saveBgm(msg.sessionId, args.trim(), audioData);

      await msg.reply(`\`\`\`BGM saved with trigger: ${args.trim()}\`\`\``);
    } catch (error) {
      const e = error instanceof Error ? error.message : String(error);
      await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
    }
  },
} satisfies CommandProperty;
