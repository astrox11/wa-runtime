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
    async exec(msg, _, args) {
      const user = parseId(msg?.quoted?.sender ?? args);
      if (!user)
        return await msg.reply("```Please provide or quote a user.```");

      const { pn, lid } = getBothId(user);
      if (isSudo(pn) || isSudo(lid))
        return await msg.reply("```User is already Sudo.```");

      addSudo(pn, lid);
      return await msg.send(
        `\`\`\`@${pn.split("@")[0]} is now sudo user.\`\`\``,
        { mentions: [pn, lid] },
      );
    },
  },
  {
    pattern: "delsudo",
    alias: ["removesudo"],
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const user = parseId(msg?.quoted?.sender ?? args);
      if (!user)
        return await msg.reply("```Please provide or quote a user.```");

      const { pn, lid } = getBothId(user);
      if (!isSudo(pn) && !isSudo(lid))
        return await msg.reply("```User is not a Sudo user.```");

      removeSudo(pn);
      return await msg.send(
        `\`\`\`@${pn.split("@")[0]} is no longer sudo user.\`\`\``,
        { mentions: [pn, lid] },
      );
    },
  },
  {
    pattern: "getsudo",
    alias: ["listsudo", "sudos"],
    isSudo: true,
    category: "settings",
    async exec(msg) {
      const sudos = getSudos(); // Assuming this returns an array of { pn, lid }
      if (!sudos.length) return await msg.reply("```No sudo users found.```");

      let text = "*Sudo Users List*\n\n";
      const mentions: string[] = [];

      sudos.forEach((sudo: any, index: any) => {
        text += `${index + 1}. @${sudo.pn.split("@")[0]}\n`;
        mentions.push(sudo.pn, sudo.lid);
      });

      return await msg.send(text.trim(), { mentions });
    },
  },
  {
    pattern: "mode",
    alias: ["setmode"],
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const targetMode = args?.trim().toLowerCase();
      const currentMode = getMode();

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

      setMode(targetMode as "private" | "public");
      return await msg.reply(
        `\`\`\`Mode changed: ${currentMode} ➜ ${targetMode}\`\`\``,
      );
    },
  },
] satisfies CommandProperty[];
