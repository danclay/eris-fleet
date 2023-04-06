/// <reference types="node" />
import { EventEmitter } from "events";
import { ClientOptions } from "eris";
import { StartingStatus, LoggingOptions } from "../sharding/Admiral";
export interface ClusterConnectMessage {
    clusterID: number;
    clusterCount: number;
    op: "connect" | string;
    firstShardID: number;
    lastShardID: number;
    shardCount: number;
    token: string;
    clientOptions: ClientOptions;
    path?: string;
    whatToLog: LoggingOptions[];
    startingStatus?: StartingStatus;
    useCentralRequestHandler: boolean;
    loadClusterCodeImmediately: boolean;
    resharding: boolean;
}
export interface ShutdownMessage {
    op: "shutdown" | string;
}
export interface ServiceConnectMessage {
    serviceName: string;
    path?: string;
    op: "connect" | string;
    timeout: number;
    whatToLog: LoggingOptions[];
}
export interface QueueItem {
    type: "service" | "cluster" | string;
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage | ShutdownMessage;
}
export declare class Queue extends EventEmitter {
    queue: QueueItem[];
    override: string | undefined;
    constructor();
    execute(first?: boolean, override?: string): void;
    item(item: QueueItem, override?: string): void;
    bulkItems(items: QueueItem[], override?: string): void;
}
