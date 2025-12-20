import { type CommandProperty } from "../.";

export default [
  {
    pattern: "gname",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!args) return await msg.reply("```provide a new group```");
      await sock.groupUpdateSubject(msg.chat, args);
      await msg.reply("```group name updated```");
    },
  },
] satisfies Array<CommandProperty>;
