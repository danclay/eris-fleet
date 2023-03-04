import { IPC } from "../util/IPC";
import { Client } from "eris";
/** @internal */
export interface Setup {
    bot: Client;
    clusterID: number;
    workerID: number;
    ipc: IPC;
}
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
export declare class BaseClusterWorker {
    /** The Eris client */
    bot: Client;
    /** ID of the cluster */
    clusterID: number;
    /** ID of the worker */
    workerID: number;
    ipc: IPC;
    /**
     * Graceful shutdown of the cluster. Have a function within your bot class called `shutdown` to use this.
     * @see {@link BaseClusterWorker} See for an example
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown?: (done: () => void) => void;
    /**
     * Function to handle commands. Have a function called `handleCommand` to your cluster class to handle commands.
     * @see {@link BaseClusterWorker} See for an example
     * @param data Data sent in the command
    */
    handleCommand?: (data: any) => any;
    constructor(setup: Setup);
    /**
     * Where evals are run from
     * @internal
     */
    runEval(stringToEvaluate: string): Promise<unknown>;
}
