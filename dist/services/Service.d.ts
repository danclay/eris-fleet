import { BaseServiceWorker } from "./BaseServiceWorker";
import { IPC } from "../util/IPC";
import { LoggingOptions, ServiceCreator } from "../sharding/Admiral";
interface ServiceInput {
    fetchTimeout: number;
    overrideConsole: boolean;
    servicesToCreate: ServiceCreator[];
}
export declare class Service {
    path?: string;
    serviceName: string;
    app?: BaseServiceWorker;
    timeout: number;
    whatToLog: LoggingOptions[];
    ipc: IPC;
    connectedTimestamp?: number;
    private ServiceWorker?;
    constructor(input: ServiceInput);
    private loadCode;
}
export {};
