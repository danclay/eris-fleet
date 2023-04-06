import { IPC } from "../util/IPC";
import { Client } from "eris";
export interface Setup {
    bot: Client;
    clusterID: number;
    workerID: number;
    ipc: IPC;
}
export declare class BaseClusterWorker {
    bot: Client;
    clusterID: number;
    workerID: number;
    ipc: IPC;
    shutdown?: (done: () => void) => void;
    handleCommand?: (data: any) => any;
    constructor(setup: Setup);
    runEval(stringToEvaluate: string): Promise<unknown>;
}
