import path from "node:path";

export class AstroBridgeError extends Error {
  file: string;

  constructor(message: string, file: string) {
    super(message);
    this.name = "AstroBridgeError";
    this.file = file;

    if (this.stack) {
      const lines = this.stack.split("\n");
      const cleaned = lines.map((line) => {
        const match = line.match(/\((.*?):(\d+):(\d+)\)/);
        if (!match) return line;

        const full = match[1];
        const base = path.basename(full!);
        return line.replace(full!, base);
      });

      this.stack = cleaned.join("\n");
    }
  }
}
