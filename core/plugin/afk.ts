import { type CommandProperty } from "..";
import { getAfk, setAfk } from "../sql";
import { jidNormalizedUser } from "baileys";

const formatDuration = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
};

export default [
  {
    pattern: "afk",
    isSudo: true,
    category: "util",
    async exec(msg, _, args) {
      const timestamp = Date.now();

      if (!args) {
        const currentAfk = getAfk(msg.sessionId);

        if (currentAfk && currentAfk.status === 1) {
          setAfk(msg.sessionId, false);
          return await msg.reply("```AFK mode disabled```");
        } else {
          setAfk(
            msg.sessionId,
            true,
            "I'm currently AFK\n\n> This is an automated message, no need to reply again.",
            timestamp,
          );
          return await msg.reply("```AFK mode enabled```");
        }
      } else {
        const command = args.toLowerCase().split(" ")[0];

        if (command === "on") {
          const customMessage = args.substring(3).trim();
          setAfk(
            msg.sessionId,
            true,
            customMessage || "I'm currently AFK",
            timestamp,
          );
          return await msg.reply("```AFK mode enabled```");
        } else if (command === "off") {
          setAfk(msg.sessionId, false);
          return await msg.reply("```AFK mode disabled```");
        } else {
          setAfk(msg.sessionId, true, args, timestamp);
          return await msg.reply("```AFK mode enabled with custom message```");
        }
      }
    },
  },
  {
    event: true,
    dontAddToCommandList: true,
    async exec(msg, sock) {
      if (!sock) return;
      const afkStatus = getAfk(msg.sessionId);

      if (afkStatus && afkStatus.status === 1) {
        const pn = jidNormalizedUser(sock.user?.id);
        const lid = jidNormalizedUser(sock.user?.lid);
        const afkMessage =
          afkStatus.message ||
          "I'm currently AFK\n\n> This is an automated message, no need to reply again.";
        const timeAway = afkStatus.time
          ? formatDuration(Date.now() - afkStatus.time)
          : "";
        const finalMessage = `\`\`\`${afkMessage}\n\nAway for: ${timeAway}\`\`\``;

        if (msg.isGroup) {
          const quotedSender = msg?.quoted?.sender;
          if (
            (pn && msg.mentions.includes(pn)) ||
            (lid && msg.mentions.includes(lid)) ||
            (quotedSender &&
              [
                jidNormalizedUser(sock.user?.id),
                jidNormalizedUser(sock.user?.lid),
              ]
                .filter((x): x is string => typeof x === "string")
                .includes(quotedSender))
          ) {
            await msg.reply(finalMessage);
          }
        } else {
          if (msg.key.fromMe) return;
          await msg.reply(finalMessage);
        }
      }
    },
  },
] satisfies CommandProperty[];
