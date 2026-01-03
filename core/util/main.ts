import type { WAMessageContent } from "baileys";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { execSync } from "child_process";
import config from "../../config";
import parsePhoneNumberFromString, {
  isValidPhoneNumber,
} from "libphonenumber-js";
import { addContact } from "../sql";

export const COLORS = {
  reset: "\x1b[0m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[34m",
  trace: "\x1b[35m",
};

export const additionalNodes = [
  {
    tag: "biz",
    attrs: {},
    content: [
      {
        tag: "interactive",
        attrs: { type: "native_flow", v: "1" },
        content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
      },
    ],
  },
];

export const log = {
  info(...args: any[]) {
    const prefix = `\x1b[1m${COLORS.info}${timestamp()} [INFO]`;
    console.log(prefix, ...args.map(formatArg), COLORS.reset);
  },
  warn(...args: any[]) {
    if (!config.DEBUG) return;
    const prefix = `\x1b[1m${COLORS.warn}${timestamp()} [WARN]`;
    console.warn(prefix, ...args.map(formatArg), COLORS.reset);
  },
  error(...args: any[]) {
    if (!config.DEBUG) return;
    const prefix = `\x1b[1m${COLORS.error}${timestamp()} [ERROR]`;
    console.error(prefix, ...args.map(formatArg), COLORS.reset);
  },
  debug(...args: any[]) {
    if (!config.DEBUG) return;
    const prefix = `\x1b[1m${COLORS.debug}${timestamp()} [DEBUG]`;
    console.log(prefix, ...args.map(formatArg), COLORS.reset);
  },
  trace(...args: any[]) {
    if (!config.DEBUG) return;
    const prefix = `\x1b[1m${COLORS.trace}${timestamp()} [TRACE]`;
    console.log(prefix, ...args.map(formatArg), COLORS.reset);
  },
};

export function formatRuntime(uptimeSeconds: number) {
  let seconds = Math.floor(uptimeSeconds);

  const MONTH = 30 * 24 * 3600;
  const DAY = 24 * 3600;
  const HOUR = 3600;
  const MIN = 60;

  const months = Math.floor(seconds / MONTH);
  seconds %= MONTH;
  const days = Math.floor(seconds / DAY);
  seconds %= DAY;
  const hours = Math.floor(seconds / HOUR);
  seconds %= HOUR;
  const mins = Math.floor(seconds / MIN);
  const secs = seconds % MIN;

  const parts = [];
  if (months > 0) parts.push(months + "mo");
  if (days > 0) parts.push(days + "d");
  if (hours > 0) parts.push(hours + "h");
  if (mins > 0) parts.push(mins + "m");
  if (secs > 0) parts.push(secs + "s");

  return parts.join(" ");
}

export function formatp(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatArg(a: any): any {
  if (a instanceof Error) return a.stack ?? a.message;
  if (typeof a === "object" && a !== null) {
    try {
      return JSON.stringify(a, null, 2);
    } catch {
      return String(a);
    }
  }
  return a;
}

export function toSmallCaps(text: string): string {
  const smallCaps = [
    "ᴀ",
    "ʙ",
    "ᴄ",
    "ᴅ",
    "ᴇ",
    "ғ",
    "ɢ",
    "ʜ",
    "ɪ",
    "ᴊ",
    "ᴋ",
    "ʟ",
    "ᴍ",
    "ɴ",
    "ᴏ",
    "ᴘ",
    "ǫ",
    "ʀ",
    "s",
    "ᴛ",
    "ᴜ",
    "ᴠ",
    "ᴡ",
    "x",
    "ʏ",
    "ᴢ",
  ];
  return text
    .toUpperCase()
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? smallCaps[code - 65] : c;
    })
    .join("");
}

export function sanitizePhoneNumber(pn: string): string | null {
  let i = pn.replace(/[^\d+]/g, "");

  if (!i.startsWith("+")) i = "+" + i;

  if (!isValidPhoneNumber(i)) return null;

  const parsed = parsePhoneNumberFromString(i);
  if (!parsed?.number) return null;

  return parsed.number.replace("+", "");
}

export function handleLidMapping(
  sessionId: string,
  key: string,
  value: string,
) {
  const isPn = !key.includes("reverse");

  if (isPn) {
    const pnKey = key.split("-")[2];
    const cleanedValue = value.replace(/^"|"$/g, "");

    if (pnKey) {
      addContact(sessionId, pnKey, cleanedValue);
    }
  } else {
    const keyPart = key.split("-")[2];
    const lidKey = keyPart?.split("_")[0];
    const cleanedValue = value.replace(/^"|"$/g, "");

    if (lidKey) {
      addContact(sessionId, cleanedValue, lidKey);
    }
  }
}

export function generateSessionId(phoneNumber: string): string {
  return `session_${phoneNumber}`;
}

