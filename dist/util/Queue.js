"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const events_1 = require("events");
class Queue extends events_1.EventEmitter {
    constructor() {
        super();
        this.queue = [];
    }
    execute(first, override) {
        if (this.override && override !== this.override)
            return;
        if (!first)
            this.queue.splice(0, 1);
        const item = this.queue[0];
        if (!item)
            return;
        this.emit("execute", item);
    }
    item(item, override) {
        if (this.override && override !== this.override)
            return;
        this.queue.push(item);
        if (this.queue.length == 1)
            this.execute(true, override);
    }
}
exports.Queue = Queue;
//# sourceMappingURL=Queue.js.map