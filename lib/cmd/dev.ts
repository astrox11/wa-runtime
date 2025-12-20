import type { CommandProperty } from "../";
import { inspect } from "util";

export default {
  event: true,
  category: "util",
  desc: "Evaluate JavaScript code",
  dontAddToCommandList: true,
  async exec(msg) {
    if (!msg.text?.startsWith("$")) return;

    const code = msg.text.slice(1).trim();

    if (!code) {
      await msg.reply("No code provided");
      return;
    }

    try {
      const asyncEval = async () => {
        return eval(`(async () => { ${code} })()`);
      };

      const result = await asyncEval();

      const output =
        typeof result === "string" ? result : inspect(result, { depth: 2 });

      await msg.reply(`\`\`\`js\n${output}\n\`\`\``);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await msg.reply(`\`\`\`Error:\n${errorMsg}\n\`\`\``);
    }
  },
} satisfies CommandProperty;
