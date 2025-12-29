import { sessionManager, type CommandProperty } from "..";

export default [
  {
    pattern: "session",
    alias: ["sessions"],
    isSudo: true,
    category: "system",
    async exec(msg, _, args) {
      const subcommand = args?.split(" ")[0]?.toLowerCase();
      const param = args?.split(" ").slice(1).join(" ").trim();

      if (!subcommand) {
        const sessions = sessionManager.list();
        if (sessions.length === 0) {
          return await msg.reply(
            "```No sessions found.\n\nUsage:\nsession create <phone_number>\nsession delete <session_id | phone_number>\nsession list```",
          );
        }

        let text = "*Sessions*\n\n";
        sessions.forEach((s, i) => {
          const date = new Date(s.created_at).toLocaleString();
          text += `${i + 1}. *ID:* ${s.id}\n   *Phone:* ${s.phone_number}\n   *Status:* ${s.status}\n   *Created:* ${date}\n\n`;
        });
        return await msg.reply(text.trim());
      }

      switch (subcommand) {
        case "create":
        case "add":
        case "new": {
          if (!param) {
            return await msg.reply(
              "```Usage: session create <phone_number>\nPhone number should include country code without + symbol\nExample: session create 14155551234```",
            );
          }

          await msg.reply("```Creating session, please wait...```");

          const result = await sessionManager.create(param);

          if (result.success) {
            const formattedCode = result.code
              ? `${result.code.slice(0, 4)}-${result.code.slice(4)}`
              : "N/A";
            return await msg.reply(
              `\`\`\`✓ Session created successfully!\n\nSession ID: ${result.id}\nPairing Code: ${formattedCode}\n\nEnter this code in WhatsApp > Linked Devices > Link a Device\`\`\``,
            );
          } else {
            return await msg.reply(
              `\`\`\`✗ Failed to create session: ${result.error}\`\`\``,
            );
          }
        }

        case "delete":
        case "remove":
        case "del": {
          if (!param) {
            return await msg.reply(
              "```Usage: session delete <session_id | phone_number>```",
            );
          }

          const result = await sessionManager.delete(param);

          if (result.success) {
            return await msg.reply("```✓ Session deleted successfully```");
          } else {
            return await msg.reply(
              `\`\`\`✗ Failed to delete session: ${result.error}\`\`\``,
            );
          }
        }

        case "list":
        case "all": {
          const sessions = sessionManager.list();

          if (sessions.length === 0) {
            return await msg.reply("```No sessions found```");
          }

          let text = "*Sessions List*\n\n";
          sessions.forEach((s, i) => {
            const date = new Date(s.created_at).toLocaleString();
            text += `${i + 1}. *ID:* ${s.id}\n   *Phone:* ${s.phone_number}\n   *Status:* ${s.status}\n   *Created:* ${date}\n\n`;
          });

          return await msg.reply(text.trim());
        }

        case "get":
        case "info": {
          if (!param) {
            return await msg.reply(
              "```Usage: session get <session_id | phone_number>```",
            );
          }

          const session = sessionManager.get(param);

          if (!session) {
            return await msg.reply("```Session not found```");
          }

          const date = new Date(session.created_at).toLocaleString();
          return await msg.reply(
            `*Session Info*\n\n*ID:* ${session.id}\n*Phone:* ${session.phone_number}\n*Status:* ${session.status}\n*Created:* ${date}`,
          );
        }

        default:
          return await msg.reply(
            "```Unknown subcommand.\n\nAvailable commands:\nsession create <phone_number>\nsession delete <session_id | phone_number>\nsession list\nsession get <session_id | phone_number>```",
          );
      }
    },
  },
  {
    pattern: "createsession",
    alias: ["newsession", "addsession"],
    isSudo: true,
    category: "system",
    async exec(msg, _, args) {
      const phoneNumber = args?.trim();
      if (!phoneNumber) {
        return await msg.reply(
          "```Usage: createsession <phone_number>\nPhone number should include country code without + symbol\nExample: createsession 14155551234```",
        );
      }

      await msg.reply("```Creating session, please wait...```");

      const result = await sessionManager.create(phoneNumber);

      if (result.success) {
        const formattedCode = result.code
          ? `${result.code.slice(0, 4)}-${result.code.slice(4)}`
          : "N/A";
        return await msg.reply(
          `\`\`\`✓ Session created successfully!\n\nSession ID: ${result.id}\nPairing Code: ${formattedCode}\n\nEnter this code in WhatsApp > Linked Devices > Link a Device\`\`\``,
        );
      } else {
        return await msg.reply(
          `\`\`\`✗ Failed to create session: ${result.error}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "deletesession",
    alias: ["delsession", "removesession"],
    isSudo: true,
    category: "system",
    async exec(msg, _, args) {
      if (!args) {
        return await msg.reply(
          "```Usage: deletesession <session_id | phone_number>```",
        );
      }

      const trimmedArgs = args.trim();
      if (!trimmedArgs) {
        return await msg.reply(
          "```Usage: deletesession <session_id | phone_number>```",
        );
      }

      const result = await sessionManager.delete(trimmedArgs);
      if (result.success) {
        return await msg.reply("```✓ Session deleted successfully```");
      } else {
        return await msg.reply(
          `\`\`\`✗ Failed to delete session: ${result.error}\`\`\``,
        );
      }
    },
  },
  {
    pattern: "listsessions",
    alias: ["allsessions", "getsessions"],
    isSudo: true,
    category: "system",
    async exec(msg) {
      const sessions = sessionManager.list();

      if (sessions.length === 0) {
        return await msg.reply("```No sessions found```");
      }

      let text = "*Sessions List*\n\n";
      sessions.forEach((s, i) => {
        const date = new Date(s.created_at).toLocaleString();
        text += `${i + 1}. *ID:* ${s.id}\n   *Phone:* ${s.phone_number}\n   *Status:* ${s.status}\n   *Created:* ${date}\n\n`;
      });

      return await msg.reply(text.trim());
    },
  },
] satisfies CommandProperty[];
