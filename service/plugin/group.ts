import { generateMessageID, isLidUser } from "baileys";
import { getAlternateId, Group, log, parseId, type CommandProperty } from "..";

export default [
  {
    pattern: "add",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;

      const phone = args || msg.quoted?.sender;
      if (!phone) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴜᴍʙᴇʀ");

      let number = parseId(msg.sessionId, phone);
      if (!number) return await msg.reply("ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ");

      if (isLidUser(number)) number = getAlternateId(msg.sessionId, number);

      const result = await new Group(msg.sessionId, msg.chat, sock).add(
        number!,
      );
      if (!result)
        return await msg.reply(
          "ғᴀɪʟᴇᴅ: ᴄᴀɴ'ᴛ ᴀᴅᴅ ᴜsᴇʀ. ᴍᴀʏʙᴇ ᴘʀɪᴠᴀᴄʏ sᴇᴛᴛɪɴɢs ʙʟᴏᴄᴋ ʏᴏᴜ.",
        );

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "kick",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;

      const phone = args || msg.quoted?.sender;
      if (!phone) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴜᴍʙᴇʀ");

      const number = parseId(msg.sessionId, phone);
      if (!number) return await msg.reply("ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ");

      const result = await new Group(msg.sessionId, msg.chat, sock).remove(
        number,
      );
      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ᴜsᴇʀ ɴᴏᴛ ɪɴ ɢʀᴏᴜᴘ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "kickall",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      await new Group(msg.sessionId, msg.chat, sock).kickall();
      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "promote",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;

      const phone = args || msg.quoted?.sender;
      if (!phone) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴜᴍʙᴇʀ");

      const number = parseId(msg.sessionId, phone);
      if (!number) return await msg.reply("ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ");

      const result = await new Group(msg.sessionId, msg.chat, sock).promote(
        number,
      );
      if (!result)
        return await msg.reply("ғᴀɪʟᴇᴅ: ᴜsᴇʀ ɴᴏᴛ ɪɴ ɢʀᴏᴜᴘ ᴏʀ ᴀʟʀᴇᴀᴅʏ ᴀᴅᴍɪɴ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "demote",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;

      const phone = args || msg.quoted?.sender;
      if (!phone) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴜᴍʙᴇʀ");

      const number = parseId(msg.sessionId, phone);
      if (!number) return await msg.reply("ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ");

      const result = await new Group(msg.sessionId, msg.chat, sock).demote(
        number,
      );
      if (!result)
        return await msg.reply("ғᴀɪʟᴇᴅ: ᴜsᴇʀ ɴᴏᴛ ɪɴ ɢʀᴏᴜᴘ ᴏʀ ɴᴏᴛ ᴀᴅᴍɪɴ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "gname",
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;
      if (!args) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴇᴡ ɴᴀᴍᴇ");

      await new Group(msg.sessionId, msg.chat, sock).name(args);
      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "gdesc",
    alias: ["gsubject"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock) return;
      if (!args) return await msg.reply("ᴘʀᴏᴠɪᴅᴇ ɴᴇᴡ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ");

      await new Group(msg.sessionId, msg.chat, sock).description(args);
      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "glink",
    alias: ["gurl", "invite"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const link = await new Group(msg.sessionId, msg.chat, sock).invite();
      await msg.reply(`ɢʀᴏᴜᴘ ʟɪɴᴋ: ${link}`);
    },
  },
  {
    pattern: "revoke",
    alias: ["resetlink"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const link = await new Group(msg.sessionId, msg.chat, sock).revoke();
      await msg.reply(`ɴᴇᴡ ɢʀᴏᴜᴘ ʟɪɴᴋ: ${link}`);
    },
  },
  {
    pattern: "leave",
    category: "groups",
    isGroup: true,
    async exec(msg, sock) {
      if (!sock) return;
      await new Group(msg.sessionId, msg.chat, sock).leave();
    },
  },
  {
    pattern: "ephemeral",
    alias: ["disappear"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock || !args) return;

      const duration = parseInt(args);
      const accepted = [0, 86400, 604800, 7776000];

      if (isNaN(duration) || !accepted.includes(duration))
        return await msg.reply(
          "ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴛɪᴍᴇ ɪɴ sᴇᴄᴏɴᴅs\n(0 ᴛᴏ ɪɴsᴛᴀɴᴛ ᴅɪsᴀʙʟᴇ).\n86400 (1 ᴅᴀʏ).\n604800 (7 ᴅᴀʏs)\n7776000 (90 ᴅᴀʏs)",
        );

      const result = await new Group(msg.sessionId, msg.chat, sock).ephemeral(
        duration,
      );
      if (!result)
        return await msg.reply("ғᴀɪʟᴇᴅ: ᴀʟʀᴇᴀᴅʏ sᴇᴛ ᴛᴏ ᴛʜɪs ᴅᴜʀᴀᴛɪᴏɴ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "addmode",
    alias: ["memberjoinmode"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock || !args) return;

      const mode = args.toLowerCase().trim();
      if (mode !== "admin" && mode !== "member")
        return await msg.reply(
          "```this command will set who can add new members to the group\n\nUsage:\n.addmode admin\n.addmode member```",
        );

      const result = await new Group(msg.sessionId, msg.chat, sock).join_mode(
        mode === "admin" ? "admin_add" : "all_member_add",
      );

      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ᴀʟʀᴇᴀᴅʏ sᴇᴛ ᴛᴏ ᴛʜɪs ᴍᴏᴅᴇ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "joinmode",
    alias: ["groupjoinmode"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock, args) {
      if (!sock || !args) return;

      const mode = args.toLowerCase().trim();
      if (mode !== "approval" && mode !== "open")
        return await msg.reply(
          "```this command will set the group join mode\n\nUsage:\n.joinmode approval\n.joinmode open```",
        );

      const result = await new Group(msg.sessionId, msg.chat, sock).joinmode(
        mode === "approval" ? "on" : "off",
      );

      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ᴀʟʀᴇᴀᴅʏ sᴇᴛ ᴛᴏ ᴛʜɪs ᴍᴏᴅᴇ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "mute",
    alias: ["groupmute", "announce"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const result = await new Group(msg.sessionId, msg.chat, sock).announce(
        "announcement",
      );
      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ɢʀᴏᴜᴘ ᴀʟʀᴇᴀᴅʏ ᴍᴜᴛᴇᴅ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "unmute",
    alias: ["groupunmute", "unannounce"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const result = await new Group(msg.sessionId, msg.chat, sock).announce(
        "not_announcement",
      );
      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ɢʀᴏᴜᴘ ᴀʟʀᴇᴀᴅʏ ᴜɴᴍᴜᴛᴇᴅ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "lock",
    alias: ["grouplock"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const result = await new Group(msg.sessionId, msg.chat, sock).restrict(
        "locked",
      );
      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ɢʀᴏᴜᴘ ᴀʟʀᴇᴀᴅʏ ʟᴏᴄᴋᴇᴅ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "unlock",
    alias: ["groupunlock"],
    category: "groups",
    isGroup: true,
    isAdmin: true,
    async exec(msg, sock) {
      if (!sock) return;

      const result = await new Group(msg.sessionId, msg.chat, sock).restrict(
        "unlocked",
      );
      if (!result) return await msg.reply("ғᴀɪʟᴇᴅ: ɢʀᴏᴜᴘ ᴀʟʀᴇᴀᴅʏ ᴜɴʟᴏᴄᴋᴇᴅ");

      await msg.reply("ᴅᴏɴᴇ");
    },
  },
  {
    pattern: "tag",
    alias: ["gmention"],
    category: "groups",
    isGroup: true,
    async exec(msg, sock, args) {
      if (!sock) return;

      return await sock.relayMessage(
        msg.chat,
        {
          extendedTextMessage: {
            text: `@${msg.chat} ${args || ""}`.trim(),
            contextInfo: {
              groupMentions: [{ groupJid: msg.chat }],
            },
          },
        },
        { messageId: generateMessageID() },
      );
    },
  },
] satisfies Array<CommandProperty>;
