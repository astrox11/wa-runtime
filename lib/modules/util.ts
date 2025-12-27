import { generateMessageID } from "baileys";
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
    isSudo: true,
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
  {
    pattern: "url",
    alias: ["shortenurl"],
    category: "util",
    async exec(msg, sock, args) {
      args = msg?.quoted?.text || args;
      if (!args) {
        return await msg.reply("Provide a URL!");
      }

      const urlRegex =
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?$/i;

      const match = args.trim().match(urlRegex);
      if (!match) {
        return await msg.reply("Invalid URL");
      }

      const url = match[0];

      try {
        const response = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        );
        const shortenedUrl = await response.text();

        return await msg.reply(`Shortened URL: ${shortenedUrl}`);
      } catch {
        return await msg.reply("Failed to shorten URL");
      }
    },
  },
  {
    pattern: "gstatus",
    alias: ["groupstatus"],
    category: "util",
    isSudo: true,
    isGroup: true,
    async exec(msg, sock, args) {
      if (!args)
        return await msg.reply("```type something to send in the status```");
      await sock.relayMessage(
        msg.chat,
        {
          groupStatusMessageV2: {
            message: {
              interactiveResponseMessage: {
                body: {
                  text: args,
                  format: 0,
                },
                nativeFlowResponseMessage: {
                  name: "galaxy_message",
                  version: 3,
                  paramsJson: JSON.stringify({
                    title: args,
                    flow_id: generateMessageID(),
                    flow_name: "offer_sign_up_076588",
                    flow_creation_source: "FLEXIBLE_CHECKOUT",
                  }),
                },
                contextInfo: {
                  isGroupStatus: true,
                },
              },
            },
          },
        },
        { messageId: generateMessageID() },
      );
      return await msg.reply("```Done```");
    },
  },
] satisfies Array<CommandProperty>;
