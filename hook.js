import fs from "fs";
import path from "path";
import { execSync } from "child_process";

try {
  execSync("npm run build", {
    cwd: path.join("node_modules", "baileys"),
    stdio: "ignore",
  });
} catch {
  /* */
}
try {
  const target = path.join(
    "node_modules",
    "libsignal",
    "src",
    "session_record.js",
  );
  const content = fs.readFileSync(target, "utf8");
  fs.writeFileSync(
    target,
    content
      .split("\n")
      .filter(
        (line) => !line.includes('console.info("Closing session:", session)'),
      )
      .join("\n"),
    "utf8",
  );
} catch {}
