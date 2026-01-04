import type { CommandProperty } from "core/class";
import { containsUrl } from "core/util";

export default {
  pattern: "tiktok",
  category: "download",
  async exec(msg, sock, args) {
    if (!containsUrl(args ?? ""))
      return await msg.reply("Please provide a valid TikTok URL.");

    let url: string | null;

    url = args!.match(/https?:\/\/(www\.)?tiktok\.com\/[^\s]+/i)![0];
    const { tiktok } = await import("core/util/scrapers");
    url = await tiktok(url);
    if (url) {
      await sock?.sendMessage(msg.chat, { video: { url } });
    } else {
      await msg.reply("```Download failed.```");
    }
  },
} satisfies CommandProperty;
