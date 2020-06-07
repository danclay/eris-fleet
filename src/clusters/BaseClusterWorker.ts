import {IPC} from '../util/IPC';

export interface Setup {
    bot: any;
    clusterID: number;
    workerID: number;
}

export class BaseClusterWorker {
    public bot: any;
    public clusterID: number;
    public workerID: number;
    public ipc: IPC;
    /** Function called for graceful shutdown of the cluster */
    public shutdown?: Function;

    public constructor(setup: Setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = new IPC();
    }
}