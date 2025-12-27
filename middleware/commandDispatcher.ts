/**
 * Command Dispatcher Module
 *
 * This module is responsible for:
 * - Routing normalized messages to appropriate command handlers
 * - Managing command registration and lookup
 * - Handling command execution lifecycle
 * - Providing command classification and filtering
 *
 * Data Flow:
 * 1. Receive NormalizedMessage from message handler
 * 2. Look up registered command by name/pattern
 * 3. Validate command permissions and context
 * 4. Dispatch to the appropriate handler
 * 5. Return dispatch result to caller
 *
 * Design Principles:
 * - Stateless dispatch logic: Command registry is managed externally
 * - Permission checking delegated to command definitions
 * - Error isolation: Individual command failures don't affect others
 * - Extensible: New command types can be added without modifying core logic
 */

import type { WASocket } from "baileys";
import { log } from "../lib/util";
import { isAdmin } from "../lib/sql";
import type {
  NormalizedMessage,
  DispatchResult,
  MessageClassification,
} from "./types";

/**
 * Command definition interface matching the existing Plugins system.
 * This allows seamless integration with existing command modules.
 */
export interface CommandDefinition {
  /** Command pattern/name to match */
  pattern?: string;
  /** Alternative names for the command */
  alias?: string[];
  /** Command category for organization */
  category?: string;
  /** Whether this is an event-based command */
  event?: boolean;
  /** Hide from command listings */
  dontAddToCommandList?: boolean;
  /** Only available in groups */
  isGroup?: boolean;
  /** Requires admin privileges in group */
  isAdmin?: boolean;
  /** Requires sudo privileges */
  isSudo?: boolean;
  /** Command execution function */
  exec: (msg: any, sock?: WASocket, args?: string) => Promise<any>;
}

/**
 * Command registry for managing available commands.
 * Provides lookup and registration capabilities.
 */
export interface CommandRegistry {
  /** Get a command by its pattern or alias */
  get(pattern: string): CommandDefinition | undefined;
  /** Get all registered commands */
  getAll(): CommandDefinition[];
  /** Check if a command exists */
  has(pattern: string): boolean;
}

/**
 * Permission check result with reason.
 */
interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Dispatches a normalized message to the appropriate command handler.
 *
 * @param message - The normalized message to dispatch
 * @param client - The WhatsApp socket client
 * @param registry - Command registry for looking up handlers
 * @param mode - Current bot mode (private/public)
 * @returns Result of the dispatch operation
 */
export async function dispatchCommand(
  message: NormalizedMessage,
  client: WASocket,
  registry: CommandRegistry,
  mode: "private" | "public" = "public",
): Promise<DispatchResult> {
  // Only dispatch command-classified messages
  if (message.classification !== "command" || !message.command) {
    return { handled: false };
  }

  // Look up the command
  const command = registry.get(message.command.name);
  if (!command) {
    return { handled: false };
  }

  // Check permissions
  const permission = checkPermissions(message, command, mode);
  if (!permission.allowed) {
    // Return permission denial but mark as handled to prevent further processing
    return {
      handled: true,
      handlerName: command.pattern,
      error: new Error(permission.reason),
    };
  }

  // Execute the command
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
 *
 * @param message - The normalized message to process
 * @param client - The WhatsApp socket client
 * @param eventHandlers - Array of event-based command definitions
 * @param mode - Current bot mode
 * @returns Array of dispatch results for each handler
 */
export async function dispatchEvents(
  message: NormalizedMessage,
  client: WASocket,
  eventHandlers: CommandDefinition[],
  mode: "private" | "public" = "public",
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];

  for (const handler of eventHandlers) {
    // Skip if sudo required and user isn't sudo
    if (handler.isSudo && !message.isSudo) {
      continue;
    }

    // Skip in private mode for non-sudo users
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
 *
 * @param message - The normalized message
 * @param command - The command definition
 * @param mode - Current bot mode
 * @returns Permission result with allowed status and reason
 */
export function checkPermissions(
  message: NormalizedMessage,
  command: CommandDefinition,
  mode: "private" | "public",
): PermissionResult {
  // Private mode: only sudo users can execute
  if (mode === "private" && !message.isSudo) {
    return { allowed: false, reason: "Bot is in private mode" };
  }

  // Sudo-only commands
  if (command.isSudo && !message.isSudo) {
    return { allowed: false, reason: "This command requires sudo privileges" };
  }

  // Group-only commands
  if (command.isGroup && !message.isGroup) {
    return { allowed: false, reason: "This command is for groups only" };
  }

  // Admin-required commands (in groups)
  if (command.isGroup && command.isAdmin) {
    if (!isAdmin(message.chatId, message.senderId)) {
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
 * This is a utility for cases where a lightweight registry is needed.
 *
 * @param commands - Array of command definitions to register
 * @returns A command registry instance
 */
export function createRegistry(commands: CommandDefinition[]): CommandRegistry {
  const commandMap = new Map<string, CommandDefinition>();

  for (const cmd of commands) {
    if (cmd.pattern) {
      const pattern = cmd.pattern.toLowerCase();
      commandMap.set(pattern, cmd);

      // Register aliases
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
      // Return unique commands (not aliases)
      return Array.from(new Set(commandMap.values()));
    },
    has(pattern: string): boolean {
      return commandMap.has(pattern.toLowerCase());
    },
  };
}

/**
 * Filters messages that should be processed as commands.
 *
 * @param message - The normalized message
 * @param registry - Command registry for validation
 * @returns Whether the message should be processed as a command
 */
export function shouldDispatch(
  message: NormalizedMessage,
  registry: CommandRegistry,
): boolean {
  // Must be classified as a command
  if (message.classification !== "command") {
    return false;
  }

  // Must have command info
  if (!message.command) {
    return false;
  }

  // Must have a registered handler
  return registry.has(message.command.name);
}

/**
 * Gets a list of commands by category.
 *
 * @param registry - Command registry
 * @param category - Category to filter by
 * @returns Array of commands in the specified category
 */
export function getCommandsByCategory(
  registry: CommandRegistry,
  category: string,
): CommandDefinition[] {
  return registry.getAll().filter((cmd) => cmd.category === category);
}

/**
 * Gets all available categories from registered commands.
 *
 * @param registry - Command registry
 * @returns Array of unique category names
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
 *
 * @param classification - The message classification
 * @returns Whether this classification type needs command dispatch
 */
export function requiresDispatch(
  classification: MessageClassification,
): boolean {
  return classification === "command" || classification === "button_response";
}
