import * as Eris from "eris";
import { BaseClusterWorker } from "./BaseClusterWorker";
interface ClusterInput {
    erisClient: any;
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
    bot: Eris.Client;
    private token;
    app?: BaseClusterWorker;
    App: any;
    shutdown?: boolean;
    private startingStatus?;
    constructor(input: ClusterInput);
    private connect;
    private loadCode;
}
export {};
