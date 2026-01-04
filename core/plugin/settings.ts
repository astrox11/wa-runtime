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
  set_prefix,
  del_prefix,
} from "..";

export default [
  {
    pattern: "setsudo",
    alias: ["addsudo"],
    isSudo: true,
    category: "settings",
    async exec(msg, sock, args) {
      if (!sock) return;
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;
      const userArg = msg?.quoted?.sender ?? args;
      if (!userArg)
        return await msg.reply("```Please provide or quote a user.```");
      const user = parseId(msg.sessionId, userArg);
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
      if (!sock) return;
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;
      const userArg = msg?.quoted?.sender ?? args;
      if (!userArg)
        return await msg.reply("```Please provide or quote a user.```");
      const user = parseId(msg.sessionId, userArg);
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
      if (!sock) return;
      const sudos = getSudos(msg.sessionId);
      if (!sudos.length) return await msg.reply("```No sudo users found.```");

      let text = "*Sudo Users List*\n\n";
      const mentions: string[] = [];

      sudos.forEach((sudo: { pn: string; lid: string }, index: number) => {
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
  {
    pattern: "setprefix",
    alias: ["prefix"],
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const prefix = args?.trim();

      if (!prefix) {
        const currentPrefix = msg.prefix;
        if (!currentPrefix) {
          return await msg.reply(
            "```No prefix is currently set.\nUsage: setprefix <symbols>\nExample: setprefix !.```",
          );
        }
        return await msg.reply(
          `\`\`\`Current prefix: ${currentPrefix.join("")}\nUsage: setprefix <symbols> | setprefix off\`\`\``,
        );
      }

      if (prefix.toLowerCase() === "off") {
        del_prefix(msg.sessionId);
        return await msg.reply("```Prefix has been disabled.```");
      }

      if (/[a-zA-Z0-9\s]/.test(prefix)) {
        return await msg.reply(
          "```Only symbols are allowed as prefix characters. Letters, numbers, and whitespace are not allowed.```",
        );
      }

      set_prefix(msg.sessionId, prefix);
      return await msg.reply(`\`\`\`Prefix set to: ${prefix}\`\`\``);
    },
  },
] satisfies CommandProperty[];
