import { IPC } from "../util/IPC";
import { Client } from "eris";
export interface Setup {
    bot: Client;
    clusterID: number;
    workerID: number;
    ipc: IPC;
}
export declare class BaseClusterWorker {
    /** The Eris client */
    bot: Client;
    /** ID of the cluster */
    clusterID: number;
    /** ID of the worker */
    workerID: number;
    ipc: IPC;
    /**
     * Graceful shutdown of the cluster. Have a function within your bot class called `shutdown` to use this.
     * @see {@link https://github.com/danclay/eris-fleet#clusters} for an example
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown?: (done: () => void) => void;
    /**
     * Function to handle commands. Have a function called `handleCommand` to your cluster class to handle commands.
     * @see {@link https://github.com/danclay/eris-fleet#clusters} for an example
     * @param data Data sent in the command
    */
    handleCommand?: (data: any) => any;
    constructor(setup: Setup);
    /**
     * Where evals are run from
     * @internal
     */
    runEval(stringToEvaluate: string): Promise<unknown>;
}
