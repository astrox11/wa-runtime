import { Plugins, type CommandProperty } from "..";

export default {
  pattern: "menu",
  alias: ["help"],
  dontAddToCommandList: true,
  async exec(msg, sock) {
    const p = new Plugins(msg, sock);
    const commands = p.findAll();

    if (commands.length === 0)
      return await msg.reply("```No commands available```");

    const categories: Record<string, Set<string>> = {};

    for (const cmd of commands) {
      if (cmd.dontAddToCommandList === true) continue;

      const cat = cmd.category;
      if (!categories[cat]) categories[cat] = new Set();

      const cmdText =
        cmd.alias && cmd.alias.length > 0
          ? `${cmd.pattern} (${cmd.alias.join(", ")})`
          : cmd.pattern;

      categories[cat].add(cmdText);
    }

    if (Object.keys(categories).length === 0)
      return await msg.reply("```No commands available```");

    let reply = `αѕтяσ мєиυ\n\n`;

    for (const category in categories) {
      reply += `${category.toUpperCase()}\n`;

      for (const pattern of categories[category]) reply += `. ${pattern}\n`;

      reply += `\n`;
    }

    await msg.reply(`\`\`\`${reply.trim()}\`\`\``);
  },
} satisfies CommandProperty;
