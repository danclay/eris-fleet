import { IPC } from "../util/IPC";
import { Client } from "eris";
export interface Setup {
    bot: Client;
    clusterID: number;
    workerID: number;
}
export declare class BaseClusterWorker {
    /** The Eris client */
    bot: Client;
    /** ID of the cluster */
    clusterID: number;
    /** ID of the worker */
    workerID: number;
    /** IPC functions */
    ipc: IPC;
    /**
     * Graceful shotdown of the cluster. Have a function within your bot class called "shutdown" to use this.
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
}
