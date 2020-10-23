export function inclusiveRandomNum(num: number) {
    return Math.floor(Math.random() * num);
}

export function inclusiveRandomNumList(numOfElements: number, range: number): number[] {
    let numArray: number[] = [];
    while (numArray.length < numOfElements) {
        let num: number = inclusiveRandomNum(range);
        if (numArray.indexOf(num) === -1) numArray.push(num);
    }
    return numArray;
}