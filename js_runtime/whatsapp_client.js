// WhatsApp Client - Mock Implementation
// This script simulates a WhatsApp client for development purposes

console.log("WhatsApp Client Starting...");
console.log("Session Manager initialized");

// Heartbeat interval
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

let running = true;

// Heartbeat function
function heartbeat() {
  if (running) {
    console.log("Heartbeat: Session active at " + new Date().toISOString());
  }
}

// Start heartbeat
const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);

// Handle graceful shutdown
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  running = false;
  clearInterval(heartbeatTimer);
  console.log("WhatsApp Client stopped");
  process.exit(0);
}

// Register signal handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log("WhatsApp Client Ready - Listening for messages");
