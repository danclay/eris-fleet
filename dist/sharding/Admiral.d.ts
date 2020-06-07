/// <reference types="node" />
import { EventEmitter } from 'events';
import { Collection } from '../util/Collection';
import * as Eris from 'eris';
interface ServiceCreator {
    name: string;
    path: string;
}
export interface Options {
    /** Absolute path to the js file */
    path: string;
    /** Bot token */
    token: string;
    /** Guilds per shard */
    guildsPerShard?: number;
    /** Number of shards */
    shards?: number | 'auto';
    /** Number of clusters */
    clusters?: number | 'auto';
    /** Options to pass to the Eris client constructor */
    clientOptions?: Eris.ClientOptions;
    /** How long to wait for shards to connect to discord */
    timeout?: number;
    /** How long to wait for a service to connect */
    serviceTimeout?: number;
    /** How long between starting clusters */
    clusterTimeout?: number;
    /** Node arguments to pass to the clusters */
    nodeArgs?: string[];
    /** How often to update the stats after all clusters are spawned (set to "disable" to disable automated stats) */
    statsInterval?: number | 'disable';
    /** Services to start by name and path */
    services?: ServiceCreator[];
    /** First shard ID to use on this instance of eris-fleet */
    firstShardID?: number;
    /** Last shard ID to use on this instance of eris-fleet */
    lastShardID?: number;
    /** Option to have less logging show up */
    lessLogging?: Boolean;
    /** Allows for more logging customization (overrides generic lessLogging option) */
    whatToLog?: any;
    /** Amount of time to wait before doing a forced shutdown during shutdowns */
    killTimeout?: number;
}
interface ShardStats {
    latency: number;
    id: number;
    ready: Boolean;
    status: 'disconnected' | 'connecting' | 'handshaking' | 'ready';
}
interface ClusterStats {
    id: number;
    guilds: number;
    users: number;
    uptime: number;
    voice: number;
    largeGuilds: number;
    ram: number;
    shardStats: ShardStats[] | [];
}
export interface Stats {
    guilds: number;
    users: number;
    clustersRam: number;
    voice: number;
    largeGuilds: number;
    shardCount: number;
    clusters: ClusterStats[];
}
export declare class Admiral extends EventEmitter {
    /** Map of clusters by  to worker by ID */
    clusters: Collection;
    /** Map of services by name to worker ID */
    services: Collection;
    private path;
    private token;
    guildsPerShard: number;
    shardCount: number | 'auto';
    clusterCount: number | 'auto';
    lastShardID: number;
    firstShardID: number;
    private clientOptions;
    serviceTimeout: number;
    clusterTimeout: number;
    killTimeout: number;
    private nodeArgs?;
    private statsInterval;
    stats?: Stats;
    /** Services to create */
    private servicesToCreate?;
    private queue;
    private eris;
    private prelimStats?;
    private statsClustersCounted?;
    private chunks?;
    private statsAlreadyStarted?;
    private whatToLog;
    private softKills;
    private launchingManager;
    constructor(options: Options);
    private launch;
    private startService;
    private startCluster;
    private calculateShards;
    private chunk;
    private shutdownWorker;
    private restartWorker;
    private fetchInfo;
    private startStats;
    private broadcast;
    error(message: any): void;
    debug(message: any): void;
    log(message: any): void;
    warn(message: any): void;
}
export {};
