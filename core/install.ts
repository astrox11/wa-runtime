import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { cwd } from "process";

try {
  const target = path.join(
    "node_modules",
    "libsignal",
    "src",
    "session_record.js"
  );
  const content = fs.readFileSync(`${cwd()}${target}`, "utf8");
  fs.writeFileSync(
    target,
    content
      .split("\n")
      .filter(
        (line) =>
          !line.includes('console.info("Closing session:", session)') &&
          !line.includes(
            'console.info("Removing old closed session:", oldestSession)'
          )
      )
      .join("\n"),
    "utf8"
  );
} catch {
  /** */
}

try {
  execSync("bun run build", {
    cwd: path.join("node_modules", "baileys"),
    stdio: "ignore",
  });
} catch {
  /* */
}

try {
  execSync("bun run build", {
    cwd: path.join("node_modules", "whatsapp-rust-bridge"),
    stdio: "ignore",
  });
} catch {
  /* */
}

try {
  execSync("bun tsc", {
    cwd: path.join("./"),
    stdio: "ignore",
  });
} catch {
  /* */
}
