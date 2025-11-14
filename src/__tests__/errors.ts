import { AstroBridgeError } from "../client/errors.js";

function test_timout_error() {
    setTimeout(() => {
        console.info("Testing Timeout Error");
        throw new AstroBridgeError("The operation has timed out.");
    }, 2500);
}

test_timout_error();