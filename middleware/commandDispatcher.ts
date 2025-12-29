/**
 * Command Dispatcher Module
 *
 * Routes normalized messages to command handlers and manages
 * command registration, permissions, and execution.
 */

import type { WASocket } from "baileys";
import { log } from "../lib/util";
import { isAdmin } from "../lib/sql";
import type {
  NormalizedMessage,
  DispatchResult,
  MessageClassification,
} from "./types";

/** Command definition interface */
export interface CommandDefinition {
  pattern?: string;
  alias?: string[];
  category?: string;
  event?: boolean;
  dontAddToCommandList?: boolean;
  isGroup?: boolean;
  isAdmin?: boolean;
  isSudo?: boolean;
  exec: (msg: any, sock?: WASocket, args?: string) => Promise<any>;
}

/** Command registry interface */
export interface CommandRegistry {
  get(pattern: string): CommandDefinition | undefined;
  getAll(): CommandDefinition[];
  has(pattern: string): boolean;
}

interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Dispatches a normalized message to the appropriate command handler.
 */
export async function dispatchCommand(
  message: NormalizedMessage,
  client: WASocket,
  registry: CommandRegistry,
  mode: "private" | "public" = "public",
): Promise<DispatchResult> {
  if (message.classification !== "command" || !message.command) {
    return { handled: false };
  }

  const command = registry.get(message.command.name);
  if (!command) {
    return { handled: false };
  }

  const permission = checkPermissions(message, command, mode);
  if (!permission.allowed) {
    return {
      handled: true,
      handlerName: command.pattern,
      error: new Error(permission.reason),
    };
  }

  try {
    await command.exec(message.raw, client, message.command.args);
    return {
      handled: true,
      handlerName: command.pattern,
    };
  } catch (error) {
    log.error(`[dispatcher] Command ${command.pattern} failed:`, error);
    return {
      handled: true,
      handlerName: command.pattern,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Dispatches event-based commands for all registered event handlers.
 */
export async function dispatchEvents(
  message: NormalizedMessage,
  client: WASocket,
  eventHandlers: CommandDefinition[],
  mode: "private" | "public" = "public",
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];

  for (const handler of eventHandlers) {
    if (handler.isSudo && !message.isSudo) {
      continue;
    }
    if (mode === "private" && !message.isSudo) {
      continue;
    }

    try {
      await handler.exec(message.raw, client);
      results.push({
        handled: true,
        handlerName: handler.pattern ?? "event_handler",
      });
    } catch (error) {
      log.error(`[dispatcher] Event handler failed:`, error);
      results.push({
        handled: true,
        handlerName: handler.pattern ?? "event_handler",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return results;
}

/**
 * Checks if a message sender has permission to execute a command.
 */
export function checkPermissions(
  message: NormalizedMessage,
  command: CommandDefinition,
  mode: "private" | "public",
): PermissionResult {
  if (mode === "private" && !message.isSudo) {
    return { allowed: false, reason: "Bot is in private mode" };
  }
  if (command.isSudo && !message.isSudo) {
    return { allowed: false, reason: "This command requires sudo privileges" };
  }
  if (command.isGroup && !message.isGroup) {
    return { allowed: false, reason: "This command is for groups only" };
  }
  if (command.isGroup && command.isAdmin) {
    if (!isAdmin(message.sessionId, message.chatId, message.senderId)) {
      return {
        allowed: false,
        reason: "This command requires admin privileges",
      };
    }
  }
  return { allowed: true };
}

/**
 * Creates a simple in-memory command registry.
 */
export function createRegistry(commands: CommandDefinition[]): CommandRegistry {
  const commandMap = new Map<string, CommandDefinition>();

  for (const cmd of commands) {
    if (cmd.pattern) {
      const pattern = cmd.pattern.toLowerCase();
      commandMap.set(pattern, cmd);

      if (cmd.alias) {
        for (const alias of cmd.alias) {
          commandMap.set(alias.toLowerCase(), cmd);
        }
      }
    }
  }

  return {
    get(pattern: string): CommandDefinition | undefined {
      return commandMap.get(pattern.toLowerCase());
    },
    getAll(): CommandDefinition[] {
      return Array.from(new Set(commandMap.values()));
    },
    has(pattern: string): boolean {
      return commandMap.has(pattern.toLowerCase());
    },
  };
}

/**
 * Filters messages that should be processed as commands.
 */
export function shouldDispatch(
  message: NormalizedMessage,
  registry: CommandRegistry,
): boolean {
  if (message.classification !== "command") {
    return false;
  }
  if (!message.command) {
    return false;
  }
  return registry.has(message.command.name);
}

/**
 * Gets a list of commands by category.
 */
export function getCommandsByCategory(
  registry: CommandRegistry,
  category: string,
): CommandDefinition[] {
  return registry.getAll().filter((cmd) => cmd.category === category);
}

/**
 * Gets all available categories from registered commands.
 */
export function getCategories(registry: CommandRegistry): string[] {
  const categories = new Set<string>();
  for (const cmd of registry.getAll()) {
    if (cmd.category) {
      categories.add(cmd.category);
    }
  }
  return Array.from(categories);
}

/**
 * Determines if a message classification requires dispatch.
 */
export function requiresDispatch(
  classification: MessageClassification,
): boolean {
  return classification === "command" || classification === "button_response";
}
