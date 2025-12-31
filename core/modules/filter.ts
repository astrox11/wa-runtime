import type { CommandProperty } from "..";
import {
  setFilter,
  getAllFilters,
  getFilterByTrigger,
  deleteFilter,
} from "../sql";
import config from "../../config";

const STATUS_FILTER = "_status";

async function fetchFact(): Promise<string> {
  try {
    const res = await fetch(
      "https://uselessfacts.jsph.pl/random.json?language=en",
    );
    const data = await res.json();
    return data.text || "Did you know facts are fun?";
  } catch {
    return "Did you know facts are fun?";
  }
}

async function fetchQuote(): Promise<string> {
  try {
    const res = await fetch("https://api.quotable.io/random");
    const data = await res.json();
    if (data.content && data.author) {
      return `${data.content} - ${data.author}`;
    }
    return "Stay positive!";
  } catch {
    return "Stay positive!";
  }
}

async function fetchJoke(): Promise<string> {
  try {
    const res = await fetch(
      "https://official-joke-api.appspot.com/random_joke",
    );
    const data = await res.json();
    if (data.setup && data.punchline) {
      return `${data.setup} ${data.punchline}`;
    }
    return "Why don't scientists trust atoms? Because they make up everything!";
  } catch {
    return "Why don't scientists trust atoms? Because they make up everything!";
  }
}

async function replacePlaceholders(
  message: string,
  sender: string,
  ownerId: string,
  botName: string,
): Promise<string> {
  let result = message
    .replace(/@user/g, sender.split("@")[0])
    .replace(/@owner/g, ownerId.split("@")[0])
    .replace(/@botname/g, botName);

  if (result.includes("@facts")) {
    const fact = await fetchFact();
    result = result.replace(/@facts/g, fact);
  }

  if (result.includes("@quotes")) {
    const quote = await fetchQuote();
    result = result.replace(/@quotes/g, quote);
  }

  if (result.includes("@jokes")) {
    const joke = await fetchJoke();
    result = result.replace(/@jokes/g, joke);
  }

  return result;
}

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

      const trigger = parts[0].trim();
      const reply = parts[1].trim();

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
      if (!msg.text) return;

      const statusFilter = getFilterByTrigger(msg.sessionId, STATUS_FILTER);
      if (!statusFilter || statusFilter.status === 0) return;

      const filter = getFilterByTrigger(msg.sessionId, msg.text.trim());
      if (!filter || filter.status === 0) return;

      const processedMessage = await replacePlaceholders(
        filter.reply,
        msg.sender,
        sock.user.id,
        config.BOT_NAME,
      );

      await sock.sendMessage(msg.chat, {
        text: processedMessage,
        mentions: [msg.sender],
      });
    },
  },
] satisfies CommandProperty[];
