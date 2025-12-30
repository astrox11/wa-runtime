import type { CommandProperty } from "..";
import { getAfk, setAfk } from "../sql";
import { jidNormalizedUser } from "baileys";

export default [
  {
    pattern: "afk",
    category: "util",
    async exec(msg, _, args) {
      if (!args) {
        const currentAfk = getAfk(msg.sessionId);
        
        if (currentAfk && currentAfk.status === 1) {
          setAfk(msg.sessionId, false);
          return await msg.reply("```AFK mode disabled```");
        } else {
          setAfk(msg.sessionId, true, "I'm currently AFK");
          return await msg.reply("```AFK mode enabled```");
        }
      } else {
        const command = args.toLowerCase().split(" ")[0];
        
        if (command === "on") {
          const customMessage = args.substring(3).trim();
          setAfk(msg.sessionId, true, customMessage || "I'm currently AFK");
          return await msg.reply("```AFK mode enabled```");
        } else if (command === "off") {
          setAfk(msg.sessionId, false);
          return await msg.reply("```AFK mode disabled```");
        } else {
          setAfk(msg.sessionId, true, args);
          return await msg.reply("```AFK mode enabled with custom message```");
        }
      }
    },
  },
  {
    event: true,
    dontAddToCommandList: true,
    async exec(msg, sock) {
      const afkStatus = getAfk(msg.sessionId);
      
      if (afkStatus && afkStatus.status === 1) {
        const botJid = jidNormalizedUser(sock.user.id);
        const mentions = msg.contextInfo?.mentionedJid || [];
        
        if (mentions.includes(botJid)) {
          const afkMessage = afkStatus.message || "I'm currently AFK";
          await msg.reply(`\`\`\`${afkMessage}\`\`\``);
        }
      }
    },
  },
] satisfies CommandProperty[];
