import util from "util";

const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
};

export class AstroBridgeError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = "AstroBridgeError";

        const origin = AstroBridgeError.extractOrigin((new Error()).stack) || "unknown";
        Object.defineProperty(this, "originFile", {
            value: origin,
            enumerable: false,
            configurable: true,
            writable: false,
        });

        const header = `${C.red}${C.bold}${this.name}${C.reset}`;
        const rawStackLines = (new Error(message).stack || "").split("\n").slice(1);

        const filtered = rawStackLines.filter(line => {
            const l = line.trim();
            if (!l) return false;
            if (l.includes("errors.js") || l.includes("errors.ts")) return false;
            if (l.includes("node:internal")) return true;
            return true;
        });

        const filteredStack = filtered.join("\n");

        this.stack =
            `\n${header}:\n` +
            `${C.cyan}${C.bold}FILE:${C.reset} ${origin}\n` +
            `${C.yellow}${C.bold}INFO:${C.reset} ${this.message}\n` +
            `${C.magenta}${C.bold}STACK:${C.reset}\n` +
            (filteredStack ? filteredStack + "\n" : "");
    }

    static extractOrigin(stack?: string) {
        if (!stack) return "";
        const lines = stack.split("\n").slice(1);
        for (const line of lines) {
            const m = line.match(/\((.*?):\d+:\d+\)/) || line.match(/at (.*?):\d+:\d+/);
            if (m && m[1]) {
                const path = m[1];
                if (!path.includes("errors.ts") && !path.includes("errors.js")) return path;
                continue;
            }
        }
        return "";
    }

    toString() {
        return this.stack;
    }

    [util.inspect.custom]() {
        return this.stack;
    }
}
