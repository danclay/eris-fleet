import { BaseServiceWorker } from "./BaseServiceWorker";
import { IPC } from "../util/IPC";
export declare class Service {
    path: string;
    serviceName: string;
    app?: BaseServiceWorker;
    timeout: number;
    whatToLog: string[];
    ipc: IPC;
    constructor();
    private loadCode;
}
