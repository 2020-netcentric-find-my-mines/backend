import { Player } from '../types/player.interface';

export function createPlayer(playerID: string, name = ''): Player {
    const player: Player = {
        id: playerID,
        name: name,
        score: 0,
        type: 'player',
    };
    return player;
}

export function createSpectator(playerID: string, name = ''): Player {
    const player: Player = {
        id: playerID,
        name: name,
        score: 0,
        type: 'spectator',
    };
    return player;
}