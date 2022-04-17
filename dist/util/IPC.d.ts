/// <reference types="node" />
import { EventEmitter } from "events";
import { ClusterCollection, ServiceCollection, Stats, ReshardOptions } from "../sharding/Admiral";
import { Collection } from "../util/Collection";
export interface IpcHandledLog {
    op: "log" | "info" | "error" | "warn" | "debug";
    ipcLogObject: boolean;
    msg: unknown;
    source?: string;
    valueTranslatedFrom?: "Error";
    valueTypeof: string;
    timestamp: number;
}
/** @internal */
export interface Setup {
    fetchTimeout: number;
    messageHandler?: (message: any) => void;
}
/** Handles the central data store's IPC functions */
export declare class CentralStore {
    private ipc;
    /** @internal */
    constructor(ipc: IPC);
    /**
     * Copy of the central data store map
     * @returns A promise with the central data store map. Note that modifying this map will not modify the central data store.
     */
    copyMap(): Promise<Map<string, any>>;
    /**
     * Clears the central
     * @returns A promise which resolves when complete
     */
    clear(): Promise<undefined>;
    /**
     * Deletes a key from the central data store
     * @param key The key to delete
     * @returns Promise which resolves a success boolean
     */
    delete(key: string): Promise<boolean>;
    /**
     * Gets a value from the central data store
     * @param key The key to get
     * @returns Promise which resolves with the value
     */
    get(key: string): Promise<any>;
    /**
     * Check whether a key exists in the central data store
     * @param key Key to check
     * @returns Promise which resolves with a boolean
     */
    has(key: string): Promise<boolean>;
    /**
     * Assign a value to the central data store
     * @param key Unique key to assign this value
     * @param value The value
     * @returns Promise which resolves when complete
     */
    set(key: string, value: unknown): Promise<void>;
}
/**
 * Handles communication between clusters, services, and the admiral.
 */
