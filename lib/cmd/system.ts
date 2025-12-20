import { delay } from "baileys";
import { exit, startSock } from "../..";
import { formatRuntime, type CommandProperty } from "../";

export default [
  {
    pattern: "restart",
    alias: ["reboot"],
    category: "system",
    desc: "Restart the bot",
    async exec(msg) {
      await msg.reply("_Restarting_");
      await delay(300);
      startSock();
    },
  },
  {
    pattern: "shutdown",
    alias: ["off"],
    category: "system",
    desc: "Shutdown the bot",
    async exec(msg) {
      await msg.reply("_Shutting down_");
      await delay(300);
      exit();
    },
  },
  {
    pattern: "runtime",
    alias: ["uptime"],
    category: "system",
    desc: "Check process uptime",
    async exec(msg) {
      const time = formatRuntime(process.uptime());
      return await msg.reply("```" + time + "```");
    },
  },
] satisfies Array<CommandProperty>;
