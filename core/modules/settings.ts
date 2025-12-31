import {
  addSudo,
  removeSudo,
  getSudos,
  getBothId,
  isSudo,
  parseId,
  type CommandProperty,
  getMode,
  setMode,
} from "..";

export default [
  {
    pattern: "setsudo",
    alias: ["addsudo"],
    isSudo: true,
    category: "settings",
    async exec(msg, sock, args) {
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;
      const user = parseId(msg.sessionId, msg?.quoted?.sender ?? args);
      if (!user)
        return await msg.reply("```Please provide or quote a user.```");

      const bothId = getBothId(msg.sessionId, user);
      if (!bothId) return await msg.reply("```Could not resolve user ID.```");

      const { pn, lid } = bothId;
      if (isSudo(msg.sessionId, pn) || isSudo(msg.sessionId, lid))
        return await msg.reply("```User is already Sudo.```");

      addSudo(msg.sessionId, pn, lid);
      return await sock.sendMessage(msg.chat, {
        text: `\`\`\`@${pn.split("@")[0]} is now sudo user.\`\`\``,
        mentions: [pn, lid],
      });
    },
  },
  {
    pattern: "delsudo",
    alias: ["removesudo"],
    isSudo: true,
    category: "settings",
    async exec(msg, sock, args) {
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;
      const user = parseId(msg.sessionId, msg?.quoted?.sender ?? args);
      if (!user)
        return await msg.reply("```Please provide or quote a user.```");

      const bothId = getBothId(msg.sessionId, user);
      if (!bothId) return await msg.reply("```Could not resolve user ID.```");

      const { pn, lid } = bothId;
      if (!isSudo(msg.sessionId, pn) && !isSudo(msg.sessionId, lid))
        return await msg.reply("```User is not a Sudo user.```");

      removeSudo(msg.sessionId, pn);
      return await sock.sendMessage(msg.chat, {
        text: `\`\`\`@${pn.split("@")[0]} is no longer a sudo user.\`\`\``,
        mentions: [pn, lid],
      });
    },
  },
  {
    pattern: "getsudo",
    alias: ["listsudo", "sudos"],
    isSudo: true,
    category: "settings",
    async exec(msg, sock) {
      const sudos = getSudos(msg.sessionId);
      if (!sudos.length) return await msg.reply("```No sudo users found.```");

      let text = "*Sudo Users List*\n\n";
      const mentions: string[] = [];

      sudos.forEach((sudo: any, index: any) => {
        text += `${index + 1}. @${sudo.pn.split("@")[0]}\n`;
        mentions.push(sudo.pn, sudo.lid);
      });

      return await sock.sendMessage(msg.chat, { text: text.trim(), mentions });
    },
  },
  {
    pattern: "mode",
    alias: ["setmode"],
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const targetMode = args?.trim().toLowerCase();
      const currentMode = getMode(msg.sessionId);

      if (!targetMode) {
        return await msg.reply(
          `\`\`\`Bot is currently in ${currentMode} mode.\nUsage: mode private | public\`\`\``,
        );
      }

      if (targetMode !== "private" && targetMode !== "public") {
        return await msg.reply(
          "```Invalid mode. Use: mode private | public```",
        );
      }

      if (currentMode === targetMode) {
        return await msg.reply(
          `\`\`\`Bot is already in ${currentMode} mode.\`\`\``,
        );
      }

      setMode(msg.sessionId, targetMode as "private" | "public");
      return await msg.reply(
        `\`\`\`Mode changed: ${currentMode} ➜ ${targetMode}\`\`\``,
      );
    },
  },
] satisfies CommandProperty[];
