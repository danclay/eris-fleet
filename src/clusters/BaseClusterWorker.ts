import {IPC} from "../util/IPC";
import {Client} from "eris";

export interface Setup {
	bot: Client;
	clusterID: number;
	workerID: number;
	ipc: IPC;
}

export class BaseClusterWorker {
	/** The Eris client */
	public bot: Client;
	/** ID of the cluster */
	public clusterID: number;
	/** ID of the worker */
	public workerID: number;
	/** IPC functions */
	public ipc: IPC;
	/** 
	 * Graceful shotdown of the cluster. Have a function within your bot class called "shutdown" to use this.
	 * @param done Call this function when your shutdown function is complete. 
	*/
	public shutdown?: (done: () => void) => void;
	/** 
	 * Function to handle commands. Have a function called "handleCommand in your cluster class to use this."
	 * @param data Data sent in the command
	*/
	public handleCommand?: (data: unknown) => unknown;

	public constructor(setup: Setup) {
		this.bot = setup.bot;
		this.clusterID = setup.clusterID;
		this.workerID = setup.workerID;
		this.ipc = setup.ipc;
	}

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
