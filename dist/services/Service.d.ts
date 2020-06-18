import { BaseServiceWorker } from "./BaseServiceWorker";
export declare class Service {
    path: string;
    serviceName: string;
    app?: BaseServiceWorker;
    timeout: number;
    whatToLog: string[];
    constructor();
    private loadCode;
}
