/// <reference types="node" />
import { EventEmitter } from 'events';
import { ClientOptions } from 'eris';
import * as Admiral from '../sharding/Admiral';
interface ClusterConnectMessage {
    clusterID: number;
    clusterCount: number;
    op: "connect";
    firstShardID: number;
    lastShardID: number;
    shardCount: number;
    token: string;
    clientOptions: ClientOptions;
    path: string;
    whatToLog: string[];
    startingStatus?: Admiral.startingStatus;
}
interface ShutdownMessage {
    op: "shutdown";
    killTimeout: number;
}
interface ServiceConnectMessage {
    serviceName: string;
    path: string;
    op: "connect";
    timeout: number;
    whatToLog: string[];
}
export interface QueueItem {
    type: "service" | "cluster";
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage | ShutdownMessage;
}
export declare class Queue extends EventEmitter {
    /** The queue */
    queue: QueueItem[];
    constructor();
    execute(first?: Boolean): void;
    item(item: QueueItem): void;
}
export {};
