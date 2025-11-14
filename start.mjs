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

let child = null, crashCount = 0, lastStart = 0, shuttingDown = false;
const log = (...a) => console.log(`[boot ${new Date().toISOString()}]`, ...a);
const computeBackoff = () => Math.min(opts.maxBackoffMs, opts.baseBackoffMs * 2 ** Math.max(0, crashCount - 1));

const launchChild = () => {
  if (shuttingDown) return;
  lastStart = Date.now();
  child = spawn(opts.command, opts.args, { stdio: "inherit", cwd: process.cwd(), env: process.env });

  child.on("error", err => log("child spawn error:", err));
  child.on("exit", (code, signal) => {
    const ranMs = Date.now() - lastStart;
    log("child exited:", { code, signal, ranMs });
    crashCount = ranMs >= opts.stableRunMs ? 0 : crashCount + 1;
    child = null;
    if (!shuttingDown) {
      const delay = Math.max(opts.restartDelayMs, computeBackoff());
      log(`restarting in ${delay}ms`);
      setTimeout(() => { if (!shuttingDown) launchChild(); }, delay);
    }
  });
};

const Signals = () => {
  const forward = sig => process.on(sig, () => {
    shuttingDown = true;
    if (child && !child.killed) {
      child.kill("SIGTERM");
      const t = setTimeout(() => { if (child && !child.killed) child.kill("SIGKILL"); }, 5000);
      child.once("exit", () => { clearTimeout(t); process.exit(0); });
    } else process.exit(0);
  });
  ["SIGINT", "SIGTERM", "SIGQUIT"].forEach(forward);
};

const Guards = () => {
  process.on("uncaughtException", err => log("supervisor uncaughtException:", err));
  process.on("unhandledRejection", r => log("supervisor unhandledRejection:", r));
  process.on("disconnect", () => log("supervisor disconnected"));
};

(() => {
  Guards();
  Signals();
  launchChild();
  if (process.stdin && !process.stdin.readableEnded) process.stdin.resume();
})();