export function isUrl(input: string | URL): boolean {
  try {
    const url = typeof input === "string" ? new URL(input) : input;
    if (typeof input === "string" && /\s/.test(input)) return false;
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Check if text contains any URL (for antilink detection)
 * Detects: http://, https://, www., wa.me, t.me, chat.whatsapp.com, and common domains
 */
export function containsUrl(text: string): boolean {
  const urlPatterns = [
    /https?:\/\/[^\s]+/i,
    /www\.[^\s]+/i,
    /wa\.me\/[^\s]*/i,
    /chat\.whatsapp\.com\/[^\s]*/i,
    /t\.me\/[^\s]*/i,
    /[a-zA-Z0-9-]+\.(com|net|org|io|co|id|xyz|me|info|biz|us|tv|gg|link|site|online|store|app|dev|tech|pro|cc|ws|to|ly|gl|gd|bit\.ly)[^\s]*/i,
  ];

  for (const pattern of urlPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

export function isPath(input: string | URL): boolean {
  try {
    if (input instanceof URL) return input.pathname.length > 0;
    if (!input || /\0/.test(input)) return false;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(input)) return false;
    return (
      input.startsWith("/") ||
      input.startsWith("./") ||
      input.startsWith("../") ||
      !input.includes(":")
    );
  } catch {
    return false;
  }
}

export function ExtractTextFromMessage(
  message: WAMessageContent,
): string | undefined {
  if (message?.extendedTextMessage?.text)
    return message.extendedTextMessage.text;
  if (message?.conversation) return message.conversation;
  if (message?.imageMessage?.caption) return message.imageMessage.caption;
  if (message?.videoMessage?.caption) return message.videoMessage.caption;
  if (message?.documentMessage?.caption) return message.documentMessage.caption;
  if (message?.buttonsMessage?.contentText)
    return message.buttonsMessage.contentText;
  if (message?.templateMessage?.hydratedTemplate?.hydratedContentText)
    return message.templateMessage.hydratedTemplate.hydratedContentText;
  if (message?.listMessage?.description) return message.listMessage.description;
  if (message?.protocolMessage?.editedMessage)
    return ExtractTextFromMessage(message.protocolMessage.editedMessage);
  return undefined;
}

export function bufferToPath(buffer: Buffer, extension = "tmp"): string {
  const fileName = `tmp-${randomBytes(6).toString("hex")}.${extension}`;
  const filePath = join(tmpdir(), fileName);
  writeFileSync(filePath, buffer);
  return filePath;
}

export function ToMp3(inputPath: string): string {
  const outputPath = join(
    tmpdir(),
    `audio-${randomBytes(6).toString("hex")}.mp3`,
  );
  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}"`,
      { stdio: "ignore" },
    );
    return outputPath;
  } catch (err: any) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

export function ToMp4(inputPath: string): string {
  const outputPath = join(
    tmpdir(),
    `video-${randomBytes(6).toString("hex")}.mp4`,
  );
  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`,
      { stdio: "ignore" },
    );
    return outputPath;
  } catch (err: any) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

export function TrimVideo(
  inputPath: string,
  start: string,
  end: string,
): string {
  const outputPath = join(
    tmpdir(),
    `trimmed-${randomBytes(6).toString("hex")}.mp4`,
  );
  try {
    execSync(
      `ffmpeg -y -ss ${start} -i "${inputPath}" -to ${end} -c copy "${outputPath}"`,
      { stdio: "ignore" },
    );
    return outputPath;
  } catch (err: any) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

export function ToPTT(inputPath: string): string {
  const outputPath = join(
    tmpdir(),
    `ptt-${randomBytes(6).toString("hex")}.ogg`,
  );
  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -avoid_negative_ts make_zero -ac 1 "${outputPath}"`,
      { stdio: "ignore" },
    );
    return outputPath;
  } catch (err: any) {
    throw new Error(err.stderr?.toString() || err.message);
  }
}

async function fetchFact(): Promise<string> {
  return fetch("https://uselessfacts.jsph.pl/api/v2/facts/random")
    .then((res) => res.json())
    .then((data: { text: string }) => data.text)
    .catch(() => "Did you know facts are fun?");
}

async function fetchQuote(): Promise<string> {
  return fetch("https://zenquotes.io/api/random")
    .then((res) => res.json())
    .then((data: { q: string; a: string }[]) => {
      const quote = data[0];
      return quote ? `${quote.q} - ${quote.a}` : "Stay positive!";
    })
    .catch(() => "Stay positive!");
}

async function fetchJoke(): Promise<string> {
  return fetch("https://v2.jokeapi.dev/joke/Any?type=single")
    .then((res) => res.json())
    .then(
      (data: { joke: string }) =>
        data.joke ||
        "Why don't scientists trust atoms? They make up everything!",
    )
    .catch(() => "Why don't scientists trust atoms? They make up everything!");
}

export async function replacePlaceholders(
  message: string,
  sender: string,
  ownerId: string,
  botName: string,
): Promise<string> {
  let result = message
    .replace(/@user/g, sender.split("@")[0] ?? sender)
    .replace(/@owner/g, ownerId.split("@")[0] ?? ownerId)
    .replace(/@botname/g, botName);

  if (result.includes("@facts"))
    result = result.replace(/@facts/g, await fetchFact());
  if (result.includes("@quotes"))
    result = result.replace(/@quotes/g, await fetchQuote());
  if (result.includes("@jokes"))
    result = result.replace(/@jokes/g, await fetchJoke());

  return result;
}

export function timestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const date = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear().toString().slice(-2);
  return `${hours}:${minutes}, ${month}/${date}/${year}`;
}
