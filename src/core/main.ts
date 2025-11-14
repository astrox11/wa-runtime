import { fetchLatestWaWebVersion, makeWASocket, useMultiFileAuthState } from "../../lib/index.js";

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
    const { version } = await fetchLatestWaWebVersion();
    const sock = makeWASocket({
        auth: state,
        version
    });

    await new Promise((resolve) => sock.ws.on("close", resolve));
}

startSock().catch(err => {
    console.error(err);
    process.exit(1);
});
