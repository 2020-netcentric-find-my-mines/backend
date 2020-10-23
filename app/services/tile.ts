import { Coordinate } from '../types/coordinate.interface';

export class Tile implements Coordinate {
    x: number;
    y: number;
    isBomb: boolean = false;
    isSelected: boolean = false;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export function createBoardTileList(width: number, height: number): Tile[] {
    const tileList: Tile[] = [];
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let tile: Coordinate = new Tile(x, y);
            tileList.push(tile);
        }
    }
    return tileList;
}

export function isValidBoard (bomb: number, width: number, height: number): boolean {
    if (bomb > width * height) return false;
    return true;
}