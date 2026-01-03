import {
  type CommandProperty,
  getActivitySettings,
  setActivitySettings,
} from "..";

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
] satisfies CommandProperty[];
