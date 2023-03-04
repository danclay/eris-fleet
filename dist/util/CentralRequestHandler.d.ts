import { IPC } from "./IPC";
import Eris from "eris";
interface CentralRequestHandlerOptions {
    timeout: number;
}
export declare class CentralRequestHandler {
    private timeout;
    private ipc;
    private requests;
    constructor(ipc: IPC, options: CentralRequestHandlerOptions);
    request(method: Eris.RequestMethod, url: string, auth?: boolean, body?: {
        [s: string]: unknown;
    }, file?: Eris.FileContent, _route?: string, short?: boolean): Promise<unknown>;
}
export {};
