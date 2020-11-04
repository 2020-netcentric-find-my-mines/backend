import { Server } from 'socket.io';
import { SocketEvent } from './socket-event';
import { Coordinate } from './types/coordinate.interface';
import { GameState, IGame } from './types/game.interface';
import { Player } from './types/player.interface';
import chalk from 'chalk';
import { Tile, createBoardTileList, isValidBoard } from './services/tile';
import { Timer } from './services/timer';
import { emitPublicEvent, emitPrivateEvent } from './services/emitEvent';
import { inclusiveRandomNum, inclusiveRandomNumList } from './services/random';
import { createPlayer, createSpectator } from './services/player';

export class Game implements IGame {
    server: Server;

    timer: any = null;

    constructor(server: Server) {
        this.server = server;
    }

    startTimer(): void {
        this.currentTime = this.waitTime;
        // @ts-ignore
        this.timer = new Timer(() => {
            if (!this.shouldSkipTick) {
                this.tick();
            } else {
                this.shouldSkipTick = false;
            }
        }, 1000);
    }

    waitTime: number = 10;

    isPublic = true;
    isLocked = false;

    identifier = this.generateGameID();
    coordinates: Coordinate[] = [];
    selectedCoordinates: Coordinate[] = [];
    players: Player[] = [];
    spectators: Player[] = [];
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
        emitPublicEvent(this.server, SocketEvent.GAME_STATE_CHANGED, {
            from: fromState,
            to: to,
        });
    }

    addPlayer(playerID: string, name = ''): boolean {
        if (this.findPlayer(playerID)) return false;
        const player = createPlayer(playerID, name);
        return this.playerDidConnect(player);
    }

    addSpectator(playerID: string, name = ''): boolean {
        if (this.findPlayer(playerID)) return false;
        const spectator = createSpectator(playerID, name);
        return this.spectatorDidConnect(spectator);
    }

    removeMember(member: Player): GameState {
        if (member.type === 'player') return this.playerDidDisconnect(member);
        return this.spectatorDidDisconnect(member);
    }

    generateGameID(): string {
        let result: string = '';
        let charac = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        // Generate random string of 7 characters
        for (let i = 0; i < 7; i++) {
            result += charac.charAt(inclusiveRandomNum(charac.length));
        }
        return result;
    }

    populateBoard(n: number): void;

    populateBoard(w: number, h: number): void;

    populateBoard(w: number, h?: number) {
        if (!h) h = w;
        this.clearBoard();
        // Add all coordinates
        this.coordinates = createBoardTileList(w, h);
        // Find and set bomb tiles
        const tempArr: number[] = inclusiveRandomNumList(
            this.numberOfBombs,
            w * h,
        );
        for (let index of tempArr) {
            this.coordinates[index].isBomb = true;
        }
    }

    private clearBoard(): void {
        this.coordinates = [];
        this.selectedCoordinates = [];
    }

    resetBoard(): boolean {
        //Can only reset board if the game is ongoing / paused / finished
        if (!this.isOngoing && !this.isPaused && !this.isFinished) return false;
        for (let player of this.players) {
            player.score = 0;
        }
        // Deal with special case where we finished game
        // and want to reset but not have enough players to play
        if (this.isFinished && this.players.length <= 1) {
            this.changeGameState(GameState.NOT_STARTED);
            this.clearBoard();
            this.currentPlayer = null;
            return true;
        }
        this.populateBoard(this.boardWidth, this.boardHeight);
        this.currentPlayer = this.selectFirstPlayer();
        this.changeGameState(GameState.ONGOING);
        this.resetTimer();
        return true;
    }

    selectFirstPlayer(): Player {
        let firstPlayerIndex: number = inclusiveRandomNum(this.players.length);
        this.currentPlayerIndex = firstPlayerIndex;
        let firstPlayer: Player = this.players[firstPlayerIndex];
        emitPublicEvent(this.server, SocketEvent.NEXT_PLAYER, firstPlayer);
        return firstPlayer;
    }

    log(...args: any[]): void {
        console.log(
            chalk.bgGreen(chalk.black(`game.ts/${this.identifier}`)),
            ...args,
        );
    }

    start(): boolean {
        // Cannot start game if:
        // - Number of players is less than 2
        // - Game is not in READY state
        if (this.players.length <= 1 || (!this.isReady && !this.isNotStarted))
            return false;
        this.populateBoard(this.boardWidth, this.boardHeight);
        this.currentPlayer = this.selectFirstPlayer();
        this.changeGameState(GameState.ONGOING);
        this.startTimer();
        return true;
    }

    playAgain(): boolean {
        //Run only if game is finished
        if (!this.isFinished) return false;
        let winner: Player = this.getWinner();
        this.currentPlayer = winner;
        for (let player of this.players) {
            player.score = 0;
        }
        // Deal with special case where we finished game
        // and want to reset but not have enough players to play
        if (this.players.length == 1) {
            this.changeGameState(GameState.NOT_STARTED);
            this.clearBoard();
            this.currentPlayer = null;
            return true;
        }
        this.populateBoard(this.boardWidth, this.boardHeight);
        this.changeGameState(GameState.ONGOING);
        this.resetTimer();
        return true;
    }

    selectNextPlayer(): Player {
        this.currentPlayerIndex =
            ++this.currentPlayerIndex % this.players.length;
        return this.players[this.currentPlayerIndex];
    }

    setPlayerName(playerID: string, name: string): boolean {
        const player = this.findPlayer(playerID);
        if (player) {
            player.name = name;
            return true;
        }
        return false;
    }

    getWinner(): Player {
        let winner: Player = this.players[0];
        for (let i = 1; i < this.players.length; i++) {
            if (this.players[i].score > winner.score) winner = this.players[i];
        }
        return winner;
    }

    // In case we want to notify who needs to play right now
    getCurrentPlayer(): Player {
        return this.currentPlayer;
    }

    findPlayer(playerID: string): Player {
        let player: Player = this.players.find((p) => p.id === playerID);
        if (!player) player = this.spectators.find((p) => p.id === playerID);
        if (player) return player;
        return null;
    }

    getTotalMembers(): number {
        return this.players.length + this.spectators.length;
    }

    resetTimer(): boolean {
        //Cannot reset if match is ongoing
        if (!this.isOngoing) return false;
        this.currentTime = this.waitTime;
        emitPublicEvent(this.server, SocketEvent.TICK, this.currentTime);
        this.timer.reset(1000);
        return true;
    }

    tick(): void {
        this.currentTime = this.currentTime - 1;
        emitPublicEvent(this.server, SocketEvent.TICK, this.currentTime);
        // Go to the next person if the person does not choose tile in time
        if (this.currentTime === 0) {
            // When `currentTime` = 0, change player
            this.nextTurn();
        }
    }

    finish(): boolean {
        // Will be called only from playerDidSelectCoordinate
        this.timer.stop();
        this.changeGameState(GameState.FINISHED);
        let winner: Player = this.getWinner();
        emitPublicEvent(this.server, SocketEvent.WINNER, winner);
        /* Do some action in the future

        */
        return true;
    }

    setNumberOfBombs(num: number): boolean {
        //Num. of bombs must be less than total tiles in game board and cannot be divided by number of players
        //Can only set if the game is not started, is ready, or finished
        if (
            num > 0 &&
            num % this.maxNumberOfPlayers != 0 &&
            isValidBoard(num, this.boardWidth, this.boardHeight) &&
            (this.isNotStarted || this.isReady || this.isReady)
        ) {
            this.numberOfBombs = num;
            return true;
        }
        return false;
    }

    setMaxPlayers(n: number): boolean {
        //Num. of players must be more than 1 and more than the current num. of players in game
        //Can only set when game is not started or is only ready
        if (
            n > 1 &&
            n >= this.players.length &&
            (this.isNotStarted || this.isReady)
        ) {
            this.maxNumberOfPlayers = n;
            if (this.isPlayersFull) this.changeGameState(GameState.READY);
            else this.changeGameState(GameState.NOT_STARTED);
            return true;
        }
        return false;
    }

    isPlayersFull(): boolean {
        return this.players.length === this.maxNumberOfPlayers;
    }

    setBoardSize(w: number, h: number): boolean {
        //Width and height must be more than 0
        //Can only set when the game is not started, is ready, or finished
        if (
            w > 0 &&
            h > 0 &&
            isValidBoard(this.numberOfBombs, w, h) &&
            (this.isNotStarted || this.isReady || this.isFinished)
        ) {
            this.boardWidth = w;
            this.boardHeight = h;
            return true;
        }
        return false;
    }

    playerDidConnect(player: Player): boolean {
        this.log('playerDidConnect', player.id);
        //Can only connect if game is not started
        //Player can only connect if they are not already in game
        if (
            player != null &&
            (this.isNotStarted || this.isFinished) &&
            this.players.length < this.maxNumberOfPlayers
        ) {
            if (this.isFinished) this.changeGameState(GameState.NOT_STARTED);
            this.players.push(player);
            if (this.isPlayersFull) {
                this.log(
                    'playerDidConnect',
                    'Room is full, changing `currentState` to READY',
                );
                this.changeGameState(GameState.READY);
            }
            emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
            return true;
        }
        return false;
    }

    spectatorDidConnect(spectator: Player): boolean {
        if (!spectator) return false;
        this.spectators.push(spectator);
        emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
        return true;
    }

    memberDidChangeType(member: Player): boolean {
        //Can only change type if game is not ongoing or paused
        if (this.isOngoing || this.isPaused || !member) return false;
        if (member.type === 'player') {
            member.type = 'spectator';
            this.spectators.push(member);
            this.players.splice(this.players.indexOf(member), 1);
            if (this.isReady) this.changeGameState(GameState.NOT_STARTED);
        }
        else {
            if (this.isPlayersFull) return false;
            member.type = 'player';
            this.players.push(member);
            this.spectators.splice(this.players.indexOf(member), 1);
            if (this.isPlayersFull) this.changeGameState(GameState.READY);
        }
        if (this.isFinished) this.changeGameState(GameState.NOT_STARTED);
        return true;
    }

    // Can continue playing unless only one player is left
    playerDidDisconnect(player: Player): GameState {
        if (this.players.length == 1) {
            if (this.getTotalMembers() === 1)
                this.changeGameState(GameState.EMPTY);
            this.players = [];
            emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
            return this.currentState;
        }
        if (this.isReady) {
            this.changeGameState(GameState.NOT_STARTED);
        } else if (this.isOngoing || this.isPaused) {
            if (this.currentPlayer == player) {
                this.nextTurn();
            }
            if (this.isPaused) {
                this.timer.stop();
            }
            this.players.splice(this.players.indexOf(player), 1);
            if (this.players.length == 1) {
                this.finish();
            }
            emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
            return this.currentState;
        }
        this.players.splice(this.players.indexOf(player), 1); // Will perform only for isReady, isNotStarted, isFinished
        emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
        return this.currentState;
    }

    spectatorDidDisconnect(spectator: Player): GameState {
        if (this.getTotalMembers() === 1) this.changeGameState(GameState.EMPTY);
        this.spectators.splice(this.spectators.indexOf(spectator), 1);
        emitPublicEvent(this.server, SocketEvent.NUMBER_PLAYERS_CHANGED, this.getTotalMembers());
        return this.currentState;
    }

    playerDidSelectCoordinate(player: Player, x: number, y: number): boolean {
        this.log('playerDidSelectCoordinate', player, x, y);
        //Coordinate and player must be valid
        //Can select only if game is ongoing
        if (
            player == null ||
            x < 0 ||
            y < 0 ||
            !this.isOngoing ||
            player != this.currentPlayer
        ) {
            return false;
        }
        let tile: Coordinate = this.coordinates[
            Number(x) * this.boardHeight + Number(y)
        ];
        // let c: Coordinate = this.coordinates.find(n => { return n.x === Number(x) && n.y === Number(y) })
        if (tile.isSelected) return false;
        tile.isSelected = true;
        this.selectedCoordinates.push(tile);
        if (tile.isBomb) {
            this.currentPlayer.score += 1;
            this.numberOfBombsFound += 1;
            if (this.hasAllBombsFound) return this.finish();
        }
        this.nextTurn();
        return true;
    }

    private get hasAllBombsFound(): boolean {
        if (this.numberOfBombs === this.numberOfBombsFound) return true;
        return false;
    }

    private nextTurn(): Player {
        let nextPlayer: Player = this.selectNextPlayer();
        this.currentPlayer = nextPlayer;
        emitPublicEvent(this.server, SocketEvent.NEXT_PLAYER, nextPlayer);
        this.resetTimer();
        return nextPlayer;
    }

    playerDidSelectPause(): boolean {
        //Can pause / unpause only if game is ongoing or paused
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

    // Export current state
    get data(): any {
        return {
            gameID: this.identifier,
            players: this.players,
            selectedCoordinates: this.selectedCoordinates,
            currentState: this.currentState,
            boardWidth: this.boardWidth,
            boardHeight: this.boardHeight,
            numberOfBombs: this.numberOfBombs,
            numberOfBombsFound: this.numberOfBombsFound,
        };
    }
}
