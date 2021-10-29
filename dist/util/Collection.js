"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
/** Collection-ish */
class Collection extends Map {
    constructor(iterable) {
        super(iterable);
    }
    find(func) {
        for (const item of this.values()) {
            if (func(item)) {
                return item;
            }
        }
        return undefined;
    }
}
exports.Collection = Collection;
//# sourceMappingURL=Collection.js.map