export declare class IPC extends EventEmitter {
    private events;
    private ipcEventListeners;
    private fetchTimeout;
    private messageHandler?;
    centralStore: CentralStore;
    /** @internal */
    constructor(setup: Setup);
    /** @internal */
    sendMessage(message: unknown): void;
    private sendLog;
    /**
     * Sends a log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.log("You have reached this line of code");
     * ```
     */
    log(message: unknown, source?: string): void;
    /**
     * Sends an info log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.info("You might want to take a look at this");
     * ```
     */
    info(message: unknown, source?: string): void;
    /**
     * Sends an error log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.error(new Error("big yikes"));
     * ```
     */
    error(message: unknown, source?: string): void;
    /**
     * Sends a warn log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.warn("uh oh!");
     * ```
     */
    warn(message: unknown, source?: string): void;
    /**
     * Sends a debug log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.debug("I'm here!");
     * ```
     */
    debug(message: unknown, source?: string): void;
    /**
     * Register for an event. This will receive broadcasts and messages sent to this cluster. This will also receive Admiral events if broadcastAdmiralEvents is enabled in options.
     * Events can be sent using {@link sendTo} and {@link broadcast}
     * @param event Name of the event
     * @param callback Function run when event is received
     * @example
     * ```js
     * this.ipc.register("hello!", (message) => {
     * 	// Do stuff
     * 	console.log(message);
     * });
     * ```
    */
    register(event: string, callback: (msg: any) => void): void;
    /**
     * Unregisters an event
     * @param event Name of the event
     * @param callback Function which was listening. Leave empty if you want to delete all listeners registered to this event name.
     * @example
     * ```js
     * this.ipc.unregister("stats");
     * ```
    */
    unregister(event: string, callback?: (msg: any) => void): void;
    /**
     * Broadcast an event to all clusters and services.
     * The event can be listened to with {@link register}
     * @param op Name of the event
     * @param message Message to send
     * @example
     * ```js
     * this.ipc.broadcast("hello clusters!", "Want to chat?");
     * ```
    */
    broadcast(op: string, message?: unknown): void;
    /**
     * Send to the master process.
     * The event can be listened to using `Admiral.on("event", listener);`
     * @param op Name of the event
     * @param message Message to send
     * @example
     * ```js
     * this.ipc.sendToAdmiral("Hello", "I'm working!");
     * ```
    */
    sendToAdmiral(op: string, message?: unknown): void;
    /**
     * @deprecated Use {@link IPC.sendToAdmiral}
    */
    admiralBroadcast(op: string, message?: unknown): void;
    /**
     * Send a message to a specific cluster.
     * The event can be listened to with {@link register}
     * @param cluster ID of the cluster
     * @param op Name of the event
     * @param message Message to send
     * @example
     * ```js
     * this.ipc.sendTo(1, "Hello cluster 1!", "Squad up?");
     * ```
    */
    sendTo(cluster: number, op: string, message?: unknown): void;
    /**
     * Fetch a cached user from the Eris client on any cluster
     * @param id User ID
     * @returns The Eris user object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchUser('123456789');
     * ```
    */
    fetchUser(id: string): Promise<any>;
    /**
     * Fetch a cached guild from the Eris client on any cluster
     * @param id Guild ID
     * @returns The Eris guild object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchGuild('123456789');
     * ```
    */
    fetchGuild(id: string): Promise<any>;
    /**
     * Fetch a cached channel from the Eris client on any cluster
     * @param id Channel ID
     * @returns The Eris channel object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchChannel('123456789');
     * ```
    */
    fetchChannel(id: string): Promise<any>;
    /**
     * Fetch a cached member from the Eris client on any cluster
     * @param guildID Guild ID
     * @param memberID the member's user ID
     * @returns The Eris member object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchMember('123456789', '987654321');
     * ```
    */
    fetchMember(guildID: string, memberID: string): Promise<any>;
    /**
     * @deprecated Use {@link IPC.serviceCommand}
    */
    command(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    /**
     * Execute a service command
     * @param service Name of the service
     * @param message Whatever message you want to send with the command (defaults to `null`)
     * @param receptive Whether you expect something to be returned to you from the command  (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @returns Promise with data if `receptive = true`
     * @example
     * ```js
     * this.ipc.serviceCommand("ServiceName", "hello service!", true)
     * .then((message) => console.log(message))
     * .catch((error) => this.ipc.error(error));
     * ```
    */
    serviceCommand(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    /**
     * Execute a cluster command
     * @param clusterID ID of the cluster
     * @param message Whatever message you want to send with the command (defaults to `null`)
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @returns Promise with data if `receptive = true`
     * @example
     * ```js
     * this.ipc.clusterCommand(1, "hello cluster!", true)
     * .then((message) => console.log(message))
     * .catch((error) => this.ipc.error(error));
     * ```
    */
    clusterCommand(clusterID: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    /**
     * Execute a cluster command on all clusters
     *
     * @param message Whatever message you want to send with the command (defaults to `null`)
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @param callback Function which will be run everytime a new command return is received
     * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
     * @example
     * ```js
     * this.ipc.allClustersCommand("hello clusters!", true, undefined, (id, data) => {
     * 	console.log(`I just received ${data} from ${id}!`);
     * })
     * .then((data) => this.ipc.log(`All my clusters responded and my data in a map. Here is the data from cluster 0: ${data.get(0)}`))
     * .catch((error) => this.ipc.error(error));
     * ```
    */
    allClustersCommand(message?: unknown, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void;
    /**
     * @returns The latest stats
    */
    getStats(): Promise<Stats>;
    /**
     * @returns Collection of clusters and collection of services
     */
    getWorkers(): Promise<{
        clusters: Collection<number, ClusterCollection>;
        services: Collection<string, ServiceCollection>;
    }>;
    /**
     * Force eris-fleet to fetch fresh stats
     * @returns Promise with stats
     */
    collectStats(): Promise<Stats>;
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the cluster object when it restarts
    */
    restartCluster(clusterID: number, hard?: boolean): Promise<ClusterCollection | undefined>;
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard?: boolean): void;
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the service object when it restarts
    */
    restartService(serviceName: string, hard?: boolean): Promise<ServiceCollection | undefined>;
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard?: boolean): void;
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the cluster object when it shuts down
    */
    shutdownCluster(clusterID: number, hard?: boolean): Promise<ClusterCollection | undefined>;
    /**
     * Shuts down a service
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the service object when it shuts down
    */
    shutdownService(serviceName: string, hard?: boolean): Promise<ServiceCollection | undefined>;
    /**
     * Create a service
     * @param serviceName Unique ame of the service
     * @param servicePath Absolute path to the service file
     * @example
     * ```js
     * const path = require("path");
     * this.ipc.createService("myService", path.join(__dirname, "./service.js"))
     * ```
     * @returns Promise which resolves with the service object when it is ready
     */
    createService(serviceName: string, servicePath: string): Promise<ServiceCollection | undefined>;
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard?: boolean): void;
    /**
     * Reshards all clusters
     * @param options Change the resharding options
     * @returns Promise which resolves when resharding is complete (note that this only resolves when using a service or the Admiral)
    */
    reshard(options?: ReshardOptions): Promise<void>;
    /**
     * Sends an eval to the mentioned cluster.
     * The eval occurs from a function within the BaseClusterWorker class.
     * NOTE: Use evals sparingly as they are a major security risk
     * @param clusterID ID of the cluster
     * @param stringToEvaluate String to send to eval
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @returns Promise with result if `receptive = true`
     * @example
     * ```js
     * this.ipc.clusterEval(1, "return 'hey!'", true)
     * .then((data) => this.ipc.log(data))
     * .catch((error) => this.ipc.error(error));
     * ```
     */
    clusterEval(clusterID: number, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    /**
     * Sends an eval to all clusters.
     * The eval occurs from a function within the BaseClusterWorker class.
     * NOTE: Use evals sparingly as they are a major security risk
     * @param stringToEvaluate String to send to eval
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @param callback Function which will be run everytime a new command return is received
     * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
     * @example
     * ```js
     * this.ipc.allClustersCommand("return 'heyo!'", true, undefined, (id, data) => {
     * 	console.log(`I just received ${data} from ${id}!`);
     * })
     * .then((data) => this.ipc.log(`All my clusters responded and my data in a map. Here is the data from cluster 0: ${data.get(0)}`))
     * .catch((error) => this.ipc.error(error));
     * ```
    */
    allClustersEval(stringToEvaluate: string, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void;
    /**
     * Sends an eval to the mentioned service.
     * The eval occurs from a function within the BaseServiceWorker class.
     * NOTE: Use evals sparingly as they are a major security risk
     * @param serviceName Name of the service
     * @param stringToEvaluate String to send to eval
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @returns Promise with result if `receptive = true`
     * @example
     * ```js
     * this.ipc.serviceEval(1, "return 'hey!'", true)
     * .then((data) => this.ipc.log(data))
     * .catch((error) => this.ipc.error(error));
     * ```
     */
    serviceEval(serviceName: string, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
}
