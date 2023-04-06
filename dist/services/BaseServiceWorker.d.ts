import { IPC } from "../util/IPC";
export interface Setup {
    serviceName: string;
    workerID: number;
    ipc: IPC;
}
export declare class BaseServiceWorker {
    workerID: number;
    ipc: IPC;
    serviceName: string;
    serviceReady: () => void;
    serviceStartingError: (error: unknown) => void;
    readyPromise: Promise<undefined>;
    handleCommand: (data: any) => any;
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
    runEval(stringToEvaluate: string): Promise<unknown>;
}
