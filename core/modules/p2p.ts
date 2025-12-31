import { parseId, type CommandProperty } from "..";

export default [
  {
    pattern: "vv",
    alias: ["viewonce"],
    isSudo: true,
    category: "p2p",
    async exec(msg) {
      if (!msg?.quoted?.viewonce) {
        return await msg.reply("```reply view_once```");
      }

      msg.quoted.message[msg.quoted.type].viewOnce = false;
      await msg.forward(msg.chat, msg.quoted);
    },
  },
  {
    pattern: "block",
    isSudo: true,
    category: "p2p",
    async exec(msg, _, args) {
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;

      if (!args)
        return await msg.reply(
          "```Provide a number or reply someone's message!```",
        );
      const jid = parseId(msg.sessionId, args);
      if (!jid) return await msg.reply("Invalid number!");
      await msg.reply("ᴅᴏɴᴇ");
      return await msg.block(jid);
    },
  },
  {
    pattern: "unblock",
    isSudo: true,
    category: "p2p",
    async exec(msg, _, args) {
      args = msg?.quoted?.sender || args?.replace(/[^a-zA-Z0-9]/g, "");
      if (!msg.isGroup && !args) args = msg.chat;

      if (!args)
        return await msg.reply(
          "```Provide a number or reply someone's message!```",
        );
      const jid = parseId(msg.sessionId, args);
      if (!jid) return await msg.reply("Invalid number!");
      await msg.unblock(jid);
      return await msg.reply("ᴅᴏɴᴇ");
    },
  },
] satisfies Array<CommandProperty>;
