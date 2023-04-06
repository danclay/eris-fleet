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
const cluster_1 = __importDefault(require("cluster"));
class CentralStore {
    constructor(ipc) {
        this.ipc = ipc;
    }
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
    clear() {
        const UUID = "centralStoreClearComplete";
        return new Promise((res) => {
            this.ipc.once(UUID, () => {
                res(undefined);
            });
            this.ipc.sendMessage({ op: "centralStoreClear", UUID });
        });
    }
    delete(key) {
        const UUID = `centralStoreDeleteComplete-${key}`;
        return new Promise((res) => {
            this.ipc.once(UUID, (success) => {
                res(success);
            });
            this.ipc.sendMessage({ op: "centralStoreDelete", UUID });
        });
    }
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
class IPC extends events_1.EventEmitter {
    constructor(setup) {
        super();
        this.fetchTimeout = setup.fetchTimeout;
        this.events = new Map();
        this.ipcEventListeners = new Map();
        this.messageHandler = setup.messageHandler;
        this.centralStore = new CentralStore(this);
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
        if (cluster_1.default.isMaster) {
            this.on("ipcEvent", ipcEventListener);
        }
        else {
            process.on("message", ipcEventListener);
        }
    }
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
    log(message, source) {
        this.sendLog("log", message, source);
    }
    info(message, source) {
        this.sendLog("info", message, source);
    }
    error(message, source) {
        this.sendLog("error", message, source);
    }
    warn(message, source) {
        this.sendLog("warn", message, source);
    }
    debug(message, source) {
        this.sendLog("debug", message, source);
    }
    register(event, callback) {
        const existingEvent = this.events.get(event);
        if (existingEvent) {
            this.events.set(event, existingEvent.concat([callback]));
        }
        else {
            this.events.set(event, [callback]);
        }
    }
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
    broadcast(op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "broadcast", event: { op, msg: message } });
    }
    sendToAdmiral(op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "admiralBroadcast", event: { op, msg: message } });
    }
    admiralBroadcast(op, message) {
        return this.sendToAdmiral(op, message);
    }
    sendTo(cluster, op, message) {
        if (!message)
            message = null;
        this.sendMessage({ op: "sendTo", cluster: cluster, event: { msg: message, op } });
    }
    fetchUser(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchUser", id });
        });
    }
    fetchGuild(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchGuild", id });
        });
    }
    fetchChannel(id) {
        return new Promise((resolve) => {
            this.once(id, (r) => {
                resolve(r);
            });
            this.sendMessage({ op: "fetchChannel", id });
        });
    }
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
    command(service, message, receptive, returnTimeout) {
        return this.serviceCommand(service, message, receptive, returnTimeout);
    }
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
                this.getWorkers().then((workers) => {
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
    getStats() {
        return new Promise((resolve) => {
            const callback = (r) => {
                resolve(r);
            };
            this.once("statsReturn", callback);
            this.sendMessage({ op: "getStats" });
        });
    }
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
    collectStats() {
        return new Promise((resolve) => {
            const callback = (r) => {
                resolve(r);
            };
            this.once("statsReturn", callback);
            this.sendMessage({ op: "executeStats" });
        });
    }
    restartCluster(clusterID, hard) {
        return new Promise((res) => {
            this.once(`clusterReady${clusterID}`, res);
            this.sendMessage({ op: "restartCluster", clusterID, hard: hard ? true : false });
        });
    }
    restartAllClusters(hard) {
        this.sendMessage({ op: "restartAllClusters", hard: hard ? true : false });
    }
    restartService(serviceName, hard) {
        return new Promise((res) => {
            this.once(`serviceReady${serviceName}`, res);
            this.sendMessage({ op: "restartService", serviceName, hard: hard ? true : false });
        });
    }
    restartAllServices(hard) {
        this.sendMessage({ op: "restartAllServices", hard: hard ? true : false });
    }
    shutdownCluster(clusterID, hard) {
        return new Promise((res) => {
            this.once(`clusterShutdown${clusterID}`, res);
            this.sendMessage({ op: "shutdownCluster", clusterID, hard: hard ? true : false });
        });
    }
    shutdownService(serviceName, hard) {
        return new Promise((res) => {
            this.once(`serviceShutdown${serviceName}`, res);
            this.sendMessage({ op: "shutdownService", serviceName, hard: hard ? true : false });
        });
    }
    createService(serviceName, servicePath) {
        return new Promise((res, rej) => {
            if (!path_1.default.isAbsolute(servicePath)) {
                rej("Service path must be absolute!");
                return;
            }
            this.once(`serviceReady${serviceName}`, res);
            this.sendMessage({ op: "createService", serviceName, servicePath });
        });
    }
    totalShutdown(hard) {
        this.sendMessage({ op: "totalShutdown", hard: hard ? true : false });
    }
    reshard(options) {
        return new Promise((res) => {
            this.once("reshardingComplete", res);
            this.sendMessage({ op: "reshard", options });
        });
    }
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