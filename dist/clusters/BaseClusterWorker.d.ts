import { IPC } from '../util/IPC';
export interface Setup {
    bot: any;
    clusterID: number;
    workerID: number;
}
export declare class BaseClusterWorker {
    bot: any;
    clusterID: number;
    workerID: number;
    ipc: IPC;
    /** Function called for graceful shutdown of the cluster */
    shutdown?: Function;
    constructor(setup: Setup);
}
