import {IPC} from "../util/IPC";

export interface Setup {
	serviceName: string;
	workerID: number;
}

export class BaseServiceWorker {
	public workerID: number;
	public ipc: IPC;
	public serviceName: string;
	/** Function to report a service being ready */
	public serviceReady!: () => void;
	/** Function to report error during service launch */
	public serviceStartingError!: (error: unknown) => void;
	public readyPromise!: Promise<undefined>;
	public handleCommand!: (data: unknown) => unknown;
	/** Function called for graceful shutdown of the service */
	public shutdown?: (done: () => void) => void;

	public constructor(setup: Setup) {
		this.serviceName = setup.serviceName;
		this.workerID = setup.workerID;
		this.ipc = new IPC();
		this.readyPromise = new Promise((resolve, reject) => {
			this.serviceReady = () => {
				resolve();
			};
			this.serviceStartingError = (err: unknown) => {
				reject(err);
			};
		});
	}
}