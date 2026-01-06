import {
  replacePlaceholders,
  setFilter,
  getAllFilters,
  getFilterByTrigger,
  deleteFilter,
  type CommandProperty,
} from "..";
import config from "../../config";

const STATUS_FILTER = "_status";

export default [
  {
    pattern: "filter",
    category: "util",
    async exec(msg, sock, args) {
      if (!args) {
        return await msg.reply("```Usage: filter on|off```");
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        setFilter(msg.sessionId, STATUS_FILTER, "", 1);
        return await msg.reply("```Filter enabled```");
      } else if (command === "off") {
        setFilter(msg.sessionId, STATUS_FILTER, "", 0);
        return await msg.reply("```Filter disabled```");
      } else {
        return await msg.reply("```Usage: filter on|off```");
      }
    },
  },
  {
    pattern: "setfilter",
    category: "util",
    async exec(msg, _, args) {
      if (!args) {
        return await msg.reply("```Usage: setfilter <trigger> | <reply>```");
      }

      const parts = args.split("|");
      if (parts.length !== 2) {
        return await msg.reply("```Usage: setfilter <trigger> | <reply>```");
      }

      const trigger = parts[0]?.trim();
      const reply = parts[1]?.trim();

      if (!trigger || !reply) {
        return await msg.reply("```Usage: setfilter <trigger> | <reply>```");
      }

      setFilter(msg.sessionId, trigger, reply, 1);
      await msg.reply(`\`\`\`Filter set: ${trigger}\`\`\``);
    },
  },
  {
    pattern: "getfilter",
    category: "util",
    async exec(msg) {
      const filters = getAllFilters(msg.sessionId).filter(
        (f) => f.trigger !== STATUS_FILTER,
      );

      if (filters.length === 0) {
        return await msg.reply("```No filters found```");
      }

      let reply = "```Filters:\n";
      for (const filter of filters) {
        reply += `Trigger: ${filter.trigger}\n`;
        reply += `Reply: ${filter.reply}\n`;
        reply += `Status: ${filter.status ? "Active" : "Inactive"}\n\n`;
      }
      reply += "```";

      await msg.reply(reply);
    },
  },
  {
    pattern: "delfilter",
    category: "util",
    async exec(msg, _, args) {
      if (!args) {
        return await msg.reply("```Usage: delfilter <trigger>```");
      }

      const trigger = args.trim();
      deleteFilter(msg.sessionId, trigger);
      await msg.reply(`\`\`\`Filter deleted: ${trigger}\`\`\``);
    },
  },
  {
    event: true,
    dontAddToCommandList: true,
    async exec(msg, sock) {
      if (!msg.text || !sock) return;

      const statusFilter = getFilterByTrigger(msg.sessionId, STATUS_FILTER);
      if (!statusFilter || statusFilter.status === 0) return;

      const filter = getFilterByTrigger(msg.sessionId, msg.text.trim());
      if (!filter || filter.status === 0) return;

      const processedMessage = await replacePlaceholders(
        filter.reply,
        msg.sender,
        sock.user?.id ?? "",
        config.BOT_NAME,
      );

      await sock.sendMessage(msg.chat, {
        text: processedMessage,
        mentions: [msg.sender],
      });
    },
  },
] satisfies CommandProperty[];
