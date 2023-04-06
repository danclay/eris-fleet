/// <reference types="node" />
import { BaseClusterWorker } from "./../clusters/BaseClusterWorker";
import { BaseServiceWorker } from "./../services/BaseServiceWorker";
import { IPC } from "./../util/IPC";
import { EventEmitter } from "events";
import { Collection } from "../util/Collection";
import Eris from "eris";
export interface ShardUpdate {
    shardID: number;
    clusterID: number;
    liveCluster: boolean;
}
export interface ServiceCreator {
    name: string;
    path?: string;
    ServiceWorker?: typeof BaseServiceWorker;
}
export interface ObjectLog {
    source?: string;
    timestamp: number;
    message: unknown;
}
export interface StartingStatus {
    status: Eris.Status;
    game?: Eris.ActivityPartial<Eris.BotActivityType>;
}
export type LoggingOptions = "gateway_shards" | "admiral_start" | "shards_spread" | "stats_update" | "all_clusters_launched" | "all_services_launched" | "cluster_launch" | "service_launch" | "cluster_start" | "service_start" | "service_ready" | "cluster_ready" | "code_loaded" | "shard_connect" | "shard_ready" | "shard_disconnect" | "shard_resume" | "service_restart" | "cluster_restart" | "service_shutdown" | "cluster_shutdown" | "total_shutdown" | "resharding_transition_complete" | "resharding_transition" | "resharding_worker_killed" | "concurrency_group_starting";
export interface ReshardOptions {
    guildsPerShard?: number | "auto";
    firstShardID?: number;
    lastShardID?: number;
    shards?: number | "auto";
    clusters?: number | "auto";
}
export interface Options {
    path?: string;
    BotWorker?: typeof BaseClusterWorker;
    token: string;
    guildsPerShard?: number | "auto";
    shards?: number | "auto";
    clusters?: number | "auto";
    clientOptions?: Eris.ClientOptions;
    timeout?: number;
    serviceTimeout?: number;
    clusterTimeout?: number;
    nodeArgs?: string[];
    statsInterval?: number | "disable";
    services?: ServiceCreator[];
    firstShardID?: number;
    lastShardID?: number;
    lessLogging?: boolean;
    whatToLog?: {
        whitelist?: LoggingOptions[];
        blacklist?: LoggingOptions[];
    };
    killTimeout?: number;
    objectLogging?: boolean;
    startingStatus?: StartingStatus;
    fetchTimeout?: number;
    customClient?: typeof Eris.Client;
    useCentralRequestHandler?: boolean;
    loadCodeImmediately?: boolean;
    overrideConsole?: boolean;
    startServicesTogether?: boolean;
    maxConcurrencyOverride?: number;
    shutdownTogether?: boolean;
    broadcastAdmiralEvents?: boolean;
    maxRestarts?: number;
}
export interface ShardStats {
    latency: number;
    id: number;
    ready: boolean;
    status: Eris.Shard["status"];
    guilds: number;
    users: number;
    members: number;
}
export interface ClusterStats {
    id: number;
    guilds: number;
    users: number;
    members: number;
    uptime: number;
    voice: number;
    largeGuilds: number;
    ram: number;
    shardStats: ShardStats[];
    shards: ShardStats[];
    ipcLatency: number;
    requestHandlerLatencyRef?: Eris.LatencyRef;
}
export interface ServiceStats {
    name: number;
    uptime: number;
    ram: number;
    ipcLatency: number;
}
export interface Stats {
    guilds: number;
    users: number;
    members: number;
    clustersRam: number;
    servicesRam: number;
    masterRam: number;
    totalRam: number;
    voice: number;
    largeGuilds: number;
    shardCount: number;
    clusters: ClusterStats[];
    services: ServiceStats[];
    timestamp: number;
    centralRequestHandlerLatencyRef?: Eris.LatencyRef;
}
export interface ClusterCollection {
    workerID: number;
    firstShardID: number;
    lastShardID: number;
    clusterID: number;
}
export interface ServiceCollection {
    serviceName: string;
    workerID: number;
    path?: string;
}
export declare class Admiral extends EventEmitter {
    clusters: Collection<number, ClusterCollection>;
    services: Collection<string, ServiceCollection>;
    ipc: IPC;
    private launchingWorkers;
    path?: string;
    BotWorker?: typeof BaseClusterWorker;
    private token;
    guildsPerShard: number | "auto";
    shardCount: number | "auto";
    clusterCount: number | "auto";
    lastShardID: number;
    firstShardID: number;
    private clientOptions;
    serviceTimeout: number;
    clusterTimeout: number;
    killTimeout: number;
    private erisClient;
    private useCentralRequestHandler;
    private nodeArgs?;
    private statsInterval;
    stats?: Stats;
    private servicesToCreate?;
    private queue;
    eris: Eris.Client;
    private prelimStats?;
    private statsWorkersCounted?;
    private chunks?;
    private pauseStats;
    private collectingStats;
    private whatToLog;
    private softKills;
    private launchingManager;
    private objectLogging;
    private startingStatus?;
    private resharding;
    private statsStarted;
    private fetches;
    private connectedClusterGroups;
    private fetchTimeout;
    private loadClusterCodeImmediately;
    private overrideConsole;
    private startServicesTogether;
    private maxConcurrencyOverride?;
    private maxConcurrency;
    private shutdownTogether;
    private broadcastAdmiralEvents;
    private maxRestarts;
    private clustersSequentialFailedRestarts;
    private servicesSequentialFailedRestarts;
    centralStore: Map<string, any>;
    constructor(options: Options);
    private ipcMessageHandler;
    private launch;
    private ipcReturn;
    private centralApiRequest;
    restartCluster(clusterID: number, hard: boolean): void;
    restartAllClusters(hard: boolean): void;
    restartService(serviceName: string, hard: boolean): void;
    restartAllServices(hard: boolean): void;
    shutdownCluster(clusterID: number, hard: boolean): void;
    shutdownService(serviceName: string, hard: boolean): void;
    createService(serviceName: string, service: string | typeof BaseServiceWorker): void;
    totalShutdown(hard: boolean): void;
    reshard(options?: ReshardOptions): void;
    broadcast(op: string, msg?: unknown): void;
    collectStats(): Promise<Stats>;
    updateBotWorker(BotWorker: typeof BaseClusterWorker): void;
    private startService;
    private startCluster;
    private calculateShards;
    private getShardConcurrencyBucket;
    private chunkConcurrencyGroups;
    private chunk;
    private shutdownWorker;
    private restartWorker;
    private fetchInfo;
    private executeStats;
    private startStats;
    private ipcLog;
    private emitLog;
    error(message: unknown, source?: string): void;
    debug(message: unknown, source?: string): void;
    log(message: unknown, source?: string): void;
    info(message: unknown, source?: string): void;
    warn(message: unknown, source?: string): void;
}
