"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseServiceWorker = void 0;
class BaseServiceWorker {
    constructor(setup) {
        this.serviceName = setup.serviceName;
        this.workerID = setup.workerID;
        this.ipc = setup.ipc;
        this.readyPromise = new Promise((resolve, reject) => {
            this.serviceReady = () => {
                resolve(undefined);
            };
            this.serviceStartingError = (err) => {
                reject(err);
            };
        });
    }
}
exports.BaseServiceWorker = BaseServiceWorker;
//# sourceMappingURL=BaseServiceWorker.js.map