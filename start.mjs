import { spawn } from "child_process";
import path from "path";

const isTest = process.argv.includes("--test");

const opts = {
    command: isTest ? "npx" : "node",
    args: isTest ? ["tsx", "src/core/main.ts"] : [path.join("dist", "src", "core", "main.js")],
    baseBackoffMs: 250,
    maxBackoffMs: 30000,
    stableRunMs: 60000,
    restartDelayMs: 1000
};

let child = null;
let crashCount = 0;
let lastStart = 0;
let shuttingDown = false;

function log(...a) {
    const ts = new Date().toISOString();
    console.log(`[boot ${ts}]`, ...a);
}

function computeBackoff() {
    return Math.min(
        opts.maxBackoffMs,
        opts.baseBackoffMs * Math.pow(2, Math.max(0, crashCount - 1))
    );
}

function spawnChild() {
    if (shuttingDown) return;
    lastStart = Date.now();
    child = spawn(opts.command, opts.args, {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env
    });

    child.on("error", err => {
        log("child spawn error:", err);
    });

    child.on("exit", (code, signal) => {
        const ranMs = Date.now() - lastStart;
        log("child exited:", { code, signal, ranMs });

        if (ranMs >= opts.stableRunMs) crashCount = 0;
        else crashCount++;

        child = null;
        if (!shuttingDown) {
            const backoff = computeBackoff();
            const delay = Math.max(opts.restartDelayMs, backoff);
            log(`restarting in ${delay}ms`);
            setTimeout(() => {
                if (!shuttingDown) spawnChild();
            }, delay);
        }
    });
}

function setupSignals() {
    const fwd = (sig) => {
        process.on(sig, () => {
            shuttingDown = true;
            if (child && !child.killed) {
                child.kill("SIGTERM");
                const t = setTimeout(() => {
                    if (child && !child.killed) child.kill("SIGKILL");
                }, 5000);
                child.once("exit", () => {
                    clearTimeout(t);
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });
    };
    ["SIGINT", "SIGTERM", "SIGQUIT"].forEach(s => fwd(s));
}

function setupGuards() {
    process.on("uncaughtException", err => log("supervisor uncaughtException:", err));
    process.on("unhandledRejection", r => log("supervisor unhandledRejection:", r));
    process.on("disconnect", () => log("supervisor disconnected"));
}

function main() {
    setupGuards();
    setupSignals();
    spawnChild();
    if (process.stdin && !process.stdin.readableEnded) process.stdin.resume();
}

main();
