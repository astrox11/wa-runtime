import { formatRuntime, type CommandProperty } from "../";

export default [
  {
    pattern: "ping",
    alias: ["speed"],
    category: "util",
    async exec(msg) {
      const start = Date.now();
      const m = await msg.reply("```pong```");
      const end = Date.now();
      await m.edit(`${end - start}ms`);
    },
  },
  {
    pattern: "runtime",
    alias: ["uptime"],
    category: "util",
    async exec(msg) {
      const time = formatRuntime(process.uptime());
      return await msg.reply("```" + time + "```");
    },
  },
  {
    pattern: "join",
    category: "util",
    isSudo: true,
    async exec(msg, sock, args) {
      args = msg?.quoted?.text || args;
      if (!args) return await msg.reply("Provide a group link!");
      const linkRegex = /https?:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
      const match = args.match(linkRegex);
      if (!match) return await msg.reply("Invalid group link!");
      const inviteCode = match[1];
      const status = await sock.groupAcceptInvite(inviteCode);
      if (status) return await msg.reply("ᴅᴏɴᴇ");
      if (!status)
        return await msg.reply(
          "Failed to join the group. It may be full or the link is invalid or you might have been removed.",
        );
    },
  },
] satisfies Array<CommandProperty>;
