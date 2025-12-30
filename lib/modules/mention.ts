import type { CommandProperty } from "..";
import { getMentionMessage, setMentionMessage } from "../sql";
import config from "../../config";

async function fetchFact(): Promise<string> {
  try {
    const res = await fetch("https://uselessfacts.jsph.pl/random.json?language=en");
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
    return `${data.content} - ${data.author}` || "Stay positive!";
  } catch {
    return "Stay positive!";
  }
}

async function fetchJoke(): Promise<string> {
  try {
    const res = await fetch("https://official-joke-api.appspot.com/random_joke");
    const data = await res.json();
    return `${data.setup} ${data.punchline}` || "Why don't scientists trust atoms? Because they make up everything!";
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
    pattern: "mention",
    category: "groups",
    isGroup: true,
    async exec(msg, sock, args) {
      if (args) {
        setMentionMessage(msg.sessionId, msg.chat, args);
        return await msg.reply("```Mention message set for this group```");
      } else {
        const storedMessage = getMentionMessage(msg.sessionId, msg.chat);

        if (!storedMessage) {
          return await msg.reply("```No mention message set for this group```");
        }

        const processedMessage = await replacePlaceholders(
          storedMessage,
          msg.sender,
          sock.user.id,
          config.BOT_NAME,
        );

        await sock.sendMessage(msg.chat, {
          text: processedMessage,
          mentions: [msg.sender],
        });
      }
    },
  },
] satisfies CommandProperty[];
