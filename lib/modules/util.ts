import { formatRuntime, type CommandProperty } from "..";

export default [
  {
    pattern: "ping",
    alias: ["speed"],
    category: "util",
    async exec(msg) {
      const start = Date.now();
      const m = await msg.reply("```pong```");
      const end = Date.now();
      await m.edit(`\`\`\`${end - start} ms\`\`\``);
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
  {
    pattern: "ginfo",
    alias: ["groupinfo"],
    category: "util",
    async exec(msg, sock, args) {
      args = msg?.quoted?.text || args;
      if (!args) {
        return await msg.reply("Provide a WhatsApp group link!");
      }

      const linkRegex =
        /^https?:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})$/i;

      const match = args.trim().match(linkRegex);
      if (!match) {
        return await msg.reply("Invalid WhatsApp group link");
      }

      const inviteCode = match[1];

      try {
        const info = await sock.groupGetInviteInfo(inviteCode);

        return await sock.sendMessage(msg.chat, {
          text:
            "```" +
            [
              `Name: ${info.subject}`,
              `Owner: @${info.owner.split("@")[0] ?? "Unknown"}`,
              `Members: ${info.size}`,
              `Description: ${info.desc ?? "None"}`,
            ].join("\n") +
            "```",
          mentions: [info.owner],
        });
      } catch {
        return await msg.reply(
          "Failed to fetch group info. The link may be revoked or expired.",
        );
      }
    },
  },
] satisfies Array<CommandProperty>;
