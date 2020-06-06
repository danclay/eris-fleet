"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseClusterWorker = void 0;
const IPC_1 = require("../util/IPC");
class BaseClusterWorker {
    constructor(setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = new IPC_1.IPC();
    }
}
exports.BaseClusterWorker = BaseClusterWorker;
//# sourceMappingURL=BaseClusterWorker.js.map