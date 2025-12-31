import https from "https";

let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 3;
const TIMEOUT_MS = 3000;

export async function isNetworkStable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(
      "https://www.google.com/generate_204",
      { timeout: TIMEOUT_MS },
      (res) => {
        const ok = res.statusCode !== undefined && res.statusCode < 300;
        res.resume();

        consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
        resolve(consecutiveFailures < FAILURE_THRESHOLD);
      },
    );

    req.on("timeout", () => {
      req.destroy();
      consecutiveFailures++;
      resolve(consecutiveFailures < FAILURE_THRESHOLD);
    });

    req.on("error", () => {
      consecutiveFailures++;
      resolve(consecutiveFailures < FAILURE_THRESHOLD);
    });
  });
}
