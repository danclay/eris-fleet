import { IPC } from "../util/IPC";
import { Client } from "eris";
export interface Setup {
    bot: Client;
    clusterID: number;
    workerID: number;
}
export declare class BaseClusterWorker {
    bot: Client;
    clusterID: number;
    workerID: number;
    ipc: IPC;
    /** Function called for graceful shutdown of the cluster */
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
}
