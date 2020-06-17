"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
const events_1 = require("events");
class IPC extends events_1.EventEmitter {
    constructor() {
        super();
        this.events = new Map();
        process.on('message', msg => {
            const event = this.events.get(msg.op);
            if (event) {
                event.fn(msg);
            }
        });
    }
    register(event, callback) {
        if (this.events.get(event)) {
            //@ts-ignore
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
        //@ts-ignore
        process.send({ op: "broadcast", event: { op, msg: message } });
    }
    admiralBroadcast(op, message) {
        if (!message)
            message = null;
        //@ts-ignore
        process.send({ op: "admiralBroadcast", event: { op, msg: message } });
    }
    sendTo(cluster, op, message) {
        if (!message)
            message = null;
        //@ts-ignore
        process.send({ op: "sendTo", cluster: cluster, event: { msg: message, op } });
    }
    async fetchUser(id) {
        //@ts-ignore
        process.send({ op: "fetchUser", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                //@ts-ignore
                this.removeListener(id, callback);
                resolve(r);
            };
            //@ts-ignore
            this.on(id, callback);
        });
    }
    async fetchGuild(id) {
        //@ts-ignore
        process.send({ op: "fetchGuild", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                //@ts-ignore
                this.removeListener(id, callback);
                resolve(r);
            };
            //@ts-ignore
            this.on(id, callback);
        });
    }
    async fetchChannel(id) {
        //@ts-ignore
        process.send({ op: "fetchChannel", id });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                //@ts-ignore
                this.removeListener(id, callback);
                resolve(r);
            };
            //@ts-ignore
            this.on(id, callback);
        });
    }
    async fetchMember(guildID, memberID) {
        const UUID = JSON.stringify({ guildID, memberID });
        //@ts-ignore
        process.send({ op: "fetchMember", guildID, memberID });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                //@ts-ignore
                r.id = JSON.parse(r.id).memberID;
                this.removeListener(UUID, callback);
                resolve(r);
            };
            //@ts-ignore
            this.on(UUID, callback);
        });
    }
    async command(service, message, receptive) {
        if (!message)
            message = null;
        if (!receptive)
            receptive = false;
        const UUID = JSON.stringify({ timestamp: Date.now(), message, service, receptive });
        //@ts-ignore
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
                    //@ts-ignore
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
        //@ts-ignore
        process.send({ op: "getStats" });
        return new Promise((resolve, reject) => {
            const callback = (r) => {
                //@ts-ignore
                this.removeListener("statsReturn", callback);
                resolve(r);
            };
            //@ts-ignore
            this.on("statsReturn", callback);
        });
    }
    restartCluster(clusterID, hard) {
        //@ts-ignore
        process.send({ op: "restartCluster", clusterID, hard: hard ? true : false });
    }
    restartAllClusters(hard) {
        //@ts-ignore
        process.send({ op: "restartAllClusters", hard: hard ? true : false });
    }
    restartService(serviceName, hard) {
        //@ts-ignore
        process.send({ op: "restartService", serviceName, hard: hard ? true : false });
    }
    restartAllServices(hard) {
        //@ts-ignore
        process.send({ op: "restartAllServices", hard: hard ? true : false });
    }
    shutdownCluster(clusterID, hard) {
        //@ts-ignore
        process.send({ op: "shutdownCluster", clusterID, hard: hard ? true : false });
    }
    shutdownService(serviceName, hard) {
        //@ts-ignore
        process.send({ op: "shutdownService", serviceName, hard: hard ? true : false });
    }
    /** Total shutdown of fleet */
    totalShutdown(hard) {
        //@ts-ignore
        process.send({ op: "totalShutdown", hard: hard ? true : false });
    }
    reshard() {
        //@ts-ignore
        process.send({ op: "reshard" });
    }
}
exports.IPC = IPC;
//# sourceMappingURL=IPC.js.map