import { Socket } from 'socket.io';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';
import { GameState, IGame } from './types/game.interface';
import { Player } from './types/player.interface';

function Timer(fn: Function, t: number) {
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

    // Start with new or original configurations
    // Stop current interval
    this.reset = function (newT = t) {
        t = newT;
        return this.stop().start();
    };
}

class Box implements Coordinate {
    x: number;
    y: number;
    isBomb: boolean = false;
    isSelected: boolean = false;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export class Game implements IGame {
    socket: Socket;

    timer: any = null;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    startTimer(): void {
        this.currentTime = this.waitTime;
        // @ts-ignore
        this.timer = new Timer(() => {
            this.tick();
        }, 1000);
    }

    waitTime: number = 10;

    isPublic = true;
    isLocked = false;

    emitEvent(event: SocketEvent, data: any) {
        this.socket.to(this.identifier).emit(event, data);
    }

    identifier = this.generateGameID();
    coordinates: Coordinate[] = [];
    players: Player[] = [];
    currentPlayer: Player = null;
    currentState = GameState.NOT_STARTED;
    private currentPlayerIndex: number = null;

    boardWidth = 6;
    boardHeight = 6;
    currentTime = -1;
    numberOfBombs = 3;
    numberOfBombsFound = 0;
    numberOfPlayers = 2;
    maxNumberOfPlayers = 2;
    scoreMultiplier = 1;
    shouldSkipTick = false;

    private changeGameState(to: GameState): void {
        let fromState = this.currentState;
        this.currentState = to;
        this.emitEvent(SocketEvent.CHANGED_GAMESTATE, {
            from: fromState,
            to: to,
        });
    }

    generateGameID(): string {
        let result: string = '';
        let charac = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        // Generate random string of 7 characters
        for (let i = 0; i < 7; i++) {
            result += charac.charAt(Math.floor(Math.random() * charac.length));
        }
        return result;
    }

    populateBoard(n: number): void;

    populateBoard(w: number, h: number): void;

    populateBoard(w: any, h?: any) {
        if (h == -1) h = w;
        //Add all coordinates
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                let tile: Coordinate = new Box(x, y);
                this.coordinates.push(tile);
            }
        }
        //Find and set bomb tiles
        let tempArr: number[] = [];
        while (tempArr.length < this.numberOfBombs) {
            let n: number = Math.floor(Math.random() * w * h);
            if (tempArr.indexOf(n) === -1) tempArr.push(n);
        }
        for (let i of tempArr) {
            this.coordinates[i].isBomb = true;
        }
    }

    resetBoard(): boolean {
        if (!this.isOngoing || !this.isPaused || !this.isFinished) return false;
        for (let p of this.players) {
            p.score = 0;
        }
        this.populateBoard(this.boardWidth, this.boardHeight);

        // Deal with special case where we finished game
        // and want to reset but not have enough players to play
        if (this.isFinished && this.players.length <= 1) {
            this.changeGameState(GameState.NOT_STARTED);
            return true;
        }
        this.currentPlayer = this.selectFirstPlayer();
        this.changeGameState(GameState.ONGOING);
        this.resetTimer();
        return true;
    }

    selectFirstPlayer(): Player {
        let n: number = Math.floor(Math.random() * this.players.length);
        this.currentPlayerIndex = n;
        let p: Player = this.players[this.currentPlayerIndex];
        this.emitEvent(SocketEvent.NEXT_PLAYER, p);
        return p;
    }

    start(): boolean {
        if (this.players.length <= 1 || !this.isReady || !this.isNotStarted)
            return false;
        this.populateBoard(this.boardWidth, this.boardHeight);
        this.currentPlayer = this.selectFirstPlayer();
        this.changeGameState(GameState.ONGOING);
        this.start();
        return true;
    }

    selectNextPlayer(): Player {
        this.currentPlayerIndex =
            ++this.currentPlayerIndex % this.players.length;
        let p: Player = this.players[this.currentPlayerIndex];
        this.emitEvent(SocketEvent.NEXT_PLAYER, p);
        return p;
    }

    getWinner(): Player {
        let winner: Player = this.players[0];
        for (let i = 1; i < this.players.length; i++) {
            if (this.players[i].score > winner.score) winner = this.players[i];
        }
        return winner;
    }

    private hasAllBombsFound(): boolean {
        if (this.numberOfBombs === this.numberOfBombsFound) return true;
        return false;
    }

    // In case we want to notify who needs to play right now
    getCurrentPlayer(): Player {
        return this.currentPlayer;
    }

    resetTimer(): boolean {
        if (!this.isOngoing || !this.isPaused || !this.isFinished) return false;
        this.currentTime = this.waitTime;
        this.emitEvent(SocketEvent.TICK, this.currentTime);
        this.timer.reset(1000);
        return true;
    }

    tick(): void {
        this.currentTime = this.currentTime - 1;
        this.emitEvent(SocketEvent.TICK, this.currentTime);
        // Go to the next person if the person does not choose tile in time
        if (this.currentTime === 0) {
            this.nextTurn();
        }
    }

    finish(): boolean {
        // Will be called only from playerDidSelectCoordinate
        this.timer.stop();
        this.changeGameState(GameState.FINISHED);
        let winner: Player = this.getWinner();
        this.emitEvent(SocketEvent.WINNER, winner);
        /* Do some action in the future


        */
        return true;
    }

    setNumberOfBombs(n: number): boolean {
        if (
            n > 0 &&
            n % 2 == 1 &&
            this.isValidBoard(n, this.boardWidth, this.boardHeight) &&
            (this.isNotStarted || this.isReady)
        ) {
            this.numberOfBombs = n;
            return true;
        }
        return false;
    }

    setMaxPlayers(n: number): boolean {
        if (
            n > 1 &&
            n >= this.players.length &&
            (this.isNotStarted || this.isReady)
        ) {
            this.maxNumberOfPlayers = n;
            if (this.isRoomFull) this.changeGameState(GameState.READY);
            else this.changeGameState(GameState.NOT_STARTED);
            return true;
        }
        return false;
    }

    private isRoomFull(): boolean {
        if (this.players.length == this.maxNumberOfPlayers) return true;
        return false;
    }

    setBoardSize(w: number, h: number): boolean {
        if (
            w > 0 &&
            h > 0 &&
            this.isValidBoard(this.numberOfBombs, w, h) &&
            (this.isNotStarted || this.isReady)
        ) {
            this.boardWidth = w;
            this.boardHeight = h;
            return true;
        }
        return false;
    }

    private isValidBoard(bomb: number, width: number, height: number): boolean {
        if (bomb > width * height) return false;
        return true;
    }

    playerDidConnect(p: Player): boolean {
        if (
            p != null &&
            (this.isNotStarted || this.isFinished) &&
            this.players.length < this.maxNumberOfPlayers
        ) {
            p.score = 0;
            this.players.push(p);
            if (this.isRoomFull) this.changeGameState(GameState.READY);
            return true;
        }
        return false;
    }

    //Can continue playing unless only one player is left
    playerDidDisconnect(p: Player): void {
        //Implement to destroy game in the future
        if (this.players.length == 1) {
            this.changeGameState(GameState.EMPTY);
            this.players = [];
            return;
        }
        if (this.isReady) {
            this.changeGameState(GameState.NOT_STARTED);
        } else if (this.isOngoing || this.isPaused) {
            if (this.currentPlayer == p) {
                this.nextTurn();
            }
            if (this.isPaused) {
                this.timer.stop();
            }
            this.players.splice(this.players.indexOf(p), 1);
            if (this.players.length == 1) {
                this.finish();
            }
            return;
        }
        this.players.splice(this.players.indexOf(p), 1); // Will perform only for isReady, isNotStarted, isFinished
    }

    playerDidSelectCoordinate(p: Player, c: Coordinate): boolean {
        if (p == null || c == null || c.isSelected == true || !this.isOngoing) {
            this.emitEvent(SocketEvent.COORDINATED_SELECTED, {
                isOK: false,
                coordinate: c,
                player: p,
            });
            return false;
        }
        c.isSelected = true;
        this.emitEvent(SocketEvent.COORDINATED_SELECTED, {
            isOK: true,
            coordinate: c,
            player: p,
        });
        if (c.isBomb) {
            this.currentPlayer.score += 1;
            this.numberOfBombsFound += 1;
            if (this.hasAllBombsFound) return this.finish();
        }
        this.nextTurn();
        return true;
    }

    private nextTurn(): Player {
        let p: Player = this.selectNextPlayer();
        this.currentPlayer = p;
        this.resetTimer();
        return p;
    }

    playerDidSelectPause(): boolean {
        if (!this.isOngoing || !this.isPaused) return false;
        if (this.isOngoing) {
            this.changeGameState(GameState.PAUSED);
            this.timer.stop();
        } else {
            this.changeGameState(GameState.ONGOING);
            this.timer.start();
        }
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

    get isPaused(): boolean {
        return this.currentState === GameState.PAUSED;
    }

    get isEmpty(): boolean {
        return this.currentState === GameState.EMPTY;
    }
}
