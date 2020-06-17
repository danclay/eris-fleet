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
                event.fn(msg);
            }
        });
    }
    register(event, callback) {
        if (this.events.get(event)) {
            if (process.send)
                process.send({ op: "error", msg: "IPC | Can't register 2 events with the same name." });
        }
        else {
            this.events.set(event, { fn: callback });
        }
    }
    unregister(event) {
        this.events.delete(event);
    }
    broadcast(op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "broadcast", event: { op, msg: message } });
    }
    admiralBroadcast(op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "admiralBroadcast", event: { op, msg: message } });
    }
    sendTo(cluster, op, message) {
        if (!message)
            message = null;
        if (process.send)
            process.send({ op: "sendTo", cluster: cluster, event: { msg: message, op } });
    }
    async fetchUser(id) {
        if (process.send)
            process.send({ op: "fetchUser", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id.toString(), callback);
                resolve(r);
            };
            this.on(id.toString(), callback);
        });
    }
    async fetchGuild(id) {
        if (process.send)
            process.send({ op: "fetchGuild", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id.toString(), callback);
                resolve(r);
            };
            this.on(id.toString(), callback);
        });
    }
    async fetchChannel(id) {
        if (process.send)
            process.send({ op: "fetchChannel", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                this.removeListener(id.toString(), callback);
                resolve(r);
            };
            this.on(id.toString(), callback);
        });
    }
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
                    if (r.value.err) {
                        reject(r.value.err);
                    }
                    else {
                        resolve(r.value);
                    }
                };
                this.on(UUID, callback);
            });
        }
    }
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
    restartCluster(clusterID, hard) {
        if (process.send)
            process.send({ op: "restartCluster", clusterID, hard: hard ? true : false });
    }
    restartAllClusters(hard) {
        if (process.send)
            process.send({ op: "restartAllClusters", hard: hard ? true : false });
    }
    restartService(serviceName, hard) {
        if (process.send)
            process.send({ op: "restartService", serviceName, hard: hard ? true : false });
    }
    restartAllServices(hard) {
        if (process.send)
            process.send({ op: "restartAllServices", hard: hard ? true : false });
    }
    shutdownCluster(clusterID, hard) {
        if (process.send)
            process.send({ op: "shutdownCluster", clusterID, hard: hard ? true : false });
    }
    shutdownService(serviceName, hard) {
        if (process.send)
            process.send({ op: "shutdownService", serviceName, hard: hard ? true : false });
    }
    /** Total shutdown of fleet */
    totalShutdown(hard) {
        if (process.send)
            process.send({ op: "totalShutdown", hard: hard ? true : false });
    }
    reshard() {
        if (process.send)
            process.send({ op: "reshard" });
    }
}
exports.IPC = IPC;
//# sourceMappingURL=IPC.js.map