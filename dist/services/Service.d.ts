import { BaseServiceWorker } from "./BaseServiceWorker";
import { IPC } from "../util/IPC";
interface ServiceInput {
    fetchTimeout: number;
}
export declare class Service {
    path: string;
    serviceName: string;
    app?: BaseServiceWorker;
    timeout: number;
    whatToLog: string[];
    ipc: IPC;
    constructor(input: ServiceInput);
    private loadCode;
}
export {};
