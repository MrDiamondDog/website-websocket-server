import { WebSocket } from "ws";

type Shape = "line" | "arrow" | "rectangle" | "circle";

type Vec2 = {
    x: number;
    y: number;
}

type Stroke = {
    startX: number;
    startY: number;
    points: Vec2[];
    color: string;
    size: number;
    eraser?: boolean;
}

type ShapeStroke = {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    size: number;
    shape: Shape;
    fill?: boolean;
}

interface Room {
    objects: (Stroke | ShapeStroke)[];
    users: { ws: WebSocket, name: string, id: string, mousePos: Vec2, color: string }[];
    roomCode: string;
}

const rooms: Record<string, Room> = {};

const colors = [
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
    "#008000",
];

export default function whiteboardRoute(ws: WebSocket) {
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("close", () => {
        const room = Object.values(rooms).find(room => room.users.some(user => user.ws === ws));

        if (!room)
            return;

        const leftUser = room.users.find(user => user.ws === ws);

        if (!leftUser)
            return;

        room.users = room.users.filter(u => u.ws !== ws);

        for (const user of room.users) {
            user.ws.send(JSON.stringify({ type: "user left", id: leftUser.id }));
        }
    });

    ws.on("message", async message => {
        const data = JSON.parse(message.toString());
        if (!data.type) return;

        if (data.type === "host") {
            if (!data.id) return;

            if (Object.values(rooms).some(room => room.users.some(user => user.id === data.id)))
                return;

            const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

            rooms[roomCode] = {
                objects: [],
                users: [],
                roomCode
            };

            ws.send(JSON.stringify({ type: "host room code", roomCode }));
        }

        if (data.type === "join") {
            if (!data.roomCode) return;
            if (!data.id) return;

            if (Object.values(rooms).some(room => room.users.some(user => user.id === data.id)))
                return;

            const room = rooms[data.roomCode];

            if (!room)
                return;

            const color = colors[room.users.length % colors.length];

            room.users.push({ ws, name: data.name, mousePos: { x: 0, y: 0 }, color, id: data.id });

            for (const user of room.users) {
                user.ws.send(JSON.stringify({ type: "user joined", name: data.name, id: data.id, color, mousePos: { x: 0, y: 0 } }));
            }

            ws.send(JSON.stringify({ type: "joined", room: { users: room.users.map(user => ({ color: user.color, name: user.name, id: user.id, mousePos: user.mousePos })), objects: room.objects, roomCode: room.roomCode } }));
        }

        if (data.type === "mousemove") {
            if (!data.roomCode) return;

            if (!rooms[data.roomCode])
                return;

            const user = rooms[data.roomCode].users.find(user => user.ws === ws);

            if (!user)
                return;

            for (const user of rooms[data.roomCode].users) {
                if (user.id === data.id) continue;

                user.ws.send(JSON.stringify({ type: "mousemove", x: data.x, y: data.y, id: data.id }));
            }

            user.mousePos = { x: data.x, y: data.y };
        }

        if (data.type === "stroke") {
            if (!data.roomCode) return;

            if (!rooms[data.roomCode])
                return;

            if (!rooms[data.roomCode].users.find(user => user.ws === ws))
                return;

            for (const user of rooms[data.roomCode].users) {
                if (user.id === data.id) continue;

                user.ws.send(JSON.stringify({ type: "stroke", stroke: data.stroke, shape: data.shape }));
            }

            rooms[data.roomCode].objects.push(data.stroke);
        }
    });
}