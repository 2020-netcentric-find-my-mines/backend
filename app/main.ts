import express from 'express';
import cors from 'cors';
import socket from 'socket.io';
import { Game } from './game';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';
import { GameState } from './types/game.interface';

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

const io = socket.listen(app);

function findGame(playerID: string): Game {
    let gameID = _games[playerID];
    return games.find((g) => g.identifier === gameID);
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
        let game = new Game(io);
        game.addPlayer(playerID);
        games.push(game);
        _games[playerID] = game.identifier;
        socket.join(game.identifier);
        game.emitEvent(SocketEvent.CREATE_GAME_FEEDBACK, {
            isOK: true,
            data: game.data,
            message: null,
        });

        console.log('✨ [CREATE_GAME] Game', game.identifier);
        console.log('✨ [CREATE_GAME] Player', playerID);
    });

    // Join an existing game
    socket.on(SocketEvent.JOIN_GAME, (gameID) => {
        console.log('✨ [JOIN_GAME] Received', gameID);
        let game = games.find((g) => g.identifier === gameID);
        if (game) {
            console.log('✨ [JOIN_GAME] Found', game.identifier);
            let success = game.addPlayer(playerID);
            if (success) {
                console.log(
                    `✨ [JOIN_GAME] [Player:${playerID}]`,
                    '->',
                    `[Game:${game.identifier}]`,
                );
                socket.join(game.identifier);
                _games[playerID] = game.identifier;
                game.emitEvent(SocketEvent.JOIN_GAME_FEEDBACK, {
                    isOK: true,
                    data: game.data,
                    message: null,
                });
            } else
                socket.to(playerID).emit(SocketEvent.JOIN_GAME_FEEDBACK, {
                    isOK: false,
                    data: game.data,
                    message: 'Game is already started',
                });
        } else {
            socket.to(playerID).emit(SocketEvent.JOIN_GAME_FEEDBACK, {
                isOK: false,
                data: null,
                message: 'Game not found',
            });
        }
    });

    // Quick match
    socket.on(SocketEvent.QUICK_MATCH, () => {
        // Join an existing game that is not started yet
        // If none, create a new game
    });

    socket.on(SocketEvent.START_GAME, () => {
        // Start
        console.log('✨ [START_GAME] Player', playerID);

        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log('✨ [START_GAME] Game', game.identifier);
            console.log('✨ [START_GAME] Players', game.players);

            // Find player
            let player = game.findPlayer(playerID);

            // Run
            if (game && player) {
                let started = game.start();
                if (started) {
                    game.emitEvent(SocketEvent.START_GAME_FEEDBACK, {
                        isOK: true,
                        data: game.data,
                        message: null,
                    });
                } else {
                    game.emitEvent(SocketEvent.START_GAME_FEEDBACK, {
                        isOK: false,
                        data: null,
                        message: 'Failed to start game',
                    });
                }
            }
        }
    });

    socket.on(SocketEvent.SELECT_COORDINATE, (coordinate: Coordinate) => {
        console.log('✨ [SELECT_COORDINATE] Player', playerID);
        console.log('✨ [SELECT_COORDINATE] _games', _games);

        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log('✨ [SELECT_COORDINATE] Game', game.identifier);
            console.log('✨ [SELECT_COORDINATE] Players', game.players);
            console.log('✨ [SELECT_COORDINATE] Coordinate', coordinate);

            // Find player
            let player = game.findPlayer(playerID);

            // Run
            if (game && player && coordinate) {
                let selected = game.playerDidSelectCoordinate(
                    player,
                    coordinate,
                );
                if (selected) {
                    game.emitEvent(SocketEvent.SELECT_COORDINATE_FEEDBACK, {
                        isOK: true,
                        data: game.data,
                        message: null,
                    });
                } else {
                    game.emitEvent(SocketEvent.SELECT_COORDINATE_FEEDBACK, {
                        isOK: false,
                        data: null,
                        message: 'Failed to select coordinate',
                    });
                }
            }
        }
    });

    socket.on(SocketEvent.DISCONNECT, () => {
        console.log('🔥 User', socket.id);

        // Find game
        let game = findGame(playerID);

        if (game) {
            // Find player
            let player = game.findPlayer(playerID);

            // Run
            let currentGameState = game.playerDidDisconnect(player);
            delete _games[playerID];
            if (currentGameState == GameState.EMPTY)
                games.splice(games.indexOf(game), 1);
        }
    });

    socket.on(SocketEvent.SET_NUMBER_OF_BOMB, (amount: number) => {
        console.log('There will be (amount) number of bomb');

        // Find game
        let game = findGame(playerID);

        // Configure number of bomb
        game.setNumberOfBombs(amount);
    });

    socket.on(SocketEvent.PAUSE, () => {
        console.log('The game will be pause');

        // Find game
        let game = findGame(playerID);

        // Pause the game
        let pause: boolean = game.playerDidSelectPause();

        if (!pause) {
            socket.emit('ERROR', 'Error pausing game');
            console.log('Error pausing the game');
        }
    });

    socket.on(SocketEvent.SET_BOARD_SIZE, (w: number, h: number) => {
        // Find game
        let game = findGame(playerID);

        // Set board size
        let set = game.setBoardSize(w, h);

        if (!set) {
            socket.emit('ERROR', 'Error setting board size');
            console.log('Error setting board size');
        }
    });

    socket.on(SocketEvent.SET_MAX_PLAYER, (amount: number) => {
        // Find game
        let game = findGame(playerID);

        // Set max player
        let set = game.setMaxPlayers(amount);

        if (!set) {
            socket.emit('ERROR', 'Error setting max player');
            console.log('Error setting max player');
        }
    });

    // To show other player whose turn is it
    socket.on(SocketEvent.GET_CURRENT_PLAYER, () => {
        // Find game
        let game = findGame(playerID);

        let result = game.getCurrentPlayer();

        socket.emit(SocketEvent.CURRENT_PLAYER, result);
    });
});
