import * as Eris from 'eris';
import { BaseClusterWorker } from './BaseClusterWorker';
export declare class Cluster {
    firstShardID: number;
    lastShardID: number;
    path: string;
    clusterID: number;
    clusterCount: number;
    shardCount: number;
    shards: number;
    clientOptions: any;
    whatToLog: string[];
    bot: Eris.Client;
    private token;
    app: BaseClusterWorker;
    shutdown?: Boolean;
    constructor();
    private connect;
    private loadCode;
}
