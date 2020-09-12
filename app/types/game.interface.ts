import { Socket } from 'socket.io';
import { SocketEvent } from '../socket-event';
import { Coordinate } from './coordinate.interface';
import { Player } from './player.interface';

export enum GameState {
    NOT_STARTED = 'NOT_STARTED',
    READY = 'READY',
    ONGOING = 'ONGOING',
    PAUSED = 'PAUSED',
    FINISHED = 'FINISHED',
}

export interface IGame {
    emitEvent(event: SocketEvent, data: any);
    socket: Socket;

    identifier: string; // Game's identifier (Same as Socket.IO's room)
    coordinates: Coordinate[]; // All coordiantes
    players: Player[]; // All players
    currentPlayer: Player | null; // Current player
    currentState: GameState; // Current game's state

    waitTime: number; // Time per round (sec.) (Default: 10)
    timer: any; // Timer
    startTimer(): void;

    numberOfBombs: number; // Number of bombs
    numberOfPlayers: number; // Number of players
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

    // Pick next player
    selectNextPlayer(): void;

    // Check if winning condition is satisfied
    // Return the winner if satisfied, else return `null`
    isWinningConditionSatisfied(): Player | null;

    //
    resetTimer(): boolean;

    // This function will be executed every 1 sec.
    tick(): void;

    // Finish
    finish(): boolean;

    // Game configurations
    setNumberOfBombs(n: number): boolean;
    setMaxPlayers(n: number): boolean;

    // Player events
    playerDidConnect(p: Player): boolean;
    playerDidDisconnect(p: Player): void;
    playerDidSelectCoordinate(p: Player, c: Coordinate): boolean;

    // Game states
    readonly isNotStarted: boolean;
    readonly isReady: boolean;
    readonly isOngoing: boolean;
    readonly isFinished: boolean;
    readonly isPaused: boolean;

    isPublic: boolean;

    // Skip tick() one time
    shouldSkipTick: boolean;
}
