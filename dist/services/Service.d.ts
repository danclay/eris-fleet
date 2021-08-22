import { BaseServiceWorker } from "./BaseServiceWorker";
import { IPC } from "../util/IPC";
import { LoggingOptions } from "../sharding/Admiral";
interface ServiceInput {
    fetchTimeout: number;
    overrideConsole: boolean;
}
export declare class Service {
    path: string;
    serviceName: string;
    app?: BaseServiceWorker;
    timeout: number;
    whatToLog: LoggingOptions[];
    ipc: IPC;
    connectedTimestamp?: number;
    constructor(input: ServiceInput);
    private loadCode;
}
export {};
