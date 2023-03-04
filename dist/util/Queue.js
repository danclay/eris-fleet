"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const events_1 = require("events");
/** @internal */
class Queue extends events_1.EventEmitter {
    constructor() {
        super();
        this.queue = [];
    }
    execute(first, override) {
        if (this.override && override !== this.override)
            return;
        const prevItem = first ? undefined : this.queue[0];
        if (!first)
            this.queue.splice(0, 1);
        const item = this.queue[0];
        if (!item)
            return;
        this.emit("execute", item, prevItem);
    }
    item(item, override) {
        if (this.override && override !== this.override)
            return;
        this.queue.push(item);
        if (this.queue.length === 1)
            this.execute(true, override);
    }
    bulkItems(items, override) {
        if (this.override && override !== this.override)
            return;
        const execute = this.queue.length === 0;
        this.queue = this.queue.concat(items);
        if (execute)
            this.execute(true, override);
    }
}
exports.Queue = Queue;
//# sourceMappingURL=Queue.js.map