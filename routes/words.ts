import fs from "fs";
import { broadcast, wss } from "../server";
import { WebSocket } from "ws";

const standardKeys =
    "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>? ";

type State = {
    content: string;
    shift: boolean;
    capsLock: boolean;
}

function getNewState(state: State, key: string) {
    const newState = { ...state };

    key = key.toLowerCase().trim();

    if (key === "shift")
        newState.shift = !state.shift;

    if (key === "caps") {
        newState.capsLock = !state.capsLock;
        newState.shift = newState.capsLock;
    }

    if (key === "tab")
        newState.content += "    ";

    if (key === "enter")
        newState.content += "\n";

    if (key === "space")
        newState.content += " ";

    if (standardKeys.includes(key)) {
        newState.content += state.shift ? key.toUpperCase() : key;

        if (!state.capsLock && state.shift)
            newState.shift = false;

        if (state.capsLock && !state.shift)
            newState.shift = true;
    }

    return newState;
}

const ratelimits: { [key: string]: Date } = {};
const ratelimit = 1000 * 10; // 10 seconds

function getState() {
    return JSON.parse(fs.readFileSync("words_state.json", "utf8"));
}

function setState(state: State) {
    fs.writeFileSync("words_state.json", JSON.stringify(state));
}

export default function wordsRoute(ws: WebSocket) {
    ws.send(JSON.stringify({ type: "connected" }));

    ws.addListener("message", message => {
        // @ts-ignore
        if (ratelimits[ws._socket.remoteAddress] && new Date().getTime() - ratelimits[ws._socket.remoteAddress].getTime() < ratelimit)
            return;

        const data = JSON.parse(message.toString());

        if (!data.type) return;

        if (data.type === "key") {
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

    // time until ratelimit ends
    // @ts-ignore
    const time = ratelimits[ws._socket.remoteAddress] ? new Date().getTime() - ratelimits[ws._socket.remoteAddress].getTime() : 0;
    ws.send(JSON.stringify({ type: "state", state: getState(), ratelimit: time === 0 || time >= ratelimit ? undefined : time }));
}
