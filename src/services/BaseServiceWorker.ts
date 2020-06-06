import {IPC} from '../util/IPC';

interface Setup {
    serviceName: string;
    workerID: number;
}

export class BaseServiceWorker {
    public workerID: number;
    public ipc: IPC;
    public serviceName: string;
    /** Function to report a service being ready */
    public serviceReady!: Function;
    /** Function to report error during service launch */
    public serviceStartingError!: Function;
    public readyPromise!: any;
    public handleCommand!: Function;
    /** Function called for graceful shutdown of the service */
    public shutdown?: Function;

    public constructor(setup: Setup) {
        this.serviceName = setup.serviceName;
        this.workerID = setup.workerID;
        this.ipc = new IPC();
        this.readyPromise = new Promise((resolve, reject) => {
            this.serviceReady = () => {
                resolve();
            };
            this.serviceStartingError = (err: any) => {
                reject(err);
            };
        });
    }
}