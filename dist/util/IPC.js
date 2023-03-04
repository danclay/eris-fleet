"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = exports.CentralStore = void 0;
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const Serialization_1 = require("./Serialization");
const path_1 = __importDefault(require("path"));
const Collection_1 = require("../util/Collection");
const cluster_1 = require("cluster");
/** Handles the central data store's IPC functions */
class CentralStore {
    /** @internal */
    constructor(ipc) {
        this.ipc = ipc;
    }
    /**
     * Copy of the central data store map
     * @returns A promise with the central data store map. Note that modifying this map will not modify the central data store.
     */
    copyMap() {
        const UUID = "centralStoreCopyMapComplete";
        return new Promise((res) => {
            this.ipc.once(UUID, (r) => {
                const parsed = new Map(r.map.value);
                res(parsed);
            });
            this.ipc.sendMessage({ op: "centralStoreCopyMap", UUID });
        });
    }
    /**
     * Clears the central
     * @returns A promise which resolves when complete
     */
    clear() {
        const UUID = "centralStoreClearComplete";
        return new Promise((res) => {
            this.ipc.once(UUID, () => {
                res(undefined);
            });
            this.ipc.sendMessage({ op: "centralStoreClear", UUID });
        });
    }
    /**
     * Deletes a key from the central data store
     * @param key The key to delete
     * @returns Promise which resolves a success boolean
     */
    delete(key) {
        const UUID = `centralStoreDeleteComplete-${key}`;
        return new Promise((res) => {
            this.ipc.once(UUID, (success) => {
                res(success);
            });
            this.ipc.sendMessage({ op: "centralStoreDelete", UUID });
        });
    }
    /**
     * Gets a value from the central data store
     * @param key The key to get
     * @returns Promise which resolves with the value
     */
    get(key) {
        const UUID = `centralStoreGetComplete-${key}`;
        return new Promise((res, rej) => {
            this.ipc.once(UUID, (value) => {
                if (value.err) {
                    rej(value.err);
                }
                else {
                    res(value.value);
                }
            });
            this.ipc.sendMessage({ op: "centralStoreGet", key, UUID });
        });
    }
    /**
     * Check whether a key exists in the central data store
     * @param key Key to check
     * @returns Promise which resolves with a boolean
     */
    has(key) {
        const UUID = `centralStoreHasComplete-${key}`;
        return new Promise((res, rej) => {
            this.ipc.once(UUID, (value) => {
                if (value.err) {
                    rej(value.err);
                }
                else {
                    res(value.value);
                }
            });
            this.ipc.sendMessage({ op: "centralStoreHas", key, UUID });
        });
    }
    /**
     * Assign a value to the central data store
     * @param key Unique key to assign this value
     * @param value The value
     * @returns Promise which resolves when complete
     */
    set(key, value) {
        const UUID = `centralStoreSetComplete-${key}`;
        return new Promise((res, rej) => {
            this.ipc.once(UUID, (value) => {
                if (value.err) {
                    rej(value.err);
                }
                else {
                    res();
                }
            });
            this.ipc.sendMessage({ op: "centralStoreSet", key, value, UUID });
        });
    }
}
exports.CentralStore = CentralStore;
/**
 * Handles communication between clusters, services, and the admiral.
 */
