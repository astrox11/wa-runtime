import { AstroBridgeError } from "../client/errors.js";

console.log("client running test", process.pid);

throw new AstroBridgeError("Test error from client")
