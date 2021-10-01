/// <reference types="node" />
import { IPC } from "./../util/IPC";
import { EventEmitter } from "events";
import { Collection } from "../util/Collection";
import Eris from "eris";
interface ServiceCreator {
    name: string;
    path: string;
}
export interface ObjectLog {
    source?: string;
    timestamp: number;
    message: unknown;
}
export interface StartingStatus {
    status: "online" | "idle" | "dnd" | "offline";
    game?: Eris.ActivityPartial<Eris.BotActivityType>;
}
/** Possible options to put in the logging options array */
export declare type LoggingOptions = "gateway_shards" | "admiral_start" | "shards_spread" | "stats_update" | "all_clusters_launched" | "all_services_launched" | "cluster_launch" | "service_launch" | "cluster_start" | "service_start" | "service_ready" | "cluster_ready" | "code_loaded" | "shard_connect" | "shard_ready" | "shard_disconnect" | "shard_resume" | "service_restart" | "cluster_restart" | "service_shutdown" | "cluster_shutdown" | "total_shutdown" | "resharding_transition_complete" | "resharding_transition" | "resharding_worker_killed" | "concurrency_group_starting";
/** Options for resharding */
export interface ReshardOptions {
    /** Guilds per shard */
    guildsPerShard?: number;
    /** First shard ID to use on this instance of eris-fleet */
    firstShardID?: number;
    /** Last shard ID to use on this instance of eris-fleet */
    lastShardID?: number;
    /** Number of shards */
    shards?: number | "auto";
    /** Number of clusters */
    clusters?: number | "auto";
}
/** Options for the sharding manager */
export interface Options {
    /** Absolute path to the js file */
    path: string;
    /** Bot token */
    token: string;
    /**
     * Guilds per shard
     * @defaultValue 1300
     */
    guildsPerShard?: number;
    /**
     * Number of shards
     * @defaultValue "auto"
     */
    shards?: number | "auto";
    /**
     * Number of clusters
     * @defaultValue "auto"
     */
    clusters?: number | "auto";
    /** Options to pass to the Eris client constructor */
    clientOptions?: Eris.ClientOptions;
    /**
     * How long to wait for shards to connect to discord
     *
     * @deprecated Use the `connectionTimeout` property of {@link Options.clientOptions}
     */
    timeout?: number;
    /**
     * How long to wait for a service to start
     * @defaultValue 0
     */
    serviceTimeout?: number;
    /**
     * How long between starting clusters
     * @defaultValue 5e3
     */
    clusterTimeout?: number;
    /** Node arguments to pass to the clusters */
    nodeArgs?: string[];
    /**
     * How often to update the stats after all clusters are spawned (set to "disable" to disable automated stats)
     * @defaultValue 60e3
     */
    statsInterval?: number | "disable";
    /** Services to start by name and path */
    services?: ServiceCreator[];
    /** First shard ID to use on this instance of eris-fleet */
    firstShardID?: number;
    /** Last shard ID to use on this instance of eris-fleet */
    lastShardID?: number;
    /**
     * Option to have less logging show up
     * @defaultValue false
     */
    lessLogging?: boolean;
    /**
     * Allows for more logging customization (overrides generic lessLogging option)
     *
     * @see {@link LoggingOptions} See for available options
     *
     * @example
     * ```js
     * const options = {
     * 	// Your other options
     * 	whatToLog: {
     * 		// This will only log when the admiral starts, when clusters are ready, and when services are ready.
     * 		whitelist: ['admiral_start', 'cluster_ready', 'service_ready']
     * 	}
     * };
     * ```
     */
    whatToLog?: {
        /** Whitelist of what to log */
        whitelist?: LoggingOptions[];
        /** Blacklist of what to log */
        blacklist?: LoggingOptions[];
    };
    /**
     * Amount of time to wait in ms before doing a forced shutdown during shutdowns
     * @defaultValue 10e3
     */
    killTimeout?: number;
    /**
     * Whether to split the source in to an Object
     * @defaultValue false
     * @see {@link ObjectLog} See for the object which is given in the logging event if this option is enabled
     */
    objectLogging?: boolean;
    /** Custom starting status */
    startingStatus?: StartingStatus;
    /**
     * How long to wait in ms before giving up on a fetch (includes eval functions and commands)
     * @defaultValue 10e3
     */
    fetchTimeout?: number;
    /** Extended eris client class (should extend Eris.Client) */
    customClient?: typeof Eris.Client;
    /**
     * Whether to use a central request handler.
     * The central request handler routes Eris requests to the Discord API through a single instance of the Eris RequestHandler.
     * This helps prevent 429 errors from the Discord API by using a single rate limiter pool.
     * @defaultValue false
     */
    useCentralRequestHandler?: boolean;
    /**
     * Whether to load your cluster class as soon as possible or wait until Eris's ready event.
     * If you use this, your bot file must listen for the Eris ready event before doing anything which requires all shards to be connected.
     * @defaultValue false
     */
    loadCodeImmediately?: boolean;
    /**
     * Whether to override console.log, console.debug, console.warn, and console.error in clusters and services
     * @defaultValue true
     */
    overrideConsole?: boolean;
    /**
     * Whether to start services together or not.
     * @defaultValue false
     */
    startServicesTogether?: boolean;
    /**
     * Override the `max_concurrency` value sent from Discord (useful if using eris-fleet across machines).
     * Set to 1 to disable concurrency.
     * @beta
     */
    maxConcurrencyOverride?: number;
    /**
     * Whether to shutdown shutdown services and clusters together whenever possible
     * @defaultValue false
     */
    shutdownTogether?: boolean;
    /**
     * Whether to broadcast Admiral events (e.g. when a cluster is ready)
     * Note to avoid using Admiral event names when this is enabled
     * @defaultValue true
     */
    broadcastAdmiralEvents?: boolean;
    /**
     * Maximum amount of restarts of a worker before giving up. -1 is infinite.
     * @defaultValue 5
     */
    maxRestarts?: number;
}
export interface ShardStats {
    latency: number;
    id: number;
    ready: boolean;
    status: "disconnected" | "connecting" | "handshaking" | "ready" | "resuming";
    guilds: number;
    /**
     * @deprecated Use {@link ShardStats.members}
     */
    users: number;
    /** Total members of each server the shard serves */
    members: number;
}
export interface ClusterStats {
    id: number;
    guilds: number;
    /** Cached users */
    users: number;
    /** Total members of each server the cluster serves */
    members: number;
    /** Uptime in ms */
    uptime: number;
    /** The cluster's voice connections */
    voice: number;
    largeGuilds: number;
    /** The cluster's memory usage in MB */
    ram: number;
    /**
     * @deprecated Use {@link ClusterStats.shards}
     */
    shardStats: ShardStats[];
    shards: ShardStats[];
    /** One-way IPC latency between the admiral and the cluster in ms */
    ipcLatency: number;
    /** Latency for the request handler if not using the central request handler */
    requestHandlerLatencyRef?: Eris.LatencyRef;
}
export interface ServiceStats {
    name: number;
    /** Uptime in ms */
    uptime: number;
    /** The service's memory usage in MB */
    ram: number;
    /** One-way IPC latency between the admiral and the service in ms */
    ipcLatency: number;
}
export interface Stats {
    guilds: number;
    /** Total cached users */
    users: number;
    /** Total members this instance of eris-fleet is serving */
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
    /** Timestamp of when the stats were collected */
    timestamp: number;
    /** Latency for the request handler if using the central request handler */
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
    path: string;
}
/**
 * The sharding manager.
 * @example
 * ```js
 * const { isMaster } = require('cluster');
 * const { Fleet } = require('eris-fleet');
 * const path = require('path');
 * const { inspect } = require('util');
 * require('dotenv').config();
 *
 * const options = {
 * 	path: path.join(__dirname, "./bot.js"),
 * 	token: process.env.token
 * }
 *
 * const Admiral = new Fleet(options);
 *
 * if (isMaster) {
 * 	// Code to only run for your master process
 * 	Admiral.on('log', m => console.log(m));
 * 	Admiral.on('debug', m => console.debug(m));
 * 	Admiral.on('warn', m => console.warn(m));
 * 	Admiral.on('error', m => console.error(inspect(m)));
 *
 * 	// Logs stats when they arrive
 * 	Admiral.on('stats', m => console.log(m));
 * }
 * ```
 *
 * @fires Admiral#log Message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#debug Debug message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#warn Warning message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#error Error to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#clusterReady Fires when a cluster is ready. Supplies {@link ClusterCollection | Cluster Object}.
 * @fires Admiral#serviceReady Fires when a service is ready. Supplies {@link ServiceCollection | Service Object}.
 * @fires Admiral#clusterShutdown Fires when a cluster is shutdown. Supplies {@link ClusterCollection | Cluster Object}.
 * @fires Admiral#serviceShutdown Fires when a service is shutdown. Supplies {@link ServiceCollection | Service Object}.
 * @fires Admiral#ready Fires when the queue is empty.
 * @fires Admiral#stats Fires when stats are ready. Supplies {@link Stats}
 * @fires Admiral#reshardingComplete Fires when resharding completes.
*/
export declare class Admiral extends EventEmitter {
    /** Map of clusters by ID */
    clusters: Collection<number, ClusterCollection>;
    /** Map of services by name */
    services: Collection<string, ServiceCollection>;
    /**
     * IPC class for the Admiral which functions like the worker IPC classes.
     * Has some redundant functions which already exist on the Admiral class.
     */
    ipc: IPC;
    /** Maps of workers currently launching by ID */
    private launchingWorkers;
    private path;
    private token;
    guildsPerShard: number;
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
    /** Services to create */
    private servicesToCreate?;
    private queue;
    /** Eris client used to get the gateway information and to send requests when using the central request handler */
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
    /** Map of cluster group number to the number of times that group's members have connected */
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
    /** Map of cluster ID to sequential failed restarts */
    private clustersSequentialFailedRestarts;
    /** Map of service name to sequential failed restarts */
    private servicesSequentialFailedRestarts;
    /**
     * Creates the sharding manager
     * @param options Options to configure the sharding manager
    */
    constructor(options: Options);
    private ipcMessageHandler;
    private launch;
    private ipcReturn;
    private centralApiRequest;
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
    */
    restartCluster(clusterID: number, hard: boolean): void;
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard: boolean): void;
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    restartService(serviceName: string, hard: boolean): void;
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard: boolean): void;
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownCluster(clusterID: number, hard: boolean): void;
    /**
     * Shuts down a service
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName: string, hard: boolean): void;
    /**
     * Create a service
     * @param serviceName Unique ame of the service
     * @param servicePath Absolute path to the service file
     * @example
     * ```js
     * const path = require("path");
     * admiral.createService("myService", path.join(__dirname, "./service.js"))
     * ```
     */
    createService(serviceName: string, servicePath: string): void;
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard: boolean): void;
    /**
     * Reshards all clusters
     * @param options Change the resharding options
    */
    reshard(options?: ReshardOptions): void;
    /**
     * Broadcast an event to all clusters and services.
     * The event can be listened to with {@link register}
     * @param op Name of the event
     * @param message Message to send
     * @example
     * ```js
     * admiral.broadcast("hello clusters!", "Want to chat?");
     * ```
    */
    broadcast(op: string, msg?: unknown): void;
    /**
     * Force eris-fleet to fetch fresh stats
     * @returns Promise with stats
     */
    collectStats(): Promise<Stats>;
    private startService;
    private startCluster;
    private calculateShards;
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
    warn(message: unknown, source?: string): void;
}
export {};