class IPC extends events_1.EventEmitter {
    /** @internal */
    constructor(setup) {
        super();
        this.fetchTimeout = setup.fetchTimeout;
        this.events = new Map();
        this.ipcEventListeners = new Map();
        this.messageHandler = setup.messageHandler;
        this.centralStore = new CentralStore(this);
        // register user event listener
        this.ipcEventListeners.set("ipcEvent", [(msg) => {
                const event = this.events.get(msg.event);
                if (event) {
                    event.forEach(fn => {
                        fn(msg.msg);
                    });
                }
            }]);
        const ipcEventListener = (msg) => {
            const event = this.ipcEventListeners.get(msg.op);
            if (event) {
                event.forEach(fn => {
                    fn(msg);
                });
            }
        };
        if (cluster_1.isMaster) {
            this.on("ipcEvent", ipcEventListener);
        }
        else {
            process.on("message", ipcEventListener);
        }
    }
    /** @internal */
    sendMessage(message) {
        if (this.messageHandler) {
            return this.messageHandler(message);
        }
        else if (process.send) {
            process.send(message);
        }
    }
    sendLog(type, value, source) {
        let valueToSend = value;
        let valueTranslatedFrom = undefined;
        if (value instanceof Error) {
            valueTranslatedFrom = "Error";
            valueToSend = (0, Serialization_1.errorToJSON)(value);
        }
        this.sendMessage({
            op: type,
            ipcLogObject: true,
            msg: valueToSend,
            source,
            valueTranslatedFrom,
            valueTypeof: typeof value,
            timestamp: new Date().getTime()
        });
    }
    /**
     * Sends a log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.log("You have reached this line of code");
     * ```
     */
    log(message, source) {
        this.sendLog("log", message, source);
    }
    /**
     * Sends an info log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.info("You might want to take a look at this");
     * ```
     */
    info(message, source) {
        this.sendLog("info", message, source);
    }
    /**
     * Sends an error log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.error(new Error("big yikes"));
     * ```
     */
    error(message, source) {
        this.sendLog("error", message, source);
    }
    /**
     * Sends a warn log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.warn("uh oh!");
     * ```
     */
    warn(message, source) {
        this.sendLog("warn", message, source);
    }
    /**
     * Sends a debug log to the Admiral
     * @param message Item to log
     * @param source Custom error source
     * @example
     * ```js
     * this.ipc.debug("I'm here!");
     * ```
     */
    debug(message, source) {
        this.sendLog("debug", message, source);
    }
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
    register(event, callback) {
        const existingEvent = this.events.get(event);
        if (existingEvent) {
            this.events.set(event, existingEvent.concat([callback]));
        }
        else {
            this.events.set(event, [callback]);
        }
    }
    /**
     * Unregisters an event
     * @param event Name of the event
     * @param callback Function which was listening. Leave empty if you want to delete all listeners registered to this event name.
     * @example
     * ```js
     * this.ipc.unregister("stats");
     * ```
    */
    unregister(event, callback) {
        const eventListeners = this.events.get(event);
        if (!callback || !eventListeners) {
            this.events.delete(event);
            return;
        }
        if (eventListeners.length <= 1) {
            this.events.delete(event);
            return;
        }
        const listenerIndex = eventListeners.findIndex((func) => func === callback);
        if (!listenerIndex && listenerIndex !== 0)
            return;
        eventListeners.splice(listenerIndex, 1);
    }
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
    broadcast(op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "broadcast", event: { op, msg: message } });
    }
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
    sendToAdmiral(op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "admiralBroadcast", event: { op, msg: message } });
    }
    /**
     * @deprecated Use {@link IPC.sendToAdmiral}
    */
    admiralBroadcast(op, message) {
        return this.sendToAdmiral(op, message);
    }
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
    sendTo(cluster, op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "sendTo", cluster: cluster, event: { msg: message, op } });
    }
    /**
     * Fetch a cached user from the Eris client on any cluster
     * @param id User ID
     * @returns The Eris user object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchUser('123456789');
     * ```
    */
    fetchUser(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchUser", id });
        });
    }
    /**
     * Fetch a cached guild from the Eris client on any cluster
     * @param id Guild ID
     * @returns The Eris guild object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchGuild('123456789');
     * ```
    */
    fetchGuild(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchGuild", id });
        });
    }
    /**
     * Fetch a cached channel from the Eris client on any cluster
     * @param id Channel ID
     * @returns The Eris channel object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchChannel('123456789');
     * ```
    */
    fetchChannel(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchChannel", id });
        });
    }
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
    fetchMember(guildID, memberID) {
        const UUID = JSON.stringify({ guildID, memberID });
        return new Promise((resolve) => {
            this.once(UUID, (r) => {
                if (r)
                    r.id = memberID;
                resolve(r);
            });
            this.sendMessage({ op: "fetchMember", id: UUID });
        });
    }
    /**
     * @deprecated Use {@link IPC.serviceCommand}
    */
    command(service, message, receptive, returnTimeout) {
        return this.serviceCommand(service, message, receptive, returnTimeout);
    }
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
    serviceCommand(service, message, receptive, returnTimeout) {
        if (!message)
            message = null;
        if (!receptive)
            receptive = false;
        const UUID = "serviceCommand" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "serviceCommand",
                command: {
                    service,
                    msg: message,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // timeout
                let timeout = undefined;
                const listener = (r) => {
                    if (timeout)
                        clearTimeout(timeout);
                    if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
                        resolve(r.value);
                    }
                    else {
                        if (r.value.err) {
                            reject(r.value.err);
                        }
                        else {
                            resolve(r.value);
                        }
                    }
                };
                timeout = setTimeout(() => {
                    reject("Timeout");
                    this.removeListener(UUID, listener);
                }, returnTimeout ? returnTimeout : this.fetchTimeout);
                this.once(UUID, listener);
                sendCommand();
            });
        }
        else {
            sendCommand();
            return;
        }
    }
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
    clusterCommand(clusterID, message, receptive, returnTimeout) {
        if (!message)
            message = null;
        if (!receptive)
            receptive = false;
        const UUID = "clusterCommand" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "clusterCommand",
                command: {
                    clusterID,
                    msg: message,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // timeout
                let timeout = undefined;
                const listener = (r) => {
                    if (timeout)
                        clearTimeout(timeout);
                    if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
                        resolve(r.value);
                    }
                    else {
                        if (r.value.err) {
                            reject(r.value.err);
                        }
                        else {
                            resolve(r.value);
                        }
                    }
                };
                timeout = setTimeout(() => {
                    reject("Timeout");
                    this.removeListener(UUID, listener);
                }, returnTimeout ? returnTimeout : this.fetchTimeout);
                this.once(UUID, listener);
                sendCommand();
            });
        }
        else {
            sendCommand();
            return;
        }
    }
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
    allClustersCommand(message, receptive, returnTimeout, callback) {
        if (!message)
            message = null;
        if (!receptive)
            receptive = false;
        const UUID = "allClustersCommand" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "allClustersCommand",
                command: {
                    msg: message,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // wait for cluster info first
                this.getWorkers().then((workers) => {
                    // get responses
                    let clustersReturned = 0;
                    const dataReceived = new Map();
                    let timeout = undefined;
                    const dataReturnCallback = (msg) => {
                        if (dataReceived.get(msg.clusterID))
                            return;
                        clustersReturned++;
                        if (callback) {
                            callback(msg.clusterID, msg.value);
                        }
                        dataReceived.set(msg.clusterID, msg.value);
                        // end if done
                        if (clustersReturned === workers.clusters.size) {
                            if (timeout)
                                clearTimeout(timeout);
                            resolve(dataReceived);
                            this.removeListener(UUID, dataReturnCallback);
                        }
                    };
                    timeout = setTimeout(() => {
                        reject("Timeout");
                        this.removeListener(UUID, dataReturnCallback);
                    }, returnTimeout ? returnTimeout : this.fetchTimeout);
                    this.on(UUID, dataReturnCallback);
                    sendCommand();
                });
            });
        }
        else {
            sendCommand();
            return;
        }
    }
    /**
     * @returns The latest stats
    */
    getStats() {
        return new Promise((resolve) => {
            const callback = (r) => {
                resolve(r);
            };
            this.once("statsReturn", callback);
            this.sendMessage({ op: "getStats" });
        });
    }
    /**
     * @returns Collection of clusters and collection of services
     */
    getWorkers() {
        return new Promise((resolve) => {
            const callback = (r) => {
                const parsed = {
                    clusters: new Collection_1.Collection(r.clusters.value),
                    services: new Collection_1.Collection(r.services.value)
                };
                resolve(parsed);
            };
            this.once("workersReturn", callback);
            this.sendMessage({ op: "getWorkers" });
        });
    }
    /**
     * Force eris-fleet to fetch fresh stats
     * @returns Promise with stats
     */
    collectStats() {
        return new Promise((resolve) => {
            const callback = (r) => {
                resolve(r);
            };
            this.once("statsReturn", callback);
            this.sendMessage({ op: "executeStats" });
        });
    }
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the cluster object when it restarts
    */
    restartCluster(clusterID, hard) {
        return new Promise((res) => {
            this.once(`clusterReady${clusterID}`, res);
            this.sendMessage({ op: "restartCluster", clusterID, hard: hard ? true : false });
        });
    }
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard) {
        this.sendMessage({ op: "restartAllClusters", hard: hard ? true : false });
    }
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the service object when it restarts
    */
    restartService(serviceName, hard) {
        return new Promise((res) => {
            this.once(`serviceReady${serviceName}`, res);
            this.sendMessage({ op: "restartService", serviceName, hard: hard ? true : false });
        });
    }
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard) {
        this.sendMessage({ op: "restartAllServices", hard: hard ? true : false });
    }
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the cluster object when it shuts down
    */
    shutdownCluster(clusterID, hard) {
        return new Promise((res) => {
            this.once(`clusterShutdown${clusterID}`, res);
            this.sendMessage({ op: "shutdownCluster", clusterID, hard: hard ? true : false });
        });
    }
    /**
     * Shuts down a service
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
     * @returns Promise which resolves with the service object when it shuts down
    */
    shutdownService(serviceName, hard) {
        return new Promise((res) => {
            this.once(`serviceShutdown${serviceName}`, res);
            this.sendMessage({ op: "shutdownService", serviceName, hard: hard ? true : false });
        });
    }
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
    createService(serviceName, servicePath) {
        return new Promise((res, rej) => {
            // if path is not absolute
            if (!path_1.default.isAbsolute(servicePath)) {
                rej("Service path must be absolute!");
                return;
            }
            this.once(`serviceReady${serviceName}`, res);
            // send to master process
            this.sendMessage({ op: "createService", serviceName, servicePath });
        });
    }
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard) {
        this.sendMessage({ op: "totalShutdown", hard: hard ? true : false });
    }
    /**
     * Reshards all clusters
     * @param options Change the resharding options
     * @returns Promise which resolves when resharding is complete (note that this only resolves when using a service or the Admiral)
    */
    reshard(options) {
        return new Promise((res) => {
            this.once("reshardingComplete", res);
            this.sendMessage({ op: "reshard", options });
        });
    }
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
    clusterEval(clusterID, stringToEvaluate, receptive, returnTimeout) {
        if (!receptive)
            receptive = false;
        const UUID = "clusterEval" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "clusterEval",
                request: {
                    clusterID,
                    stringToEvaluate,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // timeout
                let timeout = undefined;
                const listener = (r) => {
                    if (timeout)
                        clearTimeout(timeout);
                    if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
                        resolve(r.value);
                    }
                    else {
                        if (r.value.err) {
                            reject(r.value.err);
                        }
                        else {
                            resolve(r.value);
                        }
                    }
                };
                timeout = setTimeout(() => {
                    reject("Timeout");
                    this.removeListener(UUID, listener);
                }, returnTimeout ? returnTimeout : this.fetchTimeout);
                this.once(UUID, listener);
                sendCommand();
            });
        }
        else {
            sendCommand();
            return;
        }
    }
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
    allClustersEval(stringToEvaluate, receptive, returnTimeout, callback) {
        if (!receptive)
            receptive = false;
        const UUID = "allClustersEval" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "allClustersEval",
                request: {
                    stringToEvaluate: stringToEvaluate,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                this.getWorkers().then((workers) => {
                    // get responses
                    let clustersReturned = 0;
                    const datareceived = new Map();
                    let timeout = undefined;
                    const dataReturnCallback = (msg) => {
                        if (datareceived.get(msg.clusterID))
                            return;
                        clustersReturned++;
                        if (callback) {
                            callback(msg.clusterID, msg.value);
                        }
                        datareceived.set(msg.clusterID, msg.value);
                        // end if done
                        if (clustersReturned === workers.clusters.size) {
                            if (timeout)
                                clearTimeout(timeout);
                            resolve(datareceived);
                            this.removeListener(UUID, dataReturnCallback);
                        }
                    };
                    timeout = setTimeout(() => {
                        reject("Timeout");
                        this.removeListener(UUID, dataReturnCallback);
                    }, returnTimeout ? returnTimeout : this.fetchTimeout);
                    this.on(UUID, dataReturnCallback);
                    sendCommand();
                });
            });
        }
        else {
            sendCommand();
            return;
        }
    }
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
    serviceEval(serviceName, stringToEvaluate, receptive, returnTimeout) {
        if (!receptive)
            receptive = false;
        const UUID = "serviceEval" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            this.sendMessage({ op: "serviceEval",
                request: {
                    serviceName,
                    stringToEvaluate,
                    UUID,
                    receptive
                }
            });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // timeout
                let timeout = undefined;
                const listener = (r) => {
                    if (timeout)
                        clearTimeout(timeout);
                    if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
                        resolve(r.value);
                    }
                    else {
                        if (r.value.err) {
                            reject(r.value.err);
                        }
                        else {
                            resolve(r.value);
                        }
                    }
                };
                timeout = setTimeout(() => {
                    reject("Timeout");
                    this.removeListener(UUID, listener);
                }, returnTimeout ? returnTimeout : this.fetchTimeout);
                this.once(UUID, listener);
                sendCommand();
            });
        }
        else {
            sendCommand();
            return;
        }
    }
}
exports.IPC = IPC;
//# sourceMappingURL=IPC.js.map