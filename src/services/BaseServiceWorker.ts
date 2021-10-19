import {IPC} from "../util/IPC";

/** @internal */
export interface Setup {
	serviceName: string;
	workerID: number;
	ipc: IPC;
}

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
export class BaseServiceWorker {
	/** ID of the worker */
	public workerID: number;
	public ipc: IPC;
	/** Unique name given to the service */
	public serviceName: string;
	/** Function to report a service being ready */
	public serviceReady!: () => void;
	/** Function to report error during service launch
	 * @param error Error to report
	 */
	public serviceStartingError!: (error: unknown) => void;
	/** @hidden */
	public readyPromise!: Promise<undefined>;
	/** 
	 * Function to handle commands. Have a function called `handleCommand` to your service class to handle commands.
	 * @see {@link BaseServiceWorker} See for an example
	 * @param data Data sent in the command
	*/
	public handleCommand!: (data: any) => any;
	/** 
	 * Graceful shutdown of the service. Have a function within your bot class called `shutdown` to use this.
	 * 
	 * To handle errors, return something similar to the following: `{err: "error here"}`
	 * @see {@link BaseServiceWorker} See for an example
	 * @param done Call this function when your shutdown function is complete. 
	*/
	public shutdown?: (done: () => void) => void;

	public constructor(setup: Setup) {
		this.serviceName = setup.serviceName;
		this.workerID = setup.workerID;
		this.ipc = setup.ipc;
		this.readyPromise = new Promise((resolve, reject) => {
			this.serviceReady = () => {
				resolve(undefined);
			};
			this.serviceStartingError = (err: unknown) => {
				reject(err);
			};
		});
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