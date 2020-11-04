import { Server } from "socket.io";
import { SocketEvent } from "../socket-event";

export function emitPublicEvent(server: Server, event: SocketEvent, identifier: string, data: any) {
    server.sockets.to(identifier).emit(event, data);
}

export function emitPrivateEvent(server: Server, event: SocketEvent, playerID: string, data: any) {
    server.sockets.to(playerID).emit(event, data);
}