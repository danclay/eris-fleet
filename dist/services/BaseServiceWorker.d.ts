import { IPC } from "../util/IPC";
export interface Setup {
    serviceName: string;
    workerID: number;
    ipc: IPC;
}
export declare class BaseServiceWorker {
    /** ID of the worker */
    workerID: number;
    ipc: IPC;
    /** Unique name given to the service */
    serviceName: string;
    /** Function to report a service being ready */
    serviceReady: () => void;
    /** Function to report error during service launch
     * @param error Error to report
     */
    serviceStartingError: (error: unknown) => void;
    /** @internal */
    readyPromise: Promise<undefined>;
    /**
     * Function to handle commands. Have a function called `handleCommand` to your service class to handle commands.
     * @see {@link https://github.com/danclay/eris-fleet#services} for an example
     * @param data Data sent in the command
    */
    handleCommand: (data: any) => any;
    /**
     * Graceful shutdown of the service. Have a function within your bot class called `shutdown` to use this.
     * @see {@link https://github.com/danclay/eris-fleet#services} for an example
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown?: (done: () => void) => void;
    constructor(setup: Setup);
    /**
     * Where evals are run from
     * @internal
     */
    runEval(stringToEvaluate: string): Promise<unknown>;
}
