import { WebSocket } from "ws";
import wordsRoute from "./routes/words";
import { wss } from "./server";
import whiteboardRoute from "./routes/whiteboard";

const routes: Record<string, (ws: WebSocket) => void> = {
    "words": wordsRoute,
    "whiteboard": whiteboardRoute
}

wss.on("connection", ws => {
    console.log("+ Connection");

    ws.once("message", message => {
        const data = JSON.parse(message.toString());

        console.log(data.route);
    
        if (!data.type && data.type !== "connect" && !data.route) return;
    
        if (routes[data.route])
            routes[data.route](ws);
    });
});