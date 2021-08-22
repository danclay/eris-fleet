import {IPC} from "../util/IPC";
import {Client} from "eris";

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
 * 		console.log(this.workerID);
 * 		// The ID of the cluster
 * 		console.log(this.clusterID);
 * 	}
 * 	async handleMessage(msg) {
 * 		if (msg.content === "!ping" && !msg.author.bot) {
 * 			this.bot.createMessage(msg.channel.id, "Pong!");
 * 		}
 * 	}
 * 	shutdown(done) {
 * 		// Optional function to gracefully shutdown things if you need to.
 * 		done(); // Use this function when you are done gracefully shutting down.
 * 	}
 * }
 * ```
 */
export class BaseClusterWorker {
	/** The Eris client */
	public bot: Client;
	/** ID of the cluster */
	public clusterID: number;
	/** ID of the worker */
	public workerID: number;
	public ipc: IPC;
	/** 
	 * Graceful shutdown of the cluster. Have a function within your bot class called `shutdown` to use this.
	 * @see {@link BaseClusterWorker} See for an example
	 * @param done Call this function when your shutdown function is complete. 
	*/
	public shutdown?: (done: () => void) => void;
	/** 
	 * Function to handle commands. Have a function called `handleCommand` to your cluster class to handle commands.
	 * @see {@link BaseClusterWorker} See for an example
	 * @param data Data sent in the command
	*/
	public handleCommand?: (data: any) => any;

	public constructor(setup: Setup) {
		this.bot = setup.bot;
		this.clusterID = setup.clusterID;
		this.workerID = setup.workerID;
		this.ipc = setup.ipc;
	}

	/**
	 * Where evals are run from
	 * @internal
	 */
	public runEval(stringToEvaluate: string): Promise<unknown> {
		return new Promise((res, rej) => {
			const run = async () => {
				try {
					const result = await eval(stringToEvaluate);
					res(result);
				}
				catch(e) {
					rej(e);
				}
			};
			run();
		});
	}
}
