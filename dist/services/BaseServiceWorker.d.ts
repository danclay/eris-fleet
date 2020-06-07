import { IPC } from '../util/IPC';
export interface Setup {
    serviceName: string;
    workerID: number;
}
export declare class BaseServiceWorker {
    workerID: number;
    ipc: IPC;
    serviceName: string;
    /** Function to report a service being ready */
    serviceReady: Function;
    /** Function to report error during service launch */
    serviceStartingError: Function;
    readyPromise: any;
    handleCommand: Function;
    /** Function called for graceful shutdown of the service */
    shutdown?: Function;
    constructor(setup: Setup);
}
