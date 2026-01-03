import { readdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { type MessageUpsertType, type WASocket } from "baileys";
import type { Message } from "./Message";
import { isAdmin, log } from "../";

const processedMessages = new Set<string>();

export class Plugins {
  message: Message;
  client: WASocket;
  private static commands: Map<string, CommandProperty> = new Map();
  private static eventCommands: CommandProperty[] = [];
  private static isLoaded = false;

  constructor(message: Message, client: WASocket) {
    this.message = message;
    this.client = client;
  }

  async text() {
    if (!this.message?.text) return;

    let text = this.message.text.trim();
    const prefix = this.message.prefix;

    // If prefix is set, check if message starts with a prefix symbol
    if (prefix && prefix.length > 0) {
      const firstChar = text.charAt(0);
      if (!prefix.includes(firstChar)) {
        // Message doesn't start with a prefix symbol, ignore it
        return;
      }
      // Strip all leading prefix symbols from the text
      let prefixCount = 0;
      while (prefixCount < text.length && prefix.includes(text.charAt(prefixCount))) {
        prefixCount++;
      }
      text = text.slice(prefixCount).trim();
    }

    if (!text) return;

    const firstWord = text.split(" ")[0].toLowerCase();
    const cmd = this.find(firstWord);

    if (!cmd) return;

    const args = text.slice(firstWord.length).trim();

    if (this.message.mode == "private" && !this.message.sudo) return;
    if (cmd?.isSudo && !this.message.sudo) {
      return await this.message.reply("```this is for sudo users only!```");
    }

    if (cmd?.isGroup && !this.message.isGroup) {
      return await this.message.reply("```this command is for groups only!```");
    }

    if (
      cmd?.isGroup &&
      cmd?.isAdmin &&
      !isAdmin(this.message.sessionId, this.message.chat, this.message.sender)
    ) {
      return await this.message.reply(
        "```this command requires group admin privileges!```",
      );
    }

    try {
      await cmd.exec(this.message, this.client, args);
    } catch (error) {
      log.error("[text] CMD ERROR:", error);
    }
  }

  async eventUser(type: MessageUpsertType) {
    if (!this.message || type !== "notify") return;

    const msgId = this.message.key.id || this.message.key?.id;
    if (!msgId || processedMessages.has(msgId)) return;

    processedMessages.add(msgId);

    setTimeout(() => {
      processedMessages.delete(msgId);
    }, 5000);

    for (const cmd of Plugins.eventCommands) {
      try {
        if (cmd?.isSudo && !this.message.sudo) continue;
        await cmd.exec(this.message, this.client);
      } catch (error) {
        log.error("[event] CMD ERROR:", error);
      }
    }
  }

  async load(pluginsFolder: string) {
    if (Plugins.isLoaded) return;

    const files = readdirSync(pluginsFolder).filter(
      (file) => file.endsWith(".js") || file.endsWith(".ts"),
    );

    for (const file of files) {
      try {
        const filePath = resolve(join(pluginsFolder, file));
        const fileUrl = pathToFileURL(filePath).href;
        const imported = await import(fileUrl);
        const commandData = imported.default;

        if (Array.isArray(commandData)) {
          for (const cmd of commandData) {
            this.registerCommand(cmd);
          }
        } else {
          this.registerCommand(commandData);
        }
      } catch (error) {
        log.error(`Failed to load plugin ${file}:`, error);
      }
    }
    Plugins.isLoaded = true;
  }

  private registerCommand(cmd: CommandProperty) {
    if (cmd.event) {
      Plugins.eventCommands.push(cmd);
    }

    if (cmd.pattern) {
      const pattern = cmd.pattern.toLowerCase();
      Plugins.commands.set(pattern, cmd);

      if (cmd.alias) {
        for (const alias of cmd.alias) {
          Plugins.commands.set(alias.toLowerCase(), cmd);
        }
      }
    }
  }

  find(patternOrAlias: string): CommandProperty | undefined {
    return Plugins.commands.get(patternOrAlias);
  }

  findAll(): CommandProperty[] {
    return Array.from(Plugins.commands.values());
  }
}

export interface CommandProperty {
  pattern?: string;
  alias?: Array<string>;
  category?: CommandCategories;
  event?: boolean;
  dontAddToCommandList?: boolean;
  isGroup?: boolean;
  isAdmin?: boolean;
  isSudo?: boolean;
  exec: (msg: Message, sock?: WASocket, args?: string) => Promise<any>;
}

type CommandCategories =
  | "p2p"
  | "groups"
  | "newsletter"
  | "status"
  | "util"
  | "games"
  | "system"
  | "settings"
  | "media";
