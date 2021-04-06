import {IPC} from "../util/IPC";

export interface Setup {
	serviceName: string;
	workerID: number;
}

export class BaseServiceWorker {
	/** ID of the worker */
	public workerID: number;
	/** IPC functions */
	public ipc: IPC;
	public serviceName: string;
	/** Function to report a service being ready */
	public serviceReady!: () => void;
	/** Function to report error during service launch */
	public serviceStartingError!: (error: unknown) => void;
	/** @internal */
	public readyPromise!: Promise<undefined>;
	/** 
	 * Function to handle commands. Have a function called "handleCommand in your service class to use this."
	 * @param data Data sent in the command
	*/
	public handleCommand!: (data: unknown) => unknown;
	/** 
	 * Graceful shotdown of the service. Have a function within your bot class called "shutdown" to use this.
	 * @param done Call this function when your shutdown function is complete. 
	*/
	public shutdown?: (done: () => void) => void;

	public constructor(setup: Setup) {
		this.serviceName = setup.serviceName;
		this.workerID = setup.workerID;
		this.ipc = new IPC();
		this.readyPromise = new Promise((resolve, reject) => {
			this.serviceReady = () => {
				resolve(undefined);
			};
			this.serviceStartingError = (err: unknown) => {
				reject(err);
			};
		});
	}
}