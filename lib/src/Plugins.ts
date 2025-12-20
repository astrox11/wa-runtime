import { readdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { jidNormalizedUser, type WASocket } from "baileys";
import type { Message } from "./Message";
import { isSudo, log } from "../";

export class Plugins {
  message: Message;
  client: WASocket;
  private static commands: Map<string, CommandProperty> = new Map();
  private static eventCommands: CommandProperty[] = [];

  constructor(message: Message, client: WASocket) {
    this.message = message;
    this.client = client;
  }

  async text() {
    if (this.message && this.message?.text) {
      const text = this.message.text.replace(/^\s+|\s+$/g, "");
      const cmd = this.find(text);
      const args = text.slice(cmd?.pattern?.length);
      const owner = [this.client.user.phoneNumber, this.client.user.lid].map(
        (p) => jidNormalizedUser(p),
      );

      if (
        cmd?.isSudo &&
        !(
          isSudo(this.message.sender) ||
          isSudo(this.message.sender_alt) ||
          owner.includes(this.message.sender)
        )
      ) {
        return;
      }

      if (cmd?.isGroup && !this.message.isGroup) {
        return await this.message.reply(
          "```this command is for groups only!```",
        );
      }

      if (cmd) {
        try {
          await cmd.exec(this.message, this.client, args);
        } catch (error) {
          log.error("[text] CMD ERROR:", error);
        }
      }
    }
  }

  async sticker() {
    // Implement for sticker based trigger
  }

  async event() {
    if (this.message && this.message?.text) {
      for (const cmd of Plugins.eventCommands) {
        try {
          return await cmd.exec(this.message, this.client);
        } catch (error) {
          log.error("[event] CMD ERROR:", error);
        }
      }
    }
  }

  async load(pluginsFolder: string) {
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
  }

  private registerCommand(cmd: CommandProperty) {
    if (cmd.event) {
      Plugins.eventCommands.push(cmd);
      return;
    }

    if (cmd.pattern) {
      Plugins.commands.set(cmd.pattern.toLowerCase(), cmd);

      if (cmd.alias) {
        for (const alias of cmd.alias) {
          Plugins.commands.set(alias.toLowerCase(), cmd);
        }
      }
    }
  }

  find(patternOrAlias: string): CommandProperty | undefined {
    return Plugins.commands.get(patternOrAlias.toLowerCase());
  }

  findAll(): CommandProperty[] {
    const unique = new Map<string, CommandProperty>();

    for (const cmd of Plugins.commands.values()) {
      if (cmd.pattern) {
        unique.set(cmd.pattern, cmd);
      }
    }

    for (const cmd of Plugins.eventCommands) {
      if (cmd.pattern) {
        unique.set(cmd.pattern, cmd);
      }
    }

    return Array.from(unique.values());
  }
}

export interface CommandProperty {
  pattern?: string;
  alias?: Array<string>;
  desc?: string;
  category: CommandCategories;
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
  | "system";
