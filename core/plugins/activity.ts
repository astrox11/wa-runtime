import {
  type CommandProperty,
  getActivitySettings,
  setActivitySettings,
  isAdmin,
  Group,
  log,
} from "..";
import { jidNormalizedUser } from "baileys";

// Spam tracking: Map<sessionId, Map<sender, { timestamps: number[], warned: boolean, lastActivity: number }>>
const spamTracker: Map<
  string,
  Map<string, { timestamps: number[]; warned: boolean; lastActivity: number }>
> = new Map();

// Spam detection settings
const SPAM_WINDOW_MS = 3000; // 3 seconds
const SPAM_MESSAGE_THRESHOLD = 2; // 2 or more messages per window triggers spam detection
const CLEANUP_INTERVAL_MS = 60000; // Cleanup every 60 seconds
const ENTRY_EXPIRY_MS = 300000; // Remove entries older than 5 minutes

// Cleanup function to prevent memory leaks
function cleanupSpamTracker(): void {
  const now = Date.now();
  for (const [sessionId, sessionMap] of spamTracker) {
    for (const [sender, entry] of sessionMap) {
      if (now - entry.lastActivity > ENTRY_EXPIRY_MS) {
        sessionMap.delete(sender);
      }
    }
    // Remove empty session maps
    if (sessionMap.size === 0) {
      spamTracker.delete(sessionId);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupSpamTracker, CLEANUP_INTERVAL_MS);

function getOrCreateSpamEntry(
  sessionId: string,
  sender: string,
): { timestamps: number[]; warned: boolean; lastActivity: number } {
  if (!spamTracker.has(sessionId)) {
    spamTracker.set(sessionId, new Map());
  }
  const sessionMap = spamTracker.get(sessionId)!;
  if (!sessionMap.has(sender)) {
    sessionMap.set(sender, { timestamps: [], warned: false, lastActivity: Date.now() });
  }
  const entry = sessionMap.get(sender)!;
  entry.lastActivity = Date.now();
  return entry;
}

function resetSpamEntry(sessionId: string, sender: string): void {
  const sessionMap = spamTracker.get(sessionId);
  if (sessionMap) {
    sessionMap.set(sender, { timestamps: [], warned: false, lastActivity: Date.now() });
  }
}

function cleanupAndCheckSpam(entry: { timestamps: number[]; warned: boolean; lastActivity: number }): boolean {
  const now = Date.now();
  // Filter to only keep timestamps within the window and update the entry
  const recentTimestamps = entry.timestamps.filter((t) => now - t < SPAM_WINDOW_MS);
  entry.timestamps = recentTimestamps;
  return recentTimestamps.length >= SPAM_MESSAGE_THRESHOLD;
}

export default [
  {
    pattern: "readmessages",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_read_messages;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_read_messages: newValue });
        return await msg.reply(
          `\`\`\`Auto Read Messages ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Auto Read Messages is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_read_messages: true });
        return await msg.reply("```Auto Read Messages enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply(
            "```Auto Read Messages is already disabled```",
          );
        }
        setActivitySettings(msg.sessionId, { auto_read_messages: false });
        return await msg.reply("```Auto Read Messages disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: readmessages [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "antidelete",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_recover_deleted_messages;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, {
          auto_recover_deleted_messages: newValue,
        });
        return await msg.reply(
          `\`\`\`Anti Delete ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Anti Delete is already enabled```");
        }
        setActivitySettings(msg.sessionId, {
          auto_recover_deleted_messages: true,
        });
        return await msg.reply("```Anti Delete enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Anti Delete is already disabled```");
        }
        setActivitySettings(msg.sessionId, {
          auto_recover_deleted_messages: false,
        });
        return await msg.reply("```Anti Delete disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: antidelete [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "antispam",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_antispam;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_antispam: newValue });
        return await msg.reply(
          `\`\`\`Anti Spam ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Anti Spam is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_antispam: true });
        return await msg.reply("```Anti Spam enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Anti Spam is already disabled```");
        }
        setActivitySettings(msg.sessionId, { auto_antispam: false });
        return await msg.reply("```Anti Spam disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: antispam [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "typing",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_typing;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_typing: newValue });
        return await msg.reply(
          `\`\`\`Auto Typing ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Auto Typing is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_typing: true });
        return await msg.reply("```Auto Typing enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Auto Typing is already disabled```");
        }
        setActivitySettings(msg.sessionId, { auto_typing: false });
        return await msg.reply("```Auto Typing disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: typing [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "recording",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_recording;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_recording: newValue });
        return await msg.reply(
          `\`\`\`Auto Recording ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Auto Recording is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_recording: true });
        return await msg.reply("```Auto Recording enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Auto Recording is already disabled```");
        }
        setActivitySettings(msg.sessionId, { auto_recording: false });
        return await msg.reply("```Auto Recording disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: recording [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "anticall",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_reject_calls;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_reject_calls: newValue });
        return await msg.reply(
          `\`\`\`Anti Call ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Anti Call is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_reject_calls: true });
        return await msg.reply("```Anti Call enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Anti Call is already disabled```");
        }
        setActivitySettings(msg.sessionId, { auto_reject_calls: false });
        return await msg.reply("```Anti Call disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: anticall [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "online",
    isSudo: true,
    category: "settings",
    async exec(msg, _, args) {
      const current = getActivitySettings(msg.sessionId);
      const currentValue = current.auto_always_online;

      if (!args) {
        const newValue = !currentValue;
        setActivitySettings(msg.sessionId, { auto_always_online: newValue });
        return await msg.reply(
          `\`\`\`Always Online ${newValue ? "enabled" : "disabled"}\`\`\``,
        );
      }

      const command = args.toLowerCase().trim();

      if (command === "on") {
        if (currentValue) {
          return await msg.reply("```Always Online is already enabled```");
        }
        setActivitySettings(msg.sessionId, { auto_always_online: true });
        return await msg.reply("```Always Online enabled```");
      } else if (command === "off") {
        if (!currentValue) {
          return await msg.reply("```Always Online is already disabled```");
        }
        setActivitySettings(msg.sessionId, { auto_always_online: false });
        return await msg.reply("```Always Online disabled```");
      } else {
        return await msg.reply(
          `\`\`\`Usage: online [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
        );
      }
    },
  },
  {
    event: true,
    async exec(msg, sock) {
      const activity = getActivitySettings(msg.sessionId);
      if (activity.auto_read_messages) {
        await sock.readMessages([msg.key]);
      }

      if (activity.auto_typing) {
        await sock.sendPresenceUpdate("composing", msg.chat);
      }

      if (activity.auto_recording) {
        await sock.sendPresenceUpdate("recording", msg.chat);
      }

      if (activity.auto_always_online) {
        await sock.sendPresenceUpdate("available");
      }

      if (activity.auto_antispam) {
        // Skip if message is from self
        if (msg.key.fromMe) return;

        const sender = msg.sender;

        // Skip if sender is sudo
        if (msg.sudo) return;

        // Get bot's JID
        const botId = jidNormalizedUser(sock.user?.id);
        const botLid = sock.user?.lid
          ? jidNormalizedUser(sock.user.lid)
          : undefined;

        if (msg.isGroup) {
          // Check if bot is admin in the group
          const isBotAdmin =
            isAdmin(msg.sessionId, msg.chat, botId) ||
            (botLid && isAdmin(msg.sessionId, msg.chat, botLid));

          if (!isBotAdmin) return; // Bot is not admin, skip

          // Check if sender is admin
          const isSenderAdmin = isAdmin(msg.sessionId, msg.chat, sender);
          if (isSenderAdmin) return; // Sender is admin, skip
        }

        // Track message timestamp
        const spamEntry = getOrCreateSpamEntry(msg.sessionId, sender);
        spamEntry.timestamps.push(Date.now());

        // Check if user is spamming
        if (cleanupAndCheckSpam(spamEntry)) {
          if (!spamEntry.warned) {
            // First time warning
            spamEntry.warned = true;

            if (msg.isGroup) {
              await msg.reply(
                "```⚠️ Warning: Stop spamming or you will be kicked from this group!```",
              );
            } else {
              await msg.reply(
                "```⚠️ Hey, stop the spam or you will be blocked!```",
              );
            }

            // Reset the timestamps after warning
            spamEntry.timestamps = [];
          } else {
            // User was already warned, take action
            if (msg.isGroup) {
              await msg.reply(
                "```🚫 You have been kicked from this group for spamming.```",
              );
              try {
                const group = new Group(msg.sessionId, msg.chat, sock);
                await group.Remove(sender);
              } catch (error) {
                log.error(
                  `[antispam] Failed to kick ${sender} from ${msg.chat}:`,
                  error,
                );
              }
            } else {
              await msg.reply(
                "```🚫 You have been blocked for spamming.```",
              );
              await msg.block(sender);
            }

            // Reset the spam entry after action
            resetSpamEntry(msg.sessionId, sender);
          }
        }
      }
    },
  },
] satisfies CommandProperty[];
