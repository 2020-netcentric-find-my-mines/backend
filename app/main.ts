import express from 'express';
import cors from 'cors';
import socket, { Socket } from 'socket.io';
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

function sendPrivateFeedback(
    event: SocketEvent,
    playerID: string,
    isOK: boolean,
    message: string | null = null,
) {
    io.sockets.to(playerID).emit(event, {
        isOK,
        data: null,
        message,
    });
}

function sendFeedback(
    event: SocketEvent,
    game: Game,
    isOK: boolean,
    message: string | null = null,
) {
    game.emitEvent(event, {
        isOK,
        data: isOK ? game.data : null,
        message,
    });
}

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

        sendFeedback(SocketEvent.CREATE_GAME_FEEDBACK, game, true);
        console.log(`✨ [CREATE_GAME] [Player:${playerID}] -> [Game:${game.identifier}]`);
    });

    // Join an existing game
    socket.on(SocketEvent.JOIN_GAME, (gameID) => {
        console.log('✨ [JOIN_GAME] Received', gameID);
        let game = games.find((g) => g.identifier === gameID);
        if (game) {
            let success = game.addPlayer(playerID);
            if (success) {
                console.log(`✨ [JOIN_GAME] [Player:${playerID}] -> [Game:${game.identifier}]`);
                socket.join(game.identifier);
                _games[playerID] = game.identifier;
                sendFeedback(SocketEvent.JOIN_GAME_FEEDBACK, game, true);
            } else {
                sendPrivateFeedback(
                    SocketEvent.JOIN_GAME_FEEDBACK,
                    playerID,
                    false,
                    'Game is already started',
                );
            }
        } else {
            sendPrivateFeedback(
                SocketEvent.JOIN_GAME_FEEDBACK,
                playerID,
                false,
                'Game not found',
            );
        }
    });

    // Quick match
    socket.on(SocketEvent.QUICK_MATCH, () => {
        // Join an existing game that is not started yet
        // If none, create a new game
    });

    socket.on(SocketEvent.START_GAME, () => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(`✨ [START_GAME] [Game:${game.identifier}]`, game.players);

            // Find player
            let player = game.findPlayer(playerID);

            // Run
            if (game && player) {
                let started = game.start();
                if (started) {
                    sendFeedback(SocketEvent.START_GAME_FEEDBACK, game, true);
                } else {
                    sendFeedback(
                        SocketEvent.START_GAME_FEEDBACK,
                        game,
                        false,
                        'Failed to start game',
                    );
                }
            }
        }
    });

    socket.on(SocketEvent.SELECT_COORDINATE, (coordinate: Coordinate) => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(`✨ [START_GAME] [Game:${game.identifier}]`, coordinate);

            // Find player
            let player = game.findPlayer(playerID);

            // Run
            if (game && player && coordinate) {
                let selected = game.playerDidSelectCoordinate(
                    player,
                    coordinate,
                );
                if (selected) {
                    sendFeedback(
                        SocketEvent.SELECT_COORDINATE_FEEDBACK,
                        game,
                        true,
                    );
                } else {
                    sendPrivateFeedback(
                        SocketEvent.SELECT_COORDINATE_FEEDBACK,
                        playerID,
                        false,
                        'Failed to select coordinate',
                    );
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
        let didSet = game.setNumberOfBombs(amount);

        if (didSet) {
            sendFeedback(SocketEvent.SET_NUMBER_OF_BOMB_FEEDBACK, game, true);
        } else {
            game.emitEvent(SocketEvent.SET_NUMBER_OF_BOMB_FEEDBACK, {
                isOK: false,
                data: game.data,
                message: 'Error setting number of bombs',
            });
        }
    });

    socket.on(SocketEvent.PAUSE, () => {
        console.log('The game will be pause');

        // Find game
        let game = findGame(playerID);

        // Pause the game
        let isPause: boolean = game.playerDidSelectPause();

        if (isPause) {
            game.emitEvent(SocketEvent.PAUSE_FEEDBACK, {
                isOk: true,
                data: game.data,
                message: 'The game is paused',
            });
        } else {
            game.emitEvent(SocketEvent.PAUSE_FEEDBACK, {
                isOk: false,
                data: game.data,
                message: 'Error pausing the game',
            });
        }
    });

    socket.on(SocketEvent.SET_BOARD_SIZE, (w: number, h: number) => {
        // Find game
        let game = findGame(playerID);

        // Set board size
        let didSet = game.setBoardSize(w, h);

        if (didSet) {
            game.emitEvent(SocketEvent.SET_BOARD_SIZE_FEEDBACK, {
                isOk: true,
                data: game.data,
                message: 'The board size is now w: ' + w + ' and h: ' + h,
            });
        } else {
            game.emitEvent(SocketEvent.SET_BOARD_SIZE_FEEDBACK, {
                isOk: false,
                data: game.data,
                message: 'Failed to set board size',
            });
        }
    });

    socket.on(SocketEvent.SET_MAX_PLAYER, (amount: number) => {
        // Find game
        let game = findGame(playerID);

        // Set max player
        let didSet = game.setMaxPlayers(amount);

        if (didSet) {
            game.emitEvent(SocketEvent.SET_MAX_PLAYER_FEEDBACK, {
                isOk: true,
                data: game.data,
                message: 'Max player is now ' + amount,
            });
        } else {
            game.emitEvent(SocketEvent.SET_MAX_PLAYER_FEEDBACK, {
                isOk: false,
                data: game.data,
                message: 'Failed to set max player',
            });
        }
    });

    // To show other player whose turn is it
    socket.on(SocketEvent.GET_CURRENT_PLAYER, () => {
        // Find game
        let game = findGame(playerID);

        let result = game.getCurrentPlayer();

        if (result) {
            game.emitEvent(SocketEvent.GET_CURRENT_PLAYER_FEEDBACK, {
                isOk: true,
                data: game.data,
                message: 'Success',
            });
        } else {
            game.emitEvent(SocketEvent.GET_CURRENT_PLAYER_FEEDBACK, {
                isOk: false,
                data: game.data,
                message: 'Failed',
            });
        }
    });
});
