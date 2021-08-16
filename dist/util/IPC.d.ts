/// <reference types="node" />
import { ReshardOptions } from "./../sharding/Admiral";
import { EventEmitter } from "events";
import * as Admiral from "../sharding/Admiral";
export interface IpcHandledLog {
    op: "log" | "error" | "warn" | "debug";
    ipcLogObject: boolean;
    msg: unknown;
    source?: string;
    valueTranslatedFrom?: "Error";
    valueTypeof: string;
    timestamp: number;
}
export declare class IPC extends EventEmitter {
    private events;
    private ipcEventListeners;
    constructor();
    private sendLog;
    /**
     * Sends a log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     */
    log(message: unknown, source?: string): void;
    /**
     * Sends an error log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     */
    error(message: unknown, source?: string): void;
    /**
     * Sends a warn log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     */
    warn(message: unknown, source?: string): void;
    /**
     * Sends a debug log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     */
    debug(message: unknown, source?: string): void;
    /**
     * Register for an event. This will recieve broadcasts and messages sent to this cluster
     * @param event Name of the event
     * @param callback Function run when event is recieved
    */
    register(event: string, callback: (msg: unknown) => void): void;
    /**
     * Unregisters an event
     * @param event Name of the event
    */
    unregister(event: string): void;
    /**
     * Broadcast an event to all clusters and services
     * @param op Name of the event
     * @param message Message to send
    */
    broadcast(op: string, message?: unknown): void;
    /**
     * Broadcast to the master process
     * @param op Name of the event
     * @param message Message to send
    */
    admiralBroadcast(op: string, message?: unknown): void;
    /**
     * Send a message to a specific cluster
     * @param cluster ID of the cluster
     * @param op Name of the event
     * @param message Message to send
    */
    sendTo(cluster: number, op: string, message?: unknown): void;
    /**
     * Fetch a user from the Eris client on any cluster
     * @param id User ID
     * @returns The Eris user object converted to JSON
    */
    fetchUser(id: string): Promise<any>;
    /**
     * Fetch a guild from the Eris client on any cluster
     * @param id Guild ID
     * @returns The Eris guild object converted to JSON
    */
    fetchGuild(id: string): Promise<any>;
    /**
     * Fetch a Channel from the Eris client on any cluster
     * @param id Channel ID
     * @returns The Eris channel object converted to JSON
    */
    fetchChannel(id: string): Promise<any>;
    /**
     * Fetch a user from the Eris client on any cluster
     * @param guildID Guild ID
     * @param memberID the member's user ID
     * @returns The Eris member object converted to JSON
    */
    fetchMember(guildID: string, memberID: string): Promise<any>;
    /**
     * Execute a service command
     * @param service Name of the service
     * @param message Whatever message you want to send with the command
     * @param receptive Whether you expect something to be returned to you from the command
    */
    command(service: string, message?: unknown, receptive?: boolean): Promise<unknown>;
    /**
     * Execute a cluster command
     * @param clusterID ID of the cluster
     * @param message Whatever message you want to send with the command
     * @param receptive Whether you expect something to be returned to you from the command
    */
    clusterCommand(clusterID: string, message?: unknown, receptive?: boolean): Promise<unknown>;
    /**
     * Execute a cluster command on all clusters
     * @param clusterID ID of the cluster
     * @param message Whatever message you want to send with the command
     * @param receptive Whether you expect something to be returned to you from the command. WIll return an object with each response mapped to the cluster's ID
    */
    allClustersCommand(clusterID: string, message?: unknown, receptive?: boolean): Promise<unknown>;
    /**
     * @returns The latest stats
    */
    getStats(): Promise<Admiral.Stats>;
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
    */
    restartCluster(clusterID: number, hard?: boolean): void;
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard?: boolean): void;
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    restartService(serviceName: string, hard?: boolean): void;
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard?: boolean): void;
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownCluster(clusterID: number, hard?: boolean): void;
    /**
     * Shuts down a service
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName: string, hard?: boolean): void;
    /**
     * Create a service
     * @param serviceName Unique ame of the service
     * @param servicePath Absolute path to the service file
     */
    createService(serviceName: string, servicePath: string): void;
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard?: boolean): void;
    /**
     * Reshards all clusters
     * @param options Change the resharding options
    */
    reshard(options?: ReshardOptions): void;
    clusterEval(clusterID: string, stringToEvaluate: string, receptive?: boolean): Promise<unknown>;
}
