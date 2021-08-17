import * as Eris from "eris";
import { BaseClusterWorker } from "./BaseClusterWorker";
import { IPC } from "../util/IPC";
interface ClusterInput {
    erisClient: typeof Eris.Client;
    fetchTimeout: number;
}
export declare class Cluster {
    private erisClient;
    firstShardID: number;
    lastShardID: number;
    path: string;
    clusterID: number;
    clusterCount: number;
    shardCount: number;
    shards: number;
    clientOptions: Eris.ClientOptions;
    whatToLog: string[];
    useCentralRequestHandler: boolean;
    bot: Eris.Client;
    private token;
    app?: BaseClusterWorker;
    App: any;
    ipc: IPC;
    shutdown?: boolean;
    private startingStatus?;
    constructor(input: ClusterInput);
    private connect;
    private loadCode;
}
export {};
