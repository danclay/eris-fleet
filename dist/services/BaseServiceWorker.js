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
    runEval(stringToEvaluate) {
        return new Promise((res, rej) => {
            const run = async () => {
                try {
                    const result = await eval(stringToEvaluate);
                    res(result);
                }
                catch (e) {
                    rej(e);
                }
            };
            run();
        });
    }
}
exports.BaseServiceWorker = BaseServiceWorker;
//# sourceMappingURL=BaseServiceWorker.js.map