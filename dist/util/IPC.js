"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
const events_1 = require("events");
class IPC extends events_1.EventEmitter {
    constructor() {
        super();
        this.events = new Map();
        process.on("message", msg => {
            const event = this.events.get(msg.op);
            if (event) {
                event.forEach(fn => {
                    fn(msg);
                });
            }
        });
    }
    /**
     * Register for an event. This will recieve broadcasts and messages sent to this cluster
     * @param event Name of the event
     * @param callback Function run when event is recieved
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
    */
    unregister(event) {
        this.events.delete(event);
    }
    /**
     * Broadcast an event to all clusters and services
     * @param op Name of the event
     * @param message Message to send
    */
    broadcast(op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "broadcast", event: { op, msg: message } });
    }
    /**
     * Broadcast to the master process
     * @param op Name of the event
     * @param message Message to send
    */
    admiralBroadcast(op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "admiralBroadcast", event: { op, msg: message } });
    }
    /**
     * Send a message to a specific cluster
     * @param cluster ID of the cluster
     * @param op Name of the event
     * @param message Message to send
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
    */
    async fetchUser(id) {
        if (process.send)
            process.send({ op: "fetchUser", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id, callback);
                resolve(r);
            };
            this.on(id, callback);
        });
    }
    /**
     * Fetch a guild from the Eris client on any cluster
     * @param id Guild ID
     * @returns The Eris guild object converted to JSON
    */
    async fetchGuild(id) {
        if (process.send)
            process.send({ op: "fetchGuild", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id, callback);
                resolve(r);
            };
            this.on(id, callback);
        });
    }
    /**
     * Fetch a Channel from the Eris client on any cluster
     * @param id Channel ID
     * @returns The Eris channel object converted to JSON
    */
    async fetchChannel(id) {
        if (process.send)
            process.send({ op: "fetchChannel", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id, callback);
                resolve(r);
            };
            this.on(id, callback);
        });
    }
    /**
     * Fetch a user from the Eris client on any cluster
     * @param guildID Guild ID
     * @param memberID the member's user ID
     * @returns The Eris member object converted to JSON
    */
    async fetchMember(guildID, memberID) {
        const UUID = JSON.stringify({ guildID, memberID });
        if (process.send)
            process.send({ op: "fetchMember", id: UUID });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                if (r)
                    r.id = memberID;
                this.removeListener(UUID, callback);
                resolve(r);
            };
            this.on(UUID, callback);
        });
    }
    /**
     * Execute a service command
     * @param service Name of the service
     * @param message Whatever message you want to send with the command
     * @param receptive Whether you expect something to be returned to you from the command
    */
    async command(service, message, receptive) {
        if (!message)
            message = null;
        if (!receptive)
            receptive = false;
        const UUID = JSON.stringify({ timestamp: Date.now(), message, service, receptive });
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
                const callback = (r) => {
                    this.removeListener(UUID, callback);
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
                this.on(UUID, callback);
            });
        }
    }
    /**
     * @returns The latest stats
    */
    async getStats() {
        if (process.send)
            process.send({ op: "getStats" });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener("statsReturn", callback);
                resolve(r);
            };
            if (process.send)
                this.on("statsReturn", callback);
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
     * Shuts down a cluster
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName, hard) {
        if (process.send)
            process.send({ op: "shutdownService", serviceName, hard: hard ? true : false });
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
    */
    reshard() {
        if (process.send)
            process.send({ op: "reshard" });
    }
}
exports.IPC = IPC;
//# sourceMappingURL=IPC.js.map