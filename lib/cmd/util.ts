import { Plugins, type CommandProperty } from "../";

export default [
  {
    pattern: "ping",
    alias: ["speed"],
    category: "util",
    desc: "Check bot response time",
    async exec(msg) {
      const start = Date.now();
      const m = await msg.reply("```pong```");
      const end = Date.now();
      await m.edit(`${end - start}ms`);
    },
  },
  {
    pattern: "menu",
    alias: ["help"],
    category: "util",
    desc: "Display all available commands",
    async exec(msg, sock) {
      const p = new Plugins(msg, sock);
      const commands = p.findAll();

      if (commands.length === 0) {
        await msg.reply("```No commands available```");
        return;
      }

      const categories: Record<string, Set<string>> = {};

      for (const cmd of commands) {
        const cat = cmd.category;
        if (!categories[cat]) categories[cat] = new Set();

        const cmdText =
          cmd.alias && cmd.alias.length > 0
            ? `${cmd.pattern} (${cmd.alias.join(", ")})`
            : cmd.pattern;

        categories[cat].add(cmdText);
      }

      let reply = `αѕтяσ мєиυ\n\n`;

      for (const category in categories) {
        reply += `${category.toUpperCase()}\n`;

        for (const pattern of categories[category]) {
          reply += `. ${pattern}\n`;
        }

        reply += `\n`;
      }

      await msg.reply(`\`\`\`${reply.trim()}\`\`\``);
    },
  },
] satisfies Array<CommandProperty>;
