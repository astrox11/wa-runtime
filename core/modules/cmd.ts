import type { CommandProperty } from "..";
import { Plugins } from "../classes";
import {
  saveSticker,
  getStickerByName,
  deleteSticker,
  getAllStickers,
} from "..";

export default [
  {
    pattern: "setcmd",
    category: "util",
    async exec(msg, sock, args) {
      if (!msg?.quoted?.sticker) {
        return await msg.reply("```Reply to a sticker```");
      }

      if (!args) {
        return await msg.reply("```Usage: setcmd <command_name>```");
      }

      const commandName = args.trim().toLowerCase();

      const plugins = new Plugins(msg, sock);
      const command = plugins.find(commandName);

      if (!command) {
        return await msg.reply(
          `\`\`\`Command '${commandName}' not found in the system\`\`\``,
        );
      }

      try {
        // Get the sticker's sha256 from the quoted message
        const stickerMessage = msg.quoted.message?.stickerMessage;
        const sha256 = stickerMessage?.fileSha256;

        if (!sha256) {
          return await msg.reply("```Could not get sticker data```");
        }

        // Convert Buffer to hex string if needed
        const sha256Hex = Buffer.isBuffer(sha256)
          ? sha256.toString("hex")
          : sha256.toString();

        // Save the sticker with the command name
        saveSticker(msg.sessionId, commandName, sha256Hex);

        await msg.reply(
          `\`\`\`Sticker saved for command: ${commandName}\`\`\``,
        );
      } catch (error) {
        const e = error instanceof Error ? error.message : String(error);
        await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
      }
    },
  },
  {
    pattern: "delcmd",
    category: "util",
    async exec(msg, _, args) {
      if (!args) {
        return await msg.reply("```Usage: delcmd <command_name>```");
      }

      const commandName = args.trim().toLowerCase();

      try {
        // Check if the sticker exists
        const sticker = getStickerByName(msg.sessionId, commandName);

        if (!sticker) {
          return await msg.reply(
            `\`\`\`No sticker found for command: ${commandName}\`\`\``,
          );
        }

        // Delete the sticker
        deleteSticker(msg.sessionId, commandName);

        await msg.reply(
          `\`\`\`Sticker deleted for command: ${commandName}\`\`\``,
        );
      } catch (error) {
        const e = error instanceof Error ? error.message : String(error);
        await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
      }
    },
  },
  {
    pattern: "getcmd",
    category: "util",
    async exec(msg, _, args) {
      if (!args) {
        // List all saved sticker commands
        try {
          const stickers = getAllStickers(msg.sessionId);

          if (stickers.length === 0) {
            return await msg.reply("```No sticker commands saved```");
          }

          let reply = "```Saved Sticker Commands:\n";
          for (const sticker of stickers) {
            reply += `- ${sticker.name}\n`;
          }
          reply += "```";

          await msg.reply(reply);
        } catch (error) {
          const e = error instanceof Error ? error.message : String(error);
          await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
        }
      } else {
        // Get specific sticker command
        const commandName = args.trim().toLowerCase();

        try {
          const sticker = getStickerByName(msg.sessionId, commandName);

          if (!sticker) {
            return await msg.reply(
              `\`\`\`No sticker found for command: ${commandName}\`\`\``,
            );
          }

          await msg.reply(
            `\`\`\`Sticker found for command: ${commandName}\nSHA256: ${sticker.sha256}\`\`\``,
          );
        } catch (error) {
          const e = error instanceof Error ? error.message : String(error);
          await msg.reply(`\`\`\`Error: ${e}\n\`\`\``);
        }
      }
    },
  },
] satisfies CommandProperty[];
