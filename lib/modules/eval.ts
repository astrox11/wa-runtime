import type { CommandProperty } from "..";
import { inspect } from "util";

export default {
  pattern: "eval",
  category: "util",
  isSudo: true,
  async exec(msg, sock, args) {
    if (!args) return await msg.reply("No code provided");

    try {
      const asyncEval = async () => {
        return eval(`(async () => { ${args} })()`);
      };

      const result = await asyncEval();

      const output =
        typeof result === "string" ? result : inspect(result, { depth: 2 });

      await msg.reply(`\`\`\`js\n${output}\n\`\`\``);
    } catch (error) {
      const e = error instanceof Error ? error.message : String(error);

      await msg.reply(`\`\`\`Error:\n${e}\n\`\`\``);
    }
  },
} satisfies CommandProperty;
