import { IPC } from "../util/IPC";
export interface Setup {
    serviceName: string;
    workerID: number;
}
export declare class BaseServiceWorker {
    workerID: number;
    ipc: IPC;
    serviceName: string;
    /** Function to report a service being ready */
    serviceReady: () => void;
    /** Function to report error during service launch */
    serviceStartingError: (error: unknown) => void;
    readyPromise: Promise<undefined>;
    handleCommand: (data: unknown) => unknown;
    /** Function called for graceful shutdown of the service */
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
}
