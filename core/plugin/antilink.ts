import {
  setAntilink,
  getAntilinkMode,
  containsUrl,
  type CommandProperty,
  isAdmin,
  Group,
} from "..";

export default [
  {
    pattern: "antilink",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!args) {
        return await msg.reply("```Usage: antilink on|off```");
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        setAntilink(msg.sessionId, msg.chat, 1);
        return await msg.reply("```Antilink enabled (delete only)```");
      } else if (command === "off") {
        setAntilink(msg.sessionId, msg.chat, 0);
        return await msg.reply("```Antilink disabled```");
      } else {
        return await msg.reply("```Usage: antilink on|off```");
      }
    },
  },
  {
    pattern: "antilink2",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!args) {
        return await msg.reply("```Usage: antilink2 on|off```");
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        setAntilink(msg.sessionId, msg.chat, 2);
        return await msg.reply("```Antilink 2 enabled (delete + kick)```");
      } else if (command === "off") {
        setAntilink(msg.sessionId, msg.chat, 0);
        return await msg.reply("```Antilink 2 disabled```");
      } else {
        return await msg.reply("```Usage: antilink2 on|off```");
      }
    },
  },
  {
    event: true,
    dontAddToCommandList: true,
    async exec(msg, sock) {
      if (!msg.text || !sock || !msg.isGroup) return;

      // Check if message contains URL
      if (!containsUrl(msg.text)) return;

      // Get antilink mode for this group
      const mode = getAntilinkMode(msg.sessionId, msg.chat);
      if (mode === 0) return;

      // Ensure sender is valid
      if (!msg.sender) return;

      // Check if sender is admin or bot owner (exempt)
      if (msg.sudo || msg.key.fromMe) return;

      const admin = isAdmin(msg.sessionId, msg.chat, msg.sender);
      if (admin) return;

      // Action based on mode
      if (mode === 1) {
        // Mode 1: Delete only
        try {
          await sock.sendMessage(msg.chat, {
            delete: msg.key,
          });
        } catch {
          // Failed to delete (bot might not be admin)
        }
      } else if (mode === 2) {
        // Mode 2: Delete + Kick
        try {
          // Delete message
          await sock.sendMessage(msg.chat, {
            delete: msg.key,
          });

          // Kick user
          await new Group(msg.sessionId, msg.chat, sock).Remove(msg.sender);
        } catch {
          // Failed to delete or kick
        }
      }
    },
  },
] satisfies CommandProperty[];
