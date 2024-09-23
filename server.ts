import { WebSocketServer } from "ws";

export const wss = new WebSocketServer({ port: 8080 });

export function broadcast(data: any) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
}