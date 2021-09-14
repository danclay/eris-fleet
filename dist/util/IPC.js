"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
const ErrorHandler_1 = require("./ErrorHandler");
const path_1 = __importDefault(require("path"));
const Collection_1 = require("../util/Collection");
/**
 * Handles communication between clusters, services, and the admiral.
 */
class IPC extends events_1.EventEmitter {
    constructor(setup) {
        super();
        this.fetchTimeout = setup.fetchTimeout;
        this.events = new Map();
        this.ipcEventListeners = new Map();
        // register user event listener
        this.ipcEventListeners.set("ipcEvent", [(msg) => {
                const event = this.events.get(msg.event);
                if (event) {
                    event.forEach(fn => {
                        fn(msg.msg);
                    });
                }
            }]);
        process.on("message", msg => {
            const event = this.ipcEventListeners.get(msg.op);
            if (event) {
                event.forEach(fn => {
                    fn(msg);
                });
            }
        });
    }
    sendLog(type, value, source) {
        let valueToSend = value;
        let valueTranslatedFrom = undefined;
        if (value instanceof Error) {
            valueTranslatedFrom = "Error";
            valueToSend = ErrorHandler_1.errorToJSON(value);
        }
        if (process.send)
            process.send({
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
     * Register for an event. This will recieve broadcasts and messages sent to this cluster.
     * Events can be sent using {@link sendTo} and {@link broadcast}
     * @param event Name of the event
     * @param callback Function run when event is recieved
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
        if (process.send)
            process.send({ op: "broadcast", event: { op, msg: message } });
    }
    /**
     * Broadcast to the master process.
     * The event can be listened to using `Admiral.on("event", callback);`
     * @param op Name of the event
     * @param message Message to send
     * @example
     * ```js
     * this.ipc.admiralBroadcast("Hello", "I'm working!");
     * ```
    */
    admiralBroadcast(op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "admiralBroadcast", event: { op, msg: message } });
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
        if (process.send)
            process.send({ op: "sendTo", cluster: cluster, event: { msg: message, op } });
    }
    /**
     * Fetch a user from the Eris client on any cluster
     * @param id User ID
     * @returns The Eris user object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchUser('123456789');
     * ```
    */
    fetchUser(id) {
        if (process.send)
            process.send({ op: "fetchUser", id });
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
        });
    }
    /**
     * Fetch a guild from the Eris client on any cluster
     * @param id Guild ID
     * @returns The Eris guild object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchGuild('123456789');
     * ```
    */
    fetchGuild(id) {
        if (process.send)
            process.send({ op: "fetchGuild", id });
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
        });
    }
    /**
     * Fetch a Channel from the Eris client on any cluster
     * @param id Channel ID
     * @returns The Eris channel object converted to JSON
     * @example
     * ```js
     * await this.ipc.fetchChannel('123456789');
     * ```
    */
    fetchChannel(id) {
        if (process.send)
            process.send({ op: "fetchChannel", id });
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
        });
    }
    /**
     * Fetch a user from the Eris client on any cluster
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
        if (process.send)
            process.send({ op: "fetchMember", id: UUID });
        return new Promise((resolve) => {
            this.once(UUID, (r) => {
                if (r)
                    r.id = memberID;
                resolve(r);
            });
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
        if (process.send)
            process.send({ op: "serviceCommand",
                command: {
                    service,
                    msg: message,
                    UUID,
                    receptive
                }
            });
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
            });
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
        if (process.send)
            process.send({ op: "clusterCommand",
                command: {
                    clusterID,
                    msg: message,
                    UUID,
                    receptive
                }
            });
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
            });
        }
    }
    /**
     * Execute a cluster command on all clusters
     *
     * @param message Whatever message you want to send with the command (defaults to `null`)
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @param callback Function which will be run everytime a new command return is recieved
     * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
     * @example
     * ```js
     * this.ipc.allClustersCommand("hello clusters!", true, undefined, (id, data) => {
     * 	console.log(`I just recieved ${data} from ${id}!`);
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
        const UUID = "allClusterCommand" + crypto_1.default.randomBytes(16).toString("hex");
        const sendCommand = () => {
            if (process.send)
                process.send({ op: "allClustersCommand",
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
                new Promise((res) => {
                    if (process.send)
                        process.send({ op: "getAdmiralInfo" });
                    this.once("admiralInfo", data => {
                        res(data.clusters);
                    });
                }).then((clusterInfo) => {
                    sendCommand();
                    // get responses
                    let clustersReturned = 0;
                    const dataRecieved = new Map();
                    let timeout = undefined;
                    const dataReturnCallback = (msg) => {
                        if (dataRecieved.get(msg.clusterID))
                            return;
                        clustersReturned++;
                        if (callback) {
                            callback(msg.clusterID, msg.value);
                        }
                        dataRecieved.set(msg.clusterID, msg.value);
                        // end if done
                        if (clustersReturned === Object.keys(clusterInfo).length) {
                            if (timeout)
                                clearTimeout(timeout);
                            resolve(dataRecieved);
                            this.removeListener(UUID, dataReturnCallback);
                        }
                    };
                    timeout = setTimeout(() => {
                        reject("Timeout");
                        this.removeListener(UUID, dataReturnCallback);
                    }, returnTimeout ? returnTimeout : this.fetchTimeout);
                    this.on(UUID, dataReturnCallback);
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
        if (process.send)
            process.send({ op: "getStats" });
        return new Promise((resolve) => {
            const callback = (r) => {
                //this.removeListener("statsReturn", callback);
                resolve(r);
            };
            this.once("statsReturn", callback);
        });
    }
    /**
     * @returns Collection of clusters and collection of services
     */
    getWorkers() {
        if (process.send)
            process.send({ op: "getWorkers" });
        return new Promise((resolve) => {
            const callback = (r) => {
                const parsed = {
                    clusters: new Collection_1.Collection(r.clusters.value),
                    services: new Collection_1.Collection(r.services.value)
                };
                resolve(parsed);
            };
            this.once("workersReturn", callback);
        });
    }
    /**
     * Force eris-fleet to fetch fresh stats
     * @returns Promise with stats
     */
    collectStats() {
        if (process.send)
            process.send({ op: "executeStats" });
        return new Promise((resolve) => {
            const callback = (r) => {
                resolve(r);
            };
            this.once("statsReturn", callback);
        });
    }
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
    */
    restartCluster(clusterID, hard) {
        if (process.send)
            process.send({ op: "restartCluster", clusterID, hard: hard ? true : false });
    }
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard) {
        if (process.send)
            process.send({ op: "restartAllClusters", hard: hard ? true : false });
    }
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    restartService(serviceName, hard) {
        if (process.send)
            process.send({ op: "restartService", serviceName, hard: hard ? true : false });
    }
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard) {
        if (process.send)
            process.send({ op: "restartAllServices", hard: hard ? true : false });
    }
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownCluster(clusterID, hard) {
        if (process.send)
            process.send({ op: "shutdownCluster", clusterID, hard: hard ? true : false });
    }
    /**
     * Shuts down a service
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName, hard) {
        if (process.send)
            process.send({ op: "shutdownService", serviceName, hard: hard ? true : false });
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
     */
    createService(serviceName, servicePath) {
        // if path is not absolute
        if (!path_1.default.isAbsolute(servicePath)) {
            this.error("Service path must be absolute!");
            return;
        }
        // send to master process
        if (process.send)
            process.send({ op: "createService", serviceName, servicePath });
    }
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard) {
        if (process.send)
            process.send({ op: "totalShutdown", hard: hard ? true : false });
    }
    /**
     * Reshards all clusters
     * @param options Change the resharding options
    */
    reshard(options) {
        if (process.send)
            process.send({ op: "reshard", options });
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
        if (process.send)
            process.send({ op: "clusterEval",
                request: {
                    clusterID,
                    stringToEvaluate,
                    UUID,
                    receptive
                }
            });
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
            });
        }
    }
    /**
     * Sends an eval to all clusters.
     * The eval occurs from a function within the BaseClusterWorker class.
     * NOTE: Use evals sparingly as they are a major security risk
     * @param stringToEvaluate String to send to eval
     * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
     * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
     * @param callback Function which will be run everytime a new command return is recieved
     * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
     * @example
     * ```js
     * this.ipc.allClustersCommand("return 'heyo!'", true, undefined, (id, data) => {
     * 	console.log(`I just recieved ${data} from ${id}!`);
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
            if (process.send)
                process.send({ op: "allClustersEval",
                    request: {
                        stringToEvaluate: stringToEvaluate,
                        UUID,
                        receptive
                    }
                });
        };
        if (receptive) {
            return new Promise((resolve, reject) => {
                // wait for cluster info first
                new Promise((res) => {
                    if (process.send)
                        process.send({ op: "getAdmiralInfo" });
                    this.once("admiralInfo", data => {
                        res(data.clusters);
                    });
                }).then((clusterInfo) => {
                    sendCommand();
                    // get responses
                    let clustersReturned = 0;
                    const dataRecieved = new Map();
                    let timeout = undefined;
                    const dataReturnCallback = (msg) => {
                        if (dataRecieved.get(msg.clusterID))
                            return;
                        clustersReturned++;
                        if (callback) {
                            callback(msg.clusterID, msg.value);
                        }
                        dataRecieved.set(msg.clusterID, msg.value);
                        // end if done
                        if (clustersReturned === Object.keys(clusterInfo).length) {
                            if (timeout)
                                clearTimeout(timeout);
                            resolve(dataRecieved);
                            this.removeListener(UUID, dataReturnCallback);
                        }
                    };
                    timeout = setTimeout(() => {
                        reject("Timeout");
                        this.removeListener(UUID, dataReturnCallback);
                    }, returnTimeout ? returnTimeout : this.fetchTimeout);
                    this.on(UUID, dataReturnCallback);
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
        if (process.send)
            process.send({ op: "serviceEval",
                request: {
                    serviceName,
                    stringToEvaluate,
                    UUID,
                    receptive
                }
            });
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
            });
        }
    }
}
exports.IPC = IPC;
//# sourceMappingURL=IPC.js.map