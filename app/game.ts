import { Socket } from 'socket.io';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';
import { GameState, IGame } from './types/game.interface';
import { Player } from './types/player.interface';

function Timer(fn, t) {
    var timer = setInterval(fn, t);

    this.stop = function () {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        return this;
    };

    // Start timer using current configurations
    this.start = function () {
        if (!timer) {
            this.stop();
            timer = setInterval(fn, t);
        }
        return this;
    };

    // Start with new or original configuration, stop current interval
    this.reset = function (newT = t) {
        t = newT;
        return this.stop().start();
    };
}

export class Game implements IGame {
    socket: Socket;

    timer = null;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    startTimer(): void {
        this.timer = new Timer(() => {
            this.tick();
        }, this.waitTime * 1000);
    }

    waitTime: number = 10;

    isPublic = true;
    isLocked = false;

    emitEvent(event: SocketEvent, data: any) {
        this.socket.to(this.identifier).emit(event, data);
    }

    identifier = this.generateGameID();
    coordinates = [];
    players = [];
    currentPlayer = null;
    currentState = GameState.NOT_STARTED;

    currentTime = 0;
    numberOfBombs = 3;
    numberOfPlayers = 2;
    scoreMultiplier = 1;
    shouldSkipTick = false;

    generateGameID(): string {
        throw new Error('Method not implemented.');
    }

    populateBoard(n: number): void;

    populateBoard(w: number, h: number): void;

    populateBoard(w: any, h?: any) {
        throw new Error('Method not implemented.');
    }

    resetBoard(): boolean {
        throw new Error('Method not implemented.');
    }

    selectFirstPlayer(): Player {
        throw new Error('Method not implemented.');
    }

    start(): boolean {
        throw new Error('Method not implemented.');
    }

    lock(): void {
        throw new Error('Method not implemented.');
    }

    unlock(): void {
        throw new Error('Method not implemented.');
    }

    selectNextPlayer(): Player {
        throw new Error('Method not implemented.');
    }

    isWinningConditionSatisfied(): Player {
        throw new Error('Method not implemented.');
    }

    resetTimer(): boolean {
        throw new Error('Method not implemented.');
    }

    tick(): void {
        throw new Error('Method not implemented.');
    }

    finish(): boolean {
        throw new Error('Method not implemented.');
    }

    setNumberOfBombs(n: number): boolean {
        throw new Error('Method not implemented.');
    }

    setMaxPlayers(n: number): boolean {
        throw new Error('Method not implemented.');
    }

    playerDidConnect(p: Player): boolean {
        throw new Error('Method not implemented.');
    }

    playerDidDisconnect(p: Player): void {
        throw new Error('Method not implemented.');
    }

    playerDidSelectCoordinate(p: Player, c: Coordinate): boolean {
        throw new Error('Method not implemented.');
    }

    get isNotStarted(): boolean {
        return this.currentState === GameState.NOT_STARTED;
    }

    get isReady(): boolean {
        return this.currentState === GameState.READY;
    }

    get isOngoing(): boolean {
        return this.currentState === GameState.ONGOING;
    }

    get isFinished(): boolean {
        return this.currentState === GameState.FINISHED;
    }
}
