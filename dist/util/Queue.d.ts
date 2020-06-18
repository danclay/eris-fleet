/// <reference types="node" />
import { EventEmitter } from "events";
import { ClientOptions } from "eris";
import * as Admiral from "../sharding/Admiral";
interface ClusterConnectMessage {
    clusterID: number;
    clusterCount: number;
    op: "connect" | string;
    firstShardID: number;
    lastShardID: number;
    shardCount: number;
    token: string;
    clientOptions: ClientOptions;
    path: string;
    whatToLog: string[];
    startingStatus?: Admiral.StartingStatus;
}
interface ShutdownMessage {
    op: "shutdown" | string;
    killTimeout: number;
}
interface ServiceConnectMessage {
    serviceName: string;
    path: string;
    op: "connect" | string;
    timeout: number;
    whatToLog: string[];
}
export interface QueueItem {
    type: "service" | "cluster" | string;
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage | ShutdownMessage;
}
export declare class Queue extends EventEmitter {
    /** The queue */
    queue: QueueItem[];
    constructor();
    execute(first?: boolean): void;
    item(item: QueueItem): void;
}
export {};
