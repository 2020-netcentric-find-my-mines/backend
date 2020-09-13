import express from 'express';
import cors from 'cors'
import socket from 'socket.io';
import { Game } from './game';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';

let app = express()
    .use(cors())
    .use((_: express.Request, res: express.Response) => {
        return res
            .send(
                '<img src="https://media1.tenor.com/images/3cee627ab9f455a0f14739ba5edbf81a/tenor.gif?itemid=13499314" />',
            )
            .end();
    })
    .listen(process.env.PORT || 3001);

const io = socket.listen(app)
// const io = socket(app, { origins: '*:*' });

// Utilities
function deleteByValue(object: Record<string, string>, value: string) {
    for (var key in object) {
        if (object[key] === value) delete object[key];
    }
}

// Mapping Player ID -> Game ID
const _games: Record<string, string> = {};

// All games
let proxyHandler: ProxyHandler<Game[]> = {
    get: function (target: Game[], property: number) {
        return target[property];
    },
    set: function (target: Game[], property: number, value, receiver) {
        target[property] = value;
        let filtered = target.filter((g) => {
            if (!g.isEmpty) {
                return true;
            } else {
                deleteByValue(_games, g.identifier);
                return false;
            }
        });
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
        game.addPlayer(playerID)
        games.push(game);
        _games[playerID] = game.identifier
        socket.join(game.identifier);

        console.log("✨ [CREATE_GAME] Game", game.identifier)
        console.log("✨ [CREATE_GAME] Player", playerID)
    });

    // Join an existing game
    socket.on(SocketEvent.JOIN_GAME, (gameID) => { });

    // Quick match
    socket.on(SocketEvent.QUICK_MATCH, () => {
        // Join an existing game that is not started yet
        // If none, create a new game
    });

    socket.on(SocketEvent.SELECT_COORDINATE, (coordinate: Coordinate) => {
        console.log("✨ [SELECT_COORDINATE] Player", playerID)
        let gameID = _games[playerID];
        console.log("✨ [SELECT_COORDINATE] _games", _games)

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        if (game) {
            console.log("✨ [SELECT_COORDINATE] Game", game.identifier)
            console.log("✨ [SELECT_COORDINATE] Players", game.players)
            console.log("✨ [SELECT_COORDINATE] Coordinate", coordinate)

            // Find player
            let player = game.players.find((p) => p.id === playerID);

            // Run
            if (game && player && coordinate) {
                game.playerDidSelectCoordinate(player, coordinate);
            }
        }
    });

    socket.on(SocketEvent.DISCONNECT, () => {
        console.log('🔥 User', socket.id);

        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        if (game) {
            // Find player
            let player = game.players.find((p) => p.id === playerID);

            // Run
            game.playerDidDisconnect(player);
        }
    });

    socket.on(SocketEvent.SET_NUMBER_OF_BOMB, (amount: number) => {
        console.log('There will be (amount) number of bomb');

        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Configure number of bomb
        game.setNumberOfBombs(amount);
    });

    socket.on(SocketEvent.PAUSE, () => {
        console.log('The game will be pause');

        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Pause the game
        let pause: boolean = game.playerDidSelectPause();

        if (!pause) {
            socket.emit('ERROR', 'Error pausing game');
            console.log('Error pausing the game');
        }
    });

    socket.on(SocketEvent.SET_BOARD_SIZE, (w: number, h: number) => {
        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Set board size
        let set = game.setBoardSize(w, h);

        if (!set) {
            socket.emit('ERROR', 'Error setting board size');
            console.log('Error setting board size');
        }
    });

    socket.on(SocketEvent.SET_MAX_PLAYER, (amount: number) => {
        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        // Set max player
        let set = game.setMaxPlayers(amount);

        if (!set) {
            socket.emit('ERROR', 'Error setting max player');
            console.log('Error setting max player');
        }
    });

    // To show other player whose turn is it
    socket.on(SocketEvent.GET_CURRENT_PLAYER, () => {
        let gameID = _games[playerID];

        // Find game
        let game = games.find((g) => g.identifier === gameID);

        let result = game.getCurrentPlayer();

        socket.emit(SocketEvent.CURRENT_PLAYER, result);
    });
});
