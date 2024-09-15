import fs from "fs";
import { WebSocketServer } from "ws";

import { getNewState, State } from "@/lib/words";

const wss = new WebSocketServer({ port: 8080 });

const ratelimits: { [key: string]: Date } = {};
const ratelimit = 1000 * 10; // 10 seconds

function getState() {
    return JSON.parse(fs.readFileSync("state.json", "utf8"));
}

function setState(state: State) {
    fs.writeFileSync("state.json", JSON.stringify(state));
}

function broadcast(data: any) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
}

wss.addListener("connection", ws => {
    ws.addListener("message", message => {
        // @ts-ignore
        if (ratelimits[ws._socket.remoteAddress] && new Date().getTime() - ratelimits[ws._socket.remoteAddress].getTime() < ratelimit)
            return;

        const data = JSON.parse(message.toString());

        if (!data.type) return;

        if (data.type === "get-state")
            ws.send(JSON.stringify({ type: "state", state: getState() }));
        else if (data.type === "key") {
            if (!data.key) return;
            const { key } = data;

            const state = getState();
            const newState = getNewState(state, key);

            setState(newState);
            broadcast({ type: "state", state: newState });

            // @ts-ignore
            ratelimits[ws._socket.remoteAddress] = new Date();
        }
    });
    ws.send(JSON.stringify({ type: "state", state: getState() }));
    console.log("+ Connection");
});
