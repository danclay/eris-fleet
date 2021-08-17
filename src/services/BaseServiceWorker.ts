import {IPC} from "../util/IPC";

export interface Setup {
	serviceName: string;
	workerID: number;
	ipc: IPC;
}

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
	/** @internal */
	public readyPromise!: Promise<undefined>;
	/** 
	 * Function to handle commands. Have a function called `handleCommand` to your service class to handle commands.
	 * @see {@link https://github.com/danclay/eris-fleet#services} for an example
	 * @param data Data sent in the command
	*/
	public handleCommand!: (data: any) => any;
	/** 
	 * Graceful shutdown of the service. Have a function within your bot class called `shutdown` to use this.
	 * @see {@link https://github.com/danclay/eris-fleet#services} for an example
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