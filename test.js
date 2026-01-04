import fs from "fs";
import path from "path";

// Regex for single-line JS comments
const commentRegex = /\/\/[^\n]*/g;

// Function to process a file
function removeComments(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const cleaned = code.replace(commentRegex, "");
  fs.writeFileSync(filePath, cleaned, "utf8");
  console.log(`Processed: ${filePath}`);
}

// Function to recursively process a directory
function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      removeComments(fullPath);
    }
  }
}

// Change this to the directory you want to clean
const targetDir = "./core";

processDir(targetDir);
console.log("Done removing single-line comments.");
