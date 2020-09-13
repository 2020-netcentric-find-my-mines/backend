import express from 'express';
import * as http from 'http';
import socket from 'socket.io';
import { Game } from './game';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';

let app = express();
const server = http.createServer(app);
const options = {
    /* ... */
};
const io = socket(server, options);

// Mapping Player ID -> Game ID
const _games: Record<string, string> = {};

// All games
let proxyHandler: ProxyHandler<Game[]> = {
    get: function (target: Game[], property: number) {
        return target[property];
    },
    set: function (target: Game[], property: number, value, receiver) {
        target[property] = value;
        let filtered = target.filter((g) => !g.isEmpty);
        target = filtered;
        return true;
    },
};

const __games: Game[] = [];
const games = new Proxy(__games, proxyHandler);

// Handle all Socket.IO events
io.on(SocketEvent.CONNECTION, (socket) => {
    console.log('🎉 User', socket.id);
    let playerID = socket.id;

    // Create a new game
    socket.on(SocketEvent.CREATE_GAME, () => {
        let game = new Game(socket);
        games.push(game);
        socket.join(game.identifier);
    });

    // Join an existing game
    socket.on(SocketEvent.JOIN_GAME, (gameID) => { });

    // Quick match
    socket.on(SocketEvent.QUICK_MATCH, () => {
        // Join an existing game that is not started yet
        // If none, create a new game
    });

    socket.on(SocketEvent.SELECT_COORDINATE, (coordinate: Coordinate) => {
        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Find player
        let player = game.players.find((p) => p.id === playerID);

        // Run
        game.playerDidSelectCoordinate(player, coordinate);
    });

    socket.on(SocketEvent.DISCONNECT, () => {
        console.log('🔥 User', socket.id);

        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Find player
        let player = game.players.find((p) => p.id === playerID);

        // Run
        game.playerDidDisconnect(player);
    });
});

// app.listen(3000, () => console.log('Find My Mines!'))
server.listen(3000);
