import * as Eris from "eris";
import { BaseClusterWorker } from "./BaseClusterWorker";
import * as Admiral from "../sharding/Admiral";
import { IPC } from "../util/IPC";
interface ClusterInput {
    erisClient: typeof Eris.Client;
    fetchTimeout: number;
    overrideConsole: boolean;
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
    whatToLog: Admiral.LoggingOptions[];
    useCentralRequestHandler: boolean;
    bot: Eris.Client;
    private token;
    app?: BaseClusterWorker;
    App: typeof BaseClusterWorker;
    ipc: IPC;
    shutdown?: boolean;
    private startingStatus?;
    private loadClusterCodeImmediately;
    private resharding;
    constructor(input: ClusterInput);
    private connect;
    private loadCode;
}
export {};
