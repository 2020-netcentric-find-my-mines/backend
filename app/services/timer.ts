export function Timer(fn: Function, t: number) {
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