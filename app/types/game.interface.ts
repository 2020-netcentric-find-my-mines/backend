import { Server } from 'socket.io';
import { SocketEvent } from '../socket-event';
import { Coordinate } from './coordinate.interface';
import { Player } from './player.interface';

export enum GameState {
    NOT_STARTED = 'NOT_STARTED',
    READY = 'READY',
    ONGOING = 'ONGOING',
    PAUSED = 'PAUSED',
    FINISHED = 'FINISHED',
    EMPTY = 'EMPTY', // No players in game, ready to be deleted
}

export interface IGame {
    server: Server;

    identifier: string; // Game's identifier (Same as Socket.IO's room)
    coordinates: Coordinate[]; // All coordiantes
    selectedCoordinates: Coordinate[]; //All selected coordinates
    players: Player[]; // All players
    currentPlayer: Player | null; // Current player
    currentState: GameState; // Current game's state

    waitTime: number; // Time per round (sec.) (Default: 10)
    timer: (fn: Function, t: number) => void | null; // Timer
    startTimer(): void;

    boardWidth: number; //Width of the game board (Default: 6)
    boardHeight: number; //Height of the game board (Default: 6)
    numberOfBombs: number; // Number of bombs
    maxNumberOfPlayers: number; //Maximum number of players that can play the game
    numberOfBombsFound: number; // Number of bombs found
    scoreMultiplier: number; // Score multiplier (Default: 1)

    generateGameID(): string; // Create random string

    populateBoard(n: number): void; // Create a square game board

    // Create a game board with width `i` and height `j`
    // Populate `coordinates` with given `numberOfBombs`
    populateBoard(w: number, h: number): void;

    // Reset
    resetBoard(): boolean;

    // Randomly pick a player from `players`
    selectFirstPlayer(): void;

    // Start
    start(): boolean;

    // Play again (not reset), can only be called if game is finished
    playAgain(): boolean;

    // Pick next player
    selectNextPlayer(): void;

    // Return the winner or current winner of the game
    getWinner(): Player;

    // Return the current player that needs to play the turn
    getCurrentPlayer(): Player;

    // Return object Player if player is in the game; otherwise, return null
    findPlayer(playerID: string): Player;

    //
    resetTimer(): boolean;

    // This function will be executed every 1 sec.
    tick(): void;

    // Actions to perform after finish game
    finish(): boolean;

    // Game configurations
    setNumberOfBombs(n: number): boolean;
    setMaxPlayers(n: number): boolean;
    setBoardSize(w: number, h: number): boolean;

    // Player events
    playerDidConnect(p: Player): boolean;
    playerDidDisconnect(p: Player): GameState;
    playerDidSelectCoordinate(p: Player, x: number, y: number): boolean; //Also check if game is finished after each move
    playerDidSelectPause(): boolean;

    // Game states
    readonly isNotStarted: boolean;
    readonly isReady: boolean;
    readonly isOngoing: boolean;
    readonly isFinished: boolean;
    readonly isPaused: boolean;
    readonly isEmpty: boolean;

    isPublic: boolean;

    // Skip tick() one time
    shouldSkipTick: boolean;
}
