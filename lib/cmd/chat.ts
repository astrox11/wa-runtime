import { generateMessageID } from "baileys";
import type { CommandProperty } from "../src";

export default [
  {
    pattern: "vv",
    alias: ["viewonce"],
    category: "p2p",
    async exec(msg, sock) {
      if (!msg?.quoted?.viewonce) {
        return await msg.reply("```reply view_once```");
      }

      msg.quoted.message[msg.quoted.type].viewOnce = false;
      await sock.relayMessage(msg.chat, msg.quoted.message, {
        messageId: generateMessageID(),
      });
    },
  },
] satisfies Array<CommandProperty>;
