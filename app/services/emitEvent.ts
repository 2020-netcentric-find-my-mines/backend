import { Server } from "socket.io";
import { SocketEvent } from "../socket-event";

export function emitPublicEvent(server: Server, event: SocketEvent, data: any) {
    this.server.sockets.to(this.identifier).emit(event, data);
}

export function emitPrivateEvent(server: Server, event: SocketEvent, playerID: string, data: any) {
    this.server.sockets.to(playerID).emit(event, data);
}