"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseServiceWorker = void 0;
const IPC_1 = require("../util/IPC");
class BaseServiceWorker {
    constructor(setup) {
        this.serviceName = setup.serviceName;
        this.workerID = setup.workerID;
        this.ipc = new IPC_1.IPC();
        this.readyPromise = new Promise((resolve, reject) => {
            this.serviceReady = () => {
                resolve();
            };
            this.serviceStartingError = (err) => {
                reject(err);
            };
        });
    }
}
exports.BaseServiceWorker = BaseServiceWorker;
//# sourceMappingURL=BaseServiceWorker.js.map