import { IPC } from "./IPC";
interface CentralRequestHandlerOptions {
    timeout: number;
}
export declare class CentralRequestHandler {
    private timeout;
    private ipc;
    private requests;
    constructor(ipc: IPC, options: CentralRequestHandlerOptions);
    request(...args: any[]): Promise<unknown>;
}
export {};
