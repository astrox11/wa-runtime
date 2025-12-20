const COLORS = {
  reset: "\x1b[0m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[34m",
};

function timestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const date = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear().toString().slice(-2);

  return `${hours}:${minutes}, ${month}/${date}/${year}`;
}

export const log = {
  info(...args: any[]) {
    const prefix = `\x1b[1m${COLORS.info}${timestamp()} [INFO]`;
    console.log(prefix, ...args.map(formatArg), COLORS.reset);
  },
  warn(...args: any[]) {
    const prefix = `\x1b[1m${COLORS.warn}${timestamp()} [WARN]`;
    console.warn(prefix, ...args.map(formatArg), COLORS.reset);
  },
  error(...args: any[]) {
    const prefix = `\x1b[1m${COLORS.error}${timestamp()} [ERROR]`;
    console.error(prefix, ...args.map(formatArg), COLORS.reset);
  },
  debug(...args: any[]) {
    const prefix = `\x1b[1m${COLORS.debug}${timestamp()} [DEBUG]`;
    console.log(prefix, ...args.map(formatArg), COLORS.reset);
  },
};

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
