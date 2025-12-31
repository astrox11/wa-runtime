import {
  formatp,
  toSmallCaps,
  formatRuntime,
  Plugins,
  type CommandProperty,
} from "..";
import os from "os";
import config from "../../config";

const Reply = new Map<string, string>();

export default [
  {
    pattern: "menu",
    dontAddToCommandList: true,
    async exec(msg, sock) {
      const p = new Plugins(msg, sock);
      const commands = p.findAll();

      if (commands.length === 0)
        return await msg.reply("```No commands available```");

      const categories: Record<string, Set<string>> = {};

      for (const cmd of commands) {
        if (cmd.dontAddToCommandList === true) continue;
        if (cmd.pattern === "help") continue;
        const cat = cmd.category;
        if (!categories[cat]) categories[cat] = new Set();
        categories[cat].add(cmd.pattern);
      }

      if (Object.keys(categories).length === 0)
        return await msg.reply("```No commands available```");

      let reply = `\`\`\`┃╭──────────────
┃│ Owner : ${sock.user.name}
┃│ User : ${msg.pushName}
┃│ Plugins : ${commands.length}
┃│ Runtime : ${formatRuntime(process.uptime())}
┃│ Mode : ${msg.mode}
┃│ Platform : ${os.platform()}
┃│ Ram : ${formatp(os.totalmem() - os.freemem())} / ${formatp(os.totalmem())}
┃│ Version: ${config.VERSION}
┃╰──────────────
╰━━━━━━━━━━━━━━━
\`\`\``;

      for (const category in categories) {
        reply += `╭─────────────\n`;
        reply += `│ 「 *${toSmallCaps(category)}* 」 \n`;
        reply += `╰┬────────────\n┌┤\n`;

        for (const plugin of categories[category]) {
          reply += `││◦ ${toSmallCaps(plugin)}\n`;
        }

        reply += `│╰────────────\n`;
        reply += `╰─────────────\n`;
      }

      const m = await msg.send_interactive({
        header: {
          title: `╭━━━〔 ${config.BOT_NAME} 〕━━━`,
        },
        body: {
          text: reply.trim(),
        },
        footer: {
          text: "αѕтяσχ 2026",
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "αѕтяσχ ѕυρρσят",
                url: "mailto:astrodevwork@gmail.com",
                merchant_url: "mailto:astrodevwork@gmail.com",
              }),
            },
          ],
        },
      });

      Reply.set(msg.chat, m.key.id);
    },
  },
  {
    pattern: "help",
    category: "util",
    dontAddToCommandList: true,
    async exec(msg, sock) {
      const p = new Plugins(msg, sock);
      const commands = p.findAll();

      if (commands.length === 0)
        return await msg.reply("```No commands available```");

      let reply = "";

      for (const cmd of commands) {
        if (cmd.dontAddToCommandList === true) continue;
        reply += `command : ${cmd.pattern}\n`;
        reply += `alias : ${cmd.alias && cmd.alias.length > 0 ? cmd.alias.join(", ") : "-"}\n\n`;
      }

      await msg.send_btn({
        text: reply.trim(),
        buttons: [
          {
            buttonId: "0",
            type: 1,
            buttonText: {
              displayText: "αѕтяσχ ѕυρρσят",
            },
          },
        ],
      });
    },
  },
  {
    event: true,
    async exec(msg) {
      if (msg?.type === "buttonsResponseMessage" && msg?.quoted) {
        if (msg.quoted.key.id && Reply.has(msg.chat)) {
          const m = msg?.quoted?.message;

          if (m?.buttonsMessage?.buttons[0]?.buttonId === "0") {
            await msg.reply("```Contact: astrodevwork@gmail.com```");
            Reply.clear();
          }
        }
      }
      return;
    },
  },
] satisfies CommandProperty[];
