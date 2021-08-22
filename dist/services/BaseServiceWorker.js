"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseServiceWorker = void 0;
/**
 * The base class for a service
 * @example
 * ```
 * const { BaseServiceWorker } = require('eris-fleet');
 *
 * module.exports = class ServiceWorker extends BaseServiceWorker {
 * 	constructor(setup) {
 * 		// Do not delete this super.
 * 		super(setup);
 *
 * 		// Run this function when your service is ready for use. This MUST be run for the worker spawning to continue.
 * 		this.serviceReady();
 *
 * 		// Demonstration of the properties the service has (Keep reading for info on IPC):
 * 		// ID of the worker
 * 		console.log(this.workerID);
 * 		// The name of the service
 * 		console.log(this.serviceName);
 * 	}
 * 	// This is the function which will handle commands. In this example the data is {"smileyFace": ":)"}
 * 	async handleCommand(dataSentInCommand) {
 * 		// Return a response if you want to respond
 * 		return dataSentInCommand.smileyFace;
 * 	}
 * 	shutdown(done) {
 * 		// Optional function to gracefully shutdown things if you need to.
 * 		done(); // Use this function when you are done gracefully shutting down.
 * 	}
 * }
 * ```
 */
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
    /**
     * Where evals are run from
     * @internal
     */
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