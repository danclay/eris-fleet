import {IPC} from "../util/IPC";
import {Client} from "eris";

export interface Setup {
	bot: Client;
	clusterID: number;
	workerID: number;
}

export class BaseClusterWorker {
	public bot: Client;
	public clusterID: number;
	public workerID: number;
	public ipc: IPC;
	/** Function called for graceful shutdown of the cluster */
	public shutdown?: (done: () => void) => void;

	public constructor(setup: Setup) {
		this.bot = setup.bot;
		this.clusterID = setup.clusterID;
		this.workerID = setup.workerID;
		this.ipc = new IPC();
	}
}
