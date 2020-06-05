import {IPC} from '../util/IPC';

interface Setup {
    bot: any;
    clusterID: number;
    workerID: number;
}

export class BaseClusterWorker {
    bot: any;
    clusterID: number;
    workerID: number;
    ipc: IPC;
    shutdown?: Function;

    public constructor(setup: Setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = new IPC();
    }
}