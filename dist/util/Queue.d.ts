/// <reference types="node" />
import { EventEmitter } from "events";
import { ClientOptions } from "eris";
import { StartingStatus, LoggingOptions } from "../sharding/Admiral";
/** @internal */
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
/** @internal */
export interface ShutdownMessage {
    op: "shutdown" | string;
}
/** @internal */
export interface ServiceConnectMessage {
    serviceName: string;
    path?: string;
    op: "connect" | string;
    timeout: number;
    whatToLog: LoggingOptions[];
}
/** @internal */
export interface QueueItem {
    type: "service" | "cluster" | string;
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage | ShutdownMessage;
}
/** @internal */
export declare class Queue extends EventEmitter {
    /** The queue */
    queue: QueueItem[];
    /** Pauses all non-authorized executions */
    override: string | undefined;
    constructor();
    execute(first?: boolean, override?: string): void;
    item(item: QueueItem, override?: string): void;
    bulkItems(items: QueueItem[], override?: string): void;
}
