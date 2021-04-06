import {IPC} from "../util/IPC";
import {Client} from "eris";

export interface Setup {
	bot: Client;
	clusterID: number;
	workerID: number;
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

	public constructor(setup: Setup) {
		this.bot = setup.bot;
		this.clusterID = setup.clusterID;
		this.workerID = setup.workerID;
		this.ipc = new IPC();
	}
}
