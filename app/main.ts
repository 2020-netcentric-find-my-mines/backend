import axios from 'axios';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { Socket } from 'socket.io';
import { Game } from './game';
import { emitPublicEvent } from './services/emitEvent';
import { SocketEvent } from './socket-event';
import { GameState } from './types/game.interface';

let app = express()
    .use(cors())
    .use(express.static(path.join(__dirname, 'frontend/dist')));

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

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
    emitPublicEvent(game.server, event, game.identifier, {
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

// Mapping PlayerID -> Name
const _players: Record<string, string> = {};

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
io.on(SocketEvent.CONNECTION, (socket: Socket) => {
    console.log('🎉 User', socket.id);
    let playerID = socket.id;

    socket.on(SocketEvent.SET_PLAYER_NAME, (name: string) => {
        _players[playerID] = name;

        // If player is currently in game
        let game = findGame(playerID);

        if (game) {
            let didSet = game.setPlayerName(playerID, name);
            if (didSet) {
                sendFeedback(SocketEvent.SET_PLAYER_NAME_FEEDBACK, game, true);
            } else {
                sendPrivateFeedback(
                    SocketEvent.SET_PLAYER_NAME_FEEDBACK,
                    playerID,
                    false,
                    'Failed to set player name',
                );
            }
        } else {
            sendPrivateFeedback(
                SocketEvent.SET_PLAYER_NAME_FEEDBACK,
                playerID,
                true,
            );
        }
    });

    // Create a new game
    socket.on(SocketEvent.CREATE_GAME, () => {
        let game = new Game(io);
        game.addPlayer(playerID, _players[playerID] ?? null);
        games.push(game);
        _games[playerID] = game.identifier;
        socket.join(game.identifier);

        sendFeedback(SocketEvent.CREATE_GAME_FEEDBACK, game, true);
        console.log(
            `✨ [CREATE_GAME] [Player:${playerID}] -> [Game:${game.identifier}]`,
        );
    });

    // Join an existing game
    socket.on(SocketEvent.JOIN_GAME, (gameID) => {
        console.log('✨ [JOIN_GAME] Received', gameID);
        let game = games.find((g) => g.identifier === gameID);
        if (game) {
            let success;
            if (!game.isPlayersFull())
                success = game.addPlayer(playerID, _players[playerID] ?? null);
            else
                success = game.addSpectator(
                    playerID,
                    _players[playerID] ?? null,
                );
            if (success) {
                console.log(
                    `✨ [JOIN_GAME] [Player:${playerID}] -> [Game:${game.identifier}]`,
                );
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
        let game = __games.find((g) => g.isNotStarted);

        // Game found
        if (game) {
            let success = game.addPlayer(playerID, _players[playerID] ?? null);
            if (success) {
                // Joined
                console.log(
                    `✨ [QUICK_MATCH] [Player:${playerID}] -> [Game:${game.identifier}]`,
                );
                socket.join(game.identifier);
                _games[playerID] = game.identifier;
                sendFeedback(SocketEvent.QUICK_MATCH_FEEDBACK, game, true);
            }
        } else {
            sendPrivateFeedback(
                SocketEvent.QUICK_MATCH_FEEDBACK,
                playerID,
                false,
                'Game not found',
            );
        }
    });

    socket.on(SocketEvent.START_GAME, () => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(
                `✨ [START_GAME] [Game:${game.identifier}]`,
                game.players,
            );

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

    socket.on(SocketEvent.PLAY_AGAIN, () => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(
                `✨ [PLAY_AGAIN] [Game:${game.identifier}]`,
                game.players,
            );

            let didReset = game.playAgain();
            let notEnoughPlayer = game.isNotStarted;

            //Run
            if (didReset && notEnoughPlayer) {
                sendFeedback(
                    SocketEvent.PLAY_AGAIN_FEEDBACK,
                    game,
                    true,
                    'Board reset but not enough players to begin game',
                );
            } else if (didReset) {
                sendFeedback(
                    SocketEvent.SET_NUMBER_OF_BOMB_FEEDBACK,
                    game,
                    true,
                );
            } else {
                sendFeedback(
                    SocketEvent.SET_NUMBER_OF_BOMB_FEEDBACK,
                    game,
                    false,
                    'Fail to play again',
                );
            }
        }
    });

    socket.on(SocketEvent.RESET_BOARD, (hasWinner: boolean = false) => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(
                `✨ [RESET_BOARD] [Game:${game.identifier}]`,
                game.players,
            );

            let didReset = game.resetBoard(hasWinner);
            let notEnoughPlayer = game.isNotStarted;

            //Run
            if (didReset && notEnoughPlayer) {
                sendFeedback(
                    SocketEvent.RESET_BOARD_FEEDBACK,
                    game,
                    true,
                    'Board reset but not enough players to begin game',
                );
            } else if (didReset) {
                sendFeedback(SocketEvent.RESET_BOARD_FEEDBACK, game, true);
            } else {
                sendFeedback(
                    SocketEvent.RESET_BOARD_FEEDBACK,
                    game,
                    false,
                    'Fail to reset board',
                );
            }
        }
    });

    socket.on(SocketEvent.SELECT_COORDINATE, ({ x, y }) => {
        // Find game
        let game = findGame(playerID);

        if (game) {
            console.log(
                `✨ [SELECT_COORDINATE] [Game:${game.identifier}]`,
                x,
                y,
            );

            // Find player
            let player = game.findPlayer(playerID);

            // Run
            if (game && player && x !== null && y !== null) {
                let selected = game.playerDidSelectCoordinate(player, x, y);
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
        const game = findGame(playerID);

        if (game) {
            // Find player
            const player = game.findPlayer(playerID);

            // Run
            const currentGameState = game.removeMember(player);
            delete _games[playerID];
            if (currentGameState == GameState.EMPTY) {
                games.splice(games.indexOf(game), 1);
                axios.get(
                    'https://asia-southeast2-findmymines.cloudfunctions.net/deleteGameChat',
                    { params: { gameId: game.identifier } },
                );
            }
        }
    });

    socket.on(SocketEvent.LEAVE_GAME, () => {
        console.log('Disconnect user from game', socket.id);

        // Find game
        const game = findGame(playerID);

        if (game) {
            // Find player
            const player = game.findPlayer(playerID);

            // Run
            const currentGameState = game.removeMember(player);
            delete _games[playerID];
            socket.leave(game.identifier);
            if (currentGameState == GameState.EMPTY) {
                games.splice(games.indexOf(game), 1);
                axios.get(
                    'https://asia-southeast2-findmymines.cloudfunctions.net/deleteGameChat',
                    { params: { gameId: game.identifier } },
                );
            }
            sendPrivateFeedback(
                SocketEvent.LEAVE_GAME_FEEDBACK,
                playerID,
                true,
                'Sucessfully left game.',
            );
        } else
            sendPrivateFeedback(
                SocketEvent.LEAVE_GAME_FEEDBACK,
                playerID,
                false,
                'Cannot find game.',
            );
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
            sendFeedback(
                SocketEvent.SET_NUMBER_OF_BOMB_FEEDBACK,
                game,
                false,
                'Fail to set number of bombs',
            );
        }
    });

    socket.on(SocketEvent.PAUSE, () => {
        console.log('The game will be pause');

        // Find game
        let game = findGame(playerID);

        // Pause the game
        let isPause: boolean = game.playerDidSelectPause();

        if (isPause) {
            sendFeedback(
                SocketEvent.PAUSE_FEEDBACK,
                game,
                true,
                'The game is paused',
            );
        } else {
            sendFeedback(
                SocketEvent.PAUSE_FEEDBACK,
                game,
                false,
                'Failed to pause the game',
            );
        }
    });

    socket.on(SocketEvent.CHANGE_PLAYER_TYPE, () => {
        // Find game
        const game = findGame(playerID);

        if (game) {
            const player = game.findPlayer(playerID);

            if (player) {
                const doesChanged = game.memberDidChangeType(player);
                if (doesChanged)
                    sendFeedback(
                        SocketEvent.CHANGE_PLAYER_TYPE_FEEDBACK,
                        game,
                        true,
                        'Player type has been changed.',
                    );
                else
                    sendPrivateFeedback(
                        SocketEvent.CHANGE_PLAYER_TYPE_FEEDBACK,
                        playerID,
                        false,
                        'Failed to change player type.',
                    );
            }
        }
    });

    socket.on(SocketEvent.SET_BOARD_SIZE, (w: number, h: number) => {
        // Find game
        let game = findGame(playerID);

        // Set board size
        let didSet = game.setBoardSize(w, h);

        if (didSet) {
            sendFeedback(
                SocketEvent.SET_BOARD_SIZE_FEEDBACK,
                game,
                true,
                'The board size is now w: ' + w + ' and h: ' + h,
            );
        } else {
            sendFeedback(
                SocketEvent.SET_BOARD_SIZE_FEEDBACK,
                game,
                false,
                'Failed to set board size',
            );
        }
    });

    socket.on(SocketEvent.SET_MAX_PLAYER, (amount: number) => {
        // Find game
        let game = findGame(playerID);

        // Set max player
        let didSet = game.setMaxPlayers(amount);

        if (didSet) {
            sendFeedback(
                SocketEvent.SET_MAX_PLAYER_FEEDBACK,
                game,
                true,
                'Max player is now ' + amount,
            );
        } else {
            sendFeedback(
                SocketEvent.SET_MAX_PLAYER_FEEDBACK,
                game,
                false,
                'Failed to set max player',
            );
        }
    });

    // To show other player whose turn is it
    socket.on(SocketEvent.GET_CURRENT_PLAYER, () => {
        // Find game
        let game = findGame(playerID);

        let result = game.getCurrentPlayer();

        if (result) {
            sendFeedback(SocketEvent.GET_CURRENT_PLAYER_FEEDBACK, game, true);
        } else {
            sendFeedback(
                SocketEvent.GET_CURRENT_PLAYER_FEEDBACK,
                game,
                false,
                'Failed getting current player',
            );
        }
    });
});

httpServer.listen(process.env.PORT || 3001);
