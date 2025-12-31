import { replacePlaceholders, type CommandProperty } from "..";
import { getAliveMessage, setAliveMessage } from "../sql";
import config from "../../config";

export default {
  pattern: "alive",
  category: "util",
  async exec(msg, sock, args) {
    if (args) {
      setAliveMessage(msg.sessionId, args);
      return await msg.reply("```Alive message updated```");
    } else {
      const storedMessage = getAliveMessage(msg.sessionId);
      const message =
        storedMessage || `Hey! I'm alive and running ${config.BOT_NAME}`;

      const processedMessage = await replacePlaceholders(
        message,
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
} satisfies CommandProperty;
