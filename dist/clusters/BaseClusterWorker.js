"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseClusterWorker = void 0;
class BaseClusterWorker {
    constructor(setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = setup.ipc;
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
exports.BaseClusterWorker = BaseClusterWorker;
//# sourceMappingURL=BaseClusterWorker.js.map