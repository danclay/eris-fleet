import {IPC} from '../util/IPC';

interface Setup {
    serviceName: string;
    workerID: number;
}

export class BaseServiceWorker {
    workerID: number;
    ipc: IPC;
    serviceName: string;
    serviceReady!: Function;
    serviceStartingError!: Function;
    readyPromise!: any;
    handleCommand!: Function;
    shutdown?: Function;

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