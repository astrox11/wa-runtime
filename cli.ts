import { sessionManager } from "./lib";
import { log } from "./lib";

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

/** Session subcommand constants */
export const SESSION_COMMANDS = {
  CREATE: "create",
  DELETE: "delete",
  LIST: "list",
} as const;

/**
 * Parse and execute session commands
 * Usage:
 *   session create <phone_number>
 *   session delete <session_id | phone_number>
 *   session list
 */
export async function handleSessionCommand(
  args: string[],
): Promise<CommandResult> {
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case SESSION_COMMANDS.CREATE: {
      const phoneNumber = args[1];
      if (!phoneNumber) {
        return {
          success: false,
          message:
            "Usage: session create <phone_number>\nPhone number should include country code without + symbol",
        };
      }

      log.info(`Creating session for phone number: ${phoneNumber}`);
      const result = await sessionManager.create(phoneNumber);

      if (result.success) {
        const formattedCode = result.code
          ? `${result.code.slice(0, 4)}-${result.code.slice(4)}`
          : "N/A";
        return {
          success: true,
          message: `Session created successfully!\nSession ID: ${result.id}\nPairing Code: ${formattedCode}\n\nEnter this code in WhatsApp > Linked Devices > Link a Device`,
          data: { id: result.id, code: result.code },
        };
      } else {
        return {
          success: false,
          message: `Failed to create session: ${result.error}`,
        };
      }
    }

    case SESSION_COMMANDS.DELETE: {
      const idOrPhone = args[1];
      if (!idOrPhone) {
        return {
          success: false,
          message: "Usage: session delete <session_id | phone_number>",
        };
      }

      log.info(`Deleting session: ${idOrPhone}`);
      const result = await sessionManager.delete(idOrPhone);

      if (result.success) {
        return {
          success: true,
          message: `Session deleted successfully`,
        };
      } else {
        return {
          success: false,
          message: `Failed to delete session: ${result.error}`,
        };
      }
    }

    case SESSION_COMMANDS.LIST: {
      const sessions = sessionManager.list();

      if (sessions.length === 0) {
        return {
          success: true,
          message: "No sessions found",
          data: [],
        };
      }

      const lines = sessions.map((s, i) => {
        const date = new Date(s.created_at).toLocaleString();
        return `${i + 1}. ID: ${s.id}\n   Phone: ${s.phone_number}\n   Status: ${s.status}\n   Created: ${date}`;
      });

      return {
        success: true,
        message: `Sessions (${sessions.length}):\n\n${lines.join("\n\n")}`,
        data: sessions,
      };
    }

    default:
      return {
        success: false,
        message: `Unknown subcommand: ${subcommand || "(none)"}\n\nAvailable commands:\n  session create <phone_number>\n  session delete <session_id | phone_number>\n  session list`,
      };
  }
}

/**
 * Parse CLI arguments and check if this is a session command
 */
export function isSessionCommand(args: string[]): boolean {
  return args[0]?.toLowerCase() === "session";
}

/**
 * Get session subcommand arguments (without 'session' prefix)
 */
export function getSessionArgs(args: string[]): string[] {
  return args.slice(1);
}
