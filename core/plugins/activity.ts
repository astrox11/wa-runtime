import {
  type CommandProperty,
  getActivitySettings,
  setActivitySettings,
  type ActivitySettings,
} from "..";

// Helper function to create a toggle command for each activity setting
const createActivityCommand = (
  pattern: string,
  settingKey: keyof ActivitySettings,
  displayName: string,
): CommandProperty => ({
  pattern,
  isSudo: true,
  category: "settings",
  async exec(msg, _, args) {
    const current = getActivitySettings(msg.sessionId);
    const currentValue = current[settingKey];

    if (!args) {
      // Toggle the setting
      const newValue = !currentValue;
      setActivitySettings(msg.sessionId, { [settingKey]: newValue });
      return await msg.reply(
        `\`\`\`${displayName} ${newValue ? "enabled" : "disabled"}\`\`\``,
      );
    }

    const command = args.toLowerCase().trim();

    if (command === "on") {
      if (currentValue) {
        return await msg.reply(`\`\`\`${displayName} is already enabled\`\`\``);
      }
      setActivitySettings(msg.sessionId, { [settingKey]: true });
      return await msg.reply(`\`\`\`${displayName} enabled\`\`\``);
    } else if (command === "off") {
      if (!currentValue) {
        return await msg.reply(
          `\`\`\`${displayName} is already disabled\`\`\``,
        );
      }
      setActivitySettings(msg.sessionId, { [settingKey]: false });
      return await msg.reply(`\`\`\`${displayName} disabled\`\`\``);
    } else {
      return await msg.reply(
        `\`\`\`Usage: ${pattern} [on|off]\nCurrent: ${currentValue ? "enabled" : "disabled"}\`\`\``,
      );
    }
  },
});

export default [
  createActivityCommand("readmessages", "auto_read_messages", "Auto Read Messages"),
  createActivityCommand("antidelete", "auto_recover_deleted_messages", "Anti Delete"),
  createActivityCommand("antispam", "auto_antispam", "Anti Spam"),
  createActivityCommand("typing", "auto_typing", "Auto Typing"),
  createActivityCommand("recording", "auto_recording", "Auto Recording"),
  createActivityCommand("anticall", "auto_reject_calls", "Anti Call"),
  createActivityCommand("online", "auto_always_online", "Always Online"),
] satisfies CommandProperty[];
