"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseClusterWorker = void 0;
/**
 * The base class for a cluster
 * @example
 * ```js
 * const { BaseClusterWorker } = require('eris-fleet');
 *
 * module.exports = class BotWorker extends BaseClusterWorker {
 * 	constructor(setup) {
 * 		// Do not delete this super.
 * 		super(setup);
 *
 * 		this.bot.on('messageCreate', this.handleMessage.bind(this));
 *
 * 		// Demonstration of the properties the cluster has (Keep reading for info on IPC):
 * 		// ID of the worker
 * 		this.ipc.log(this.workerID);
 * 		// The ID of the cluster
 * 		this.ipc.log(this.clusterID);
 * 	}
 * 	async handleMessage(msg) {
 * 		if (msg.content === "!ping" && !msg.author.bot) {
 * 			this.bot.createMessage(msg.channel.id, "Pong!");
 * 		}
 * 	}
 * handleCommand(dataSentInCommand) {
 * 		// Optional function to return data from this cluster when requested
 * 		return "hello!"
 * }
 * 	shutdown(done) {
 * 		// Optional function to gracefully shutdown things if you need to.
 * 		done(); // Use this function when you are done gracefully shutting down.
 * 	}
 * }
 * ```
 */
class BaseClusterWorker {
    constructor(setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = setup.ipc;
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
exports.BaseClusterWorker = BaseClusterWorker;
//# sourceMappingURL=BaseClusterWorker.js.map