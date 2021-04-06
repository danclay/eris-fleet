import { IPC } from "../util/IPC";
export interface Setup {
    serviceName: string;
    workerID: number;
}
export declare class BaseServiceWorker {
    /** ID of the worker */
    workerID: number;
    /** IPC functions */
    ipc: IPC;
    serviceName: string;
    /** Function to report a service being ready */
    serviceReady: () => void;
    /** Function to report error during service launch */
    serviceStartingError: (error: unknown) => void;
    /** @internal */
    readyPromise: Promise<undefined>;
    /**
     * Function to handle commands. Have a function called "handleCommand in your service class to use this."
     * @param data Data sent in the command
    */
    handleCommand: (data: unknown) => unknown;
    /**
     * Graceful shotdown of the service. Have a function within your bot class called "shutdown" to use this.
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
}
