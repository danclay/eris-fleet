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
    readyPromise!: any;
    handleCommand!: Function;

    public constructor(setup: Setup) {
        this.serviceName = setup.serviceName;
        this.workerID = setup.workerID;
        this.ipc = new IPC();
        this.readyPromise = new Promise(resolve => {
            this.serviceReady = () => {
                resolve();
            };
        });
    }

    public restartCluster(clusterID: number) {
        this.ipc.sendTo(clusterID, "restart");
    }
}