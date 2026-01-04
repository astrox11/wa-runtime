import {
  setAntilink,
  getAntilinkMode,
  containsUrl,
  Group,
  type CommandProperty,
} from "..";

export default [
  {
    pattern: "antilink",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!args) {
        return await msg.reply("```Usage: antilink on|off|mode```");
      }

      const argsArray = args.split(" ");

      const command = argsArray?.[0]?.toLowerCase()?.trim();
      const mode_option = argsArray?.[1];

      if (command === "on") {
        setAntilink(msg.sessionId, msg.chat, 1);
        return await msg.reply("```Antilink enabled (delete only)```");
      } else if (command === "off") {
        setAntilink(msg.sessionId, msg.chat, 0);
        return await msg.reply("```Antilink disabled```");
      } else if (command === "mode") {
        if (!mode_option || !["delete", "kick"].includes(mode_option)) {
          return await msg.reply(
            "```Usage: antilink mode 1|2\nMode 1: Delete link only\nMode 2: Delete link & Kick user```",
          );
        }
        setAntilink(msg.sessionId, msg.chat, mode_option === "delete" ? 1 : 2);
        return await msg.reply(
          `\`\`\`Antilink mode set to ${mode_option}\`\`\``,
        );
      } else {
        return await msg.reply("```Usage: antilink on|off|mode```");
      }
    },
  },
  {
    event: true,
    dontAddToCommandList: true,
    async exec(msg, sock) {
      if (!msg.text || !sock || !msg.isGroup || msg.sudo || msg.isAdmin) return;
      if (!containsUrl(msg.text)) return;

      const mode = getAntilinkMode(msg.sessionId, msg.chat);
      if (mode === 0) return;

      if (mode === 1) {
        await msg.delete();
        return await msg.send(
          `\`\`\`@${msg.sender.split("@")[0]} Links are not allowed here!\`\`\``,
          { mentions: [msg.sender] },
        );
      } else if (mode === 2) {
        await msg.delete();

        await new Group(msg.sessionId, msg.chat, sock).remove(msg.sender);
        return await msg.send(
          `\`\`\`@${msg.sender.split("@")[0]} has been removed for sharing links, links are not allowed on this Group!\`\`\``,
          { mentions: [msg.sender] },
        );
      }
    },
  },
] satisfies CommandProperty[];
