import { setAntidelete, type CommandProperty } from "../.";

export default [
  {
    pattern: "vv",
    alias: ["viewonce"],
    category: "p2p",
    async exec(msg) {
      if (!msg?.quoted?.viewonce) {
        return await msg.reply("```reply view_once```");
      }

      msg.quoted.message[msg.quoted.type].viewOnce = false;
      await msg.forward(msg.chat, msg.quoted);
    },
  },
  {
    pattern: "antidelete",
    alias: ["nodelete"],
    category: "p2p",
    async exec(msg, sock, args) {
      const argsArray = args ? args.trim().split(/\s+/) : [];

      if (argsArray.length === 0) {
        return await msg.reply(
          "```Usage: antidelete <on|off> [mode]```\nModes: all, groups, p2p",
        );
      }

      const action = argsArray[0].toLowerCase();

      let mode: "all" | "groups" | "p2p" = "all";

      if (argsArray[1]) {
        const modeArg = argsArray[1].toLowerCase();

        if (["all", "groups", "p2p"].includes(modeArg)) {
          mode = modeArg as "all" | "groups" | "p2p";
        } else {
          return await msg.reply("```Invalid mode. Use: all, groups, p2p```");
        }
      }

      if (action === "on") {
        setAntidelete(true, mode);
        return await msg.reply(
          `\`\`\`Antidelete activated in ${mode} mode.\`\`\``,
        );
      } else if (action === "off") {
        setAntidelete(false, mode);
        return await msg.reply("```Antidelete deactivated.```");
      } else {
        return await msg.reply(
          "```Usage: antidelete <on|off> [mode]```\nModes: all, groups, p2p",
        );
      }
    },
  },
] satisfies Array<CommandProperty>;
