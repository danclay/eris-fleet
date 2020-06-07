"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Admiral = void 0;
const events_1 = require("events");
const os_1 = require("os");
const master = __importStar(require("cluster"));
const cluster_1 = require("cluster");
const Collection_1 = require("../util/Collection");
const Queue_1 = require("../util/Queue");
const Eris = __importStar(require("eris"));
const Cluster_1 = require("../clusters/Cluster");
const Service_1 = require("../services/Service");
const path = __importStar(require("path"));
class Admiral extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.path = options.path;
        this.token = options.token;
        this.guildsPerShard = options.guildsPerShard || 1300;
        this.shardCount = options.shards || 'auto';
        this.clusterCount = options.clusters || 'auto';
        this.clientOptions = options.clientOptions || {};
        this.clusterTimeout = options.clusterTimeout || 5e3;
        this.serviceTimeout = options.serviceTimeout || 0;
        this.killTimeout = options.killTimeout || 0;
        this.nodeArgs = options.nodeArgs;
        this.statsInterval = options.statsInterval || 60e3;
        this.firstShardID = options.firstShardID || 0;
        this.lastShardID = options.lastShardID || 0;
        // Deals with needed components
        if (!options.token)
            throw "No token!";
        if (!path.isAbsolute(options.path))
            throw "The path needs to be absolute!";
        if (options.services) {
            options.services.forEach(e => {
                if (!path.isAbsolute(e.path))
                    throw `Path for service ${e.name} needs to be absolute!`;
                if (options.services.filter(s => s.name == e.name).length > 1)
                    throw `Duplicate service names for service ${e.name}!`;
            });
        }
        if (options.timeout)
            this.clientOptions.connectionTimeout = options.timeout;
        const allLogOptions = ['gateway_shards', 'admiral_start', 'shards_spread', 'stats_update', 'all_clusters_launched', 'all_services_launched', 'cluster_launch', 'service_launch', 'cluster_start', 'service_start', 'service_ready', 'cluster_ready', 'shard_connect', 'shard_ready', 'shard_disconnect', 'shard_resume', 'service_restart', 'cluster_restart', 'service_shutdown', 'cluster_shutdown', 'total_shutdown'];
        this.whatToLog = allLogOptions;
        if (options.lessLogging) {
            this.whatToLog = ['admiral_start', 'shard_disconnect', 'shard_resume', 'cluster_ready', 'service_ready', 'cluster_start', 'all_services_launched', 'all_clusters_launched', 'total_shutdown', 'cluster_shutdown', 'service_shutdown'];
        }
        if (options.whatToLog) {
            if (options.whatToLog.blacklist) {
                options.whatToLog.blacklist.forEach((t) => {
                    if (this.whatToLog.includes(t))
                        this.whatToLog.splice(this.whatToLog.indexOf(t), 1);
                });
            }
            else if (options.whatToLog.whitelist)
                this.whatToLog = options.whatToLog.whitelist;
        }
        if (options.services)
            this.servicesToCreate = options.services;
        this.clusters = new Collection_1.Collection();
        this.services = new Collection_1.Collection();
        this.queue = new Queue_1.Queue();
        this.softKills = new Map();
        this.launchingManager = new Map();
        if (this.statsInterval !== 'disable') {
            this.stats = {
                guilds: 0,
                users: 0,
                clustersRam: 0,
                voice: 0,
                largeGuilds: 0,
                shardCount: 0,
                clusters: []
            };
        }
        if (this.clusterCount === 'auto')
            this.clusterCount = os_1.cpus().length;
        this.eris = new Eris.Client(this.token);
        this.launch();
    }
    launch() {
        if (master.isMaster) {
            process.on("uncaughtException", e => this.error(e));
            process.nextTick(() => {
                if (this.whatToLog.includes('admiral_start'))
                    this.log("Fleet | Started Admiral");
                this.calculateShards().then(shards => {
                    if (this.lastShardID === 0) {
                        this.lastShardID = shards - 1;
                    }
                    this.shardCount = shards;
                    //Chunk
                    let shardsByID = [];
                    for (let i = this.firstShardID; i <= this.lastShardID; i++) {
                        shardsByID.push(i);
                    }
                    this.chunks = this.chunk(shardsByID, Number(this.clusterCount));
                    this.clusterCount = this.chunks.length;
                    if (this.whatToLog.includes('admiral_start'))
                        this.log(`Admiral | Starting ${shards} shard(s) in ${this.clusterCount} cluster(s)`);
                    let opts;
                    if (this.nodeArgs) {
                        opts = {
                            silent: false,
                            execArgv: this.nodeArgs
                        };
                    }
                    else {
                        opts = {
                            silent: false
                        };
                    }
                    master.setupMaster(opts);
                    // Start stuff
                    if (this.servicesToCreate) {
                        this.startService();
                    }
                    else {
                        this.startCluster();
                    }
                });
            });
        }
        else if (master.isWorker) {
            if (process.env.type === "cluster") {
                new Cluster_1.Cluster();
            }
            else if (process.env.type === "service") {
                new Service_1.Service();
            }
        }
        cluster_1.on('message', (worker, message, handle) => {
            var _a;
            if (message.op) {
                switch (message.op) {
                    case "log":
                        this.log(message.msg);
                        break;
                    case "debug":
                        this.debug(message.msg);
                        break;
                    case "error":
                        this.error(message.msg);
                        break;
                    case "warn":
                        this.warn(message.msg);
                        break;
                    case "launched": {
                        const lr = this.launchingManager.get(worker.id);
                        if (lr) {
                            if (lr !== 'launched')
                                lr.waiting();
                            this.launchingManager.delete(worker.id);
                        }
                        else {
                            this.launchingManager.set(worker.id, 'launched');
                        }
                        break;
                    }
                    case "connected": {
                        const workerID = this.queue.queue[0].workerID;
                        if (this.softKills.get(workerID)) {
                            this.softKills.get(workerID).fn();
                        }
                        if (this.queue.queue[1]) {
                            if (this.queue.queue[1].type == "cluster" && this.queue.queue[0].type == "cluster") {
                                setTimeout(() => this.queue.execute(), this.clusterTimeout);
                            }
                            else {
                                this.queue.execute();
                            }
                        }
                        else {
                            this.queue.execute();
                            // Starts the stats
                            if (this.stats && !this.statsAlreadyStarted)
                                this.startStats();
                        }
                        break;
                    }
                    case "shutdown": {
                        const workerID = this.queue.queue[0].workerID;
                        if (this.softKills.get(workerID)) {
                            this.softKills.get(workerID).fn();
                        }
                        break;
                    }
                    case "fetchUser" || "fetchGuild" || "fetchChannel": {
                        this.fetchInfo(message.op, message.id, worker.id);
                        break;
                    }
                    case "fetchMember": {
                        this.fetchInfo("fetchMember", [message.guildID, message.memberID], worker.id);
                        break;
                    }
                    case "serviceCommand": {
                        const service = this.services.get(message.command.service);
                        if (service) {
                            master.workers[service.workerID].send({ op: "command", command: message.command, UUID: worker.id });
                        }
                        else {
                            this.error(`Cluster ${this.clusters.find((c) => c.workerID == worker.id).clusterID} | A service I requested (${message.command.service}) is unavailable.`);
                        }
                        break;
                    }
                    case "return": {
                        const worker = master.workers[message.UUID];
                        if (worker)
                            worker.send({ op: "return", id: message.value.id, value: message.value });
                        break;
                    }
                    case "collectStats": {
                        if (this.prelimStats) {
                            this.prelimStats.guilds += message.stats.guilds;
                            this.prelimStats.users += message.stats.guilds;
                            this.prelimStats.voice += message.stats.voice;
                            this.prelimStats.clustersRam += message.stats.ram;
                            this.prelimStats.largeGuilds += message.stats.largeGuilds;
                            this.prelimStats.shardCount += message.stats.shardStats.length;
                            this.prelimStats.clusters.push(Object.assign(message.stats, { id: this.clusters.find((c) => c.workerID == worker.id).clusterID }));
                            this.statsClustersCounted++;
                        }
                        if (this.statsClustersCounted === this.clusters.size) {
                            const compare = (a, b) => {
                                if (a.id < b.id)
                                    return -1;
                                if (a.id > b.id)
                                    return 1;
                                return 0;
                            };
                            this.stats = Object.assign(this.prelimStats, { clusters: this.prelimStats.clusters.sort(compare) });
                            this.emit("stats", this.stats);
                            if (this.whatToLog.includes('stats_update'))
                                this.log("Admiral | Stats updated.");
                            // Sends the clusters the latest stats
                            this.broadcast("stats", this.stats);
                        }
                        break;
                    }
                    case "getStats": {
                        // Sends the latest stats upon request from the IPC
                        (_a = master.workers[worker.id]) === null || _a === void 0 ? void 0 : _a.send({ op: "return", id: "statsReturn", value: this.stats });
                        break;
                    }
                    case "broadcast": {
                        this.broadcast(message.event.op, message.event.msg);
                        break;
                    }
                    case "sendTo": {
                        const worker = master.workers[this.clusters.get(message.cluster).workerID];
                        if (worker)
                            worker.send({ op: message.event.op, msg: message.event.msg });
                        break;
                    }
                    case "restartCluster": {
                        const workerID = this.clusters.find((c) => c.clusterID == message.clusterID).workerID;
                        if (workerID) {
                            this.restartWorker(master.workers[workerID], true, message.hard ? false : true);
                        }
                        break;
                    }
                    case "restartAllClusters": {
                        this.clusters.forEach(cluster => {
                            process.nextTick(() => {
                                const workerID = this.clusters.find((c) => c.clusterID == cluster.clusterID).workerID;
                                this.restartWorker(master.workers[workerID], true, message.hard ? false : true);
                            });
                        });
                        break;
                    }
                    case "restartService": {
                        const workerID = this.services.find((s) => s.serviceName == message.serviceName).workerID;
                        if (workerID) {
                            this.restartWorker(master.workers[workerID], true, message.hard ? false : true);
                        }
                        break;
                    }
                    case "restartAllServices": {
                        this.services.forEach(service => {
                            process.nextTick(() => {
                                const workerID = this.services.find((s) => s.serviceName == service.serviceName).workerID;
                                this.restartWorker(master.workers[workerID], true, message.hard ? false : true);
                            });
                        });
                        break;
                    }
                    case "shutdownCluster": {
                        const workerID = this.clusters.find((c) => c.clusterID == message.clusterID).workerID;
                        if (workerID) {
                            this.shutdownWorker(master.workers[workerID], message.hard ? false : true);
                        }
                        break;
                    }
                    case "shutdownService": {
                        const workerID = this.services.find((s) => s.serviceName == message.serviceName).workerID;
                        if (workerID) {
                            this.shutdownWorker(master.workers[workerID], message.hard ? false : true);
                        }
                        break;
                    }
                    case "totalShutdown": {
                        if (this.whatToLog.includes('total_shutdown'))
                            this.log("Admiral | Starting total fleet shutdown.");
                        if (message.hard) {
                            if (this.whatToLog.includes('total_shutdown'))
                                this.log("Admiral | Total fleet hard shutdown complete. Ending process.");
                            process.exit(1);
                        }
                        else {
                            let total = 0;
                            this.clusters.forEach(cluster => {
                                total++;
                                process.nextTick(() => {
                                    const workerID = this.clusters.find((c) => c.clusterID == cluster.clusterID).workerID;
                                    this.shutdownWorker(master.workers[workerID], message.hard ? false : true);
                                });
                            });
                            this.services.forEach(service => {
                                total++;
                                process.nextTick(() => {
                                    const workerID = this.services.find((s) => s.serviceName == service.serviceName).workerID;
                                    this.restartWorker(master.workers[workerID], true, message.hard ? false : true);
                                });
                            });
                            let done = 0;
                            cluster_1.on('message', (worker, message) => {
                                if (message.op == 'shutdown') {
                                    done++;
                                    if (this.whatToLog.includes('total_shutdown'))
                                        this.log("Admiral | Total fleet shutdown complete. Ending process.");
                                    if (done == total)
                                        process.exit(1);
                                }
                                ;
                            });
                        }
                        break;
                    }
                }
            }
        });
        cluster_1.on('disconnect', worker => {
            const cluster = this.clusters.find((c) => c.workerID == worker.id);
            const service = this.services.find((s) => s.workerID == worker.id);
            if (cluster) {
                this.warn(`Admiral | Cluster ${cluster.clusterID} disconnected :(`);
            }
            else if (service) {
                this.warn(`Admiral | Service ${service.serviceName} disconnected :(`);
            }
        });
        cluster_1.on('exit', (worker, code, signal) => {
            this.restartWorker(worker);
        });
        this.queue.on("execute", (item) => {
            if (item.message.op == "connect") {
                const lr = this.launchingManager.get(item.workerID);
                if (lr) {
                    master.workers[item.workerID].send(item.message);
                    this.launchingManager.delete(item.workerID);
                }
                else {
                    this.launchingManager.set(item.workerID, { waiting: () => {
                            master.workers[item.workerID].send(item.message);
                        } });
                }
            }
            else {
                master.workers[item.workerID].send(item.message);
            }
        });
    }
    async startService() {
        for (let i = 0; i < this.servicesToCreate.length; i++) {
            const service = this.servicesToCreate[i];
            const worker = master.fork({
                type: "service",
                NODE_ENV: process.env.NODE_ENV
            });
            this.services.set(service.name, {
                workerID: worker.id,
                path: service.path,
                serviceName: service.name
            });
            this.queue.item({
                type: "service",
                workerID: worker.id,
                message: {
                    serviceName: service.name,
                    path: service.path,
                    op: "connect",
                    timeout: this.serviceTimeout,
                    whatToLog: this.whatToLog
                }
            });
            if (this.whatToLog.includes('service_launch'))
                this.log("Admiral | Launching service " + service.name);
        }
        process.nextTick(() => {
            if (this.whatToLog.includes('all_services_launched'))
                this.log("Admiral | All services launched!");
            this.startCluster();
        });
    }
    startCluster() {
        for (let i = 0; i < this.clusterCount; i++) {
            const worker = master.fork({
                type: "cluster",
                NODE_ENV: process.env.NODE_ENV
            });
            this.clusters.set(i, {
                workerID: worker.id,
                firstShardID: 0,
                lastShardID: 0,
                clusterID: i
            });
            if (this.whatToLog.includes('cluster_launch'))
                this.log("Admiral | Launching cluster " + i);
        }
        process.nextTick(() => {
            if (this.whatToLog.includes('all_clusters_launched'))
                this.log("Admiral | All clusters launched!");
            this.chunks.forEach((chunk, clusterID) => {
                const workerID = this.clusters.get(clusterID).workerID;
                this.clusters.set(clusterID, {
                    workerID: workerID,
                    firstShardID: Math.min(...chunk),
                    lastShardID: Math.max(...chunk),
                    clusterID: clusterID
                });
            });
            // Connects shards
            for (let i in [...Array(this.clusterCount).keys()]) {
                const ID = parseInt(i);
                let cluster = this.clusters.get(ID);
                if (!cluster.hasOwnProperty('firstShardID'))
                    break;
                this.queue.item({
                    type: "cluster",
                    workerID: cluster.workerID,
                    message: {
                        clusterID: ID,
                        clusterCount: Number(this.clusterCount),
                        op: "connect",
                        firstShardID: cluster.firstShardID,
                        lastShardID: cluster.lastShardID,
                        shardCount: Number(this.shardCount),
                        token: this.token,
                        path: this.path,
                        clientOptions: this.clientOptions,
                        whatToLog: this.whatToLog
                    }
                });
            }
            if (this.whatToLog.includes('shards_spread'))
                this.log("Admiral | All shards spread!");
        });
    }
    async calculateShards() {
        let shards = this.shardCount;
        if (shards === 'auto') {
            const gateway = await this.eris.getBotGateway();
            if (this.whatToLog.includes('gateway_shards'))
                this.log(`Admiral | Gateway recommends ${gateway.shards} shards.`);
            shards = gateway.shards;
            if (shards === 1) {
                return Promise.resolve(shards);
            }
            else {
                return Promise.resolve(Math.ceil((shards * 1000) / this.guildsPerShard));
            }
        }
        else {
            return Promise.resolve(shards);
        }
    }
    chunk(shards, clusters) {
        if (clusters < 2)
            return [shards];
        const length = shards.length;
        let r = [];
        let i = 0;
        let size;
        if (length % clusters === 0) {
            size = Math.floor(length / clusters);
            while (i < length) {
                r.push(shards.slice(i, i += size));
            }
        }
        else {
            while (i < length) {
                size = Math.ceil((length - i) / clusters--);
                r.push(shards.slice(i, i += size));
            }
        }
        return r;
    }
    shutdownWorker(worker, soft) {
        const cluster = this.clusters.find((c) => c.workerID == worker.id);
        const service = this.services.find((s) => s.workerID == worker.id);
        let item = {
            workerID: worker.id,
            type: 'unknown',
            message: {
                op: "shutdown",
                killTimeout: this.killTimeout
            }
        };
        if (cluster) {
            if (soft) {
                // Preform soft shutdown
                this.softKills.set(worker.id, { fn: () => {
                        this.log(`Admiral | Safely shutdown cluster ${cluster.clusterID}`);
                        worker.kill();
                        this.clusters.delete(cluster.clusterID);
                        this.softKills.delete(worker.id);
                    } });
                if (this.whatToLog.includes('cluster_shutdown'))
                    this.log(`Admiral | Performing soft shutdown of cluster ${cluster.clusterID}`);
            }
            else {
                worker.kill();
                if (this.whatToLog.includes('cluster_shutdown'))
                    this.log(`Admiral | Hard shutdown of cluster ${cluster.clusterID} complete`);
                this.clusters.delete(cluster.clusterID);
            }
            item.type = "cluster";
        }
        else if (service) {
            if (soft) {
                // Preform soft shutdown
                this.softKills.set(worker.id, { fn: () => {
                        this.log(`Admiral | Safely shutdown service ${service.serviceName}`);
                        worker.kill();
                        this.services.delete(service.serviceName);
                        this.softKills.delete(worker.id);
                    } });
                if (this.whatToLog.includes('service_shutdown'))
                    this.log(`Admiral | Performing soft shutdown of service ${service.serviceName}`);
            }
            else {
                worker.kill();
                if (this.whatToLog.includes('service_shutdown'))
                    this.log(`Admiral | Hard shutdown of service ${service.serviceName} complete`);
                this.services.delete(service.serviceName);
            }
            item.type = "cluster";
        }
        if (service || cluster) {
            if (this.queue.queue[0]) {
                if (this.queue.queue[0].workerID == worker.id) {
                    //@ts-ignore
                    this.queue.queue[0] = item;
                    this.queue.execute(true);
                }
                else {
                    //@ts-ignore
                    this.queue.item(item);
                }
            }
            else {
                //@ts-ignore
                this.queue.item(item);
            }
        }
    }
    restartWorker(worker, manual, soft) {
        const cluster = this.clusters.find((c) => c.workerID == worker.id);
        const service = this.services.find((s) => s.workerID == worker.id);
        let item;
        if (cluster) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "cluster"
            });
            if (soft) {
                // Preform soft restart
                this.softKills.set(newWorker.id, { fn: () => {
                        this.log(`Admiral | Killed old worker for cluster ${cluster.clusterID}`);
                        worker.kill();
                        this.clusters.delete(cluster.clusterID);
                        this.clusters.set(cluster.clusterID, Object.assign(cluster, { workerID: newWorker.id }));
                        this.softKills.delete(newWorker.id);
                    } });
                if (this.whatToLog.includes('cluster_restart'))
                    this.log(`Admiral | Performing soft restart of cluster ${cluster.clusterID}`);
            }
            else {
                if (manual) {
                    worker.kill();
                    this.warn(`Admiral | Cluster ${cluster.clusterID} killed upon request`);
                }
                else {
                    this.warn(`Admiral | Cluster ${cluster.clusterID} died :(`);
                }
                this.clusters.delete(cluster.clusterID);
                this.clusters.set(cluster.clusterID, Object.assign(cluster, { workerID: newWorker.id }));
                if (this.whatToLog.includes('cluster_restart'))
                    this.log(`Admiral | Restarting cluster ${cluster.clusterID}`);
            }
            item = {
                workerID: newWorker.id,
                type: "cluster",
                message: {
                    clusterID: cluster.clusterID,
                    clusterCount: Number(this.clusterCount),
                    op: "connect",
                    firstShardID: cluster.firstShardID,
                    lastShardID: cluster.lastShardID,
                    shardCount: Number(this.shardCount),
                    token: this.token,
                    path: this.path,
                    clientOptions: this.clientOptions,
                    whatToLog: this.whatToLog,
                }
            };
        }
        else if (service) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "service"
            });
            if (soft) {
                // Preform soft restart
                this.softKills.set(newWorker.id, { fn: () => {
                        this.log(`Admiral | Killed old worker for service ${service.serviceName}`);
                        worker.kill();
                        this.services.delete(service.serviceName);
                        this.services.set(service.serviceName, Object.assign(service, { workerID: newWorker.id }));
                        this.softKills.delete(newWorker.id);
                    } });
                if (this.whatToLog.includes('service_restart'))
                    this.log(`Admiral | Performing soft restart of service ${service.serviceName}`);
            }
            else {
                if (manual) {
                    worker.kill();
                    this.warn(`Admiral | Service ${service.serviceName} killed upon request`);
                }
                else {
                    this.warn(`Admiral | Service ${service.serviceName} died :(`);
                }
                this.services.delete(service.serviceName);
                this.services.set(service.serviceName, Object.assign(service, { workerID: newWorker.id }));
                if (this.whatToLog.includes('service_restart'))
                    this.log(`Admiral | Restarting service ${service.serviceName}`);
            }
            item = {
                workerID: newWorker.id,
                type: "service",
                message: {
                    serviceName: service.serviceName,
                    path: service.path,
                    op: "connect",
                    timeout: this.serviceTimeout,
                    whatToLog: this.whatToLog
                }
            };
        }
        if (service || cluster && item) {
            if (this.queue.queue[0]) {
                if (this.queue.queue[0].workerID == worker.id) {
                    //@ts-ignore
                    this.queue.queue[0] = item;
                    this.queue.execute(true);
                }
                else {
                    //@ts-ignore
                    this.queue.item(item);
                }
            }
            else {
                //@ts-ignore
                this.queue.item(item);
            }
        }
    }
    fetchInfo(op, id, UUID) {
        for (let i = 0; this.clusters.get(i); i++) {
            process.nextTick(() => {
                const cluster = this.clusters.get(i);
                master.workers[cluster.workerID].send({ op, id, UUID });
            });
        }
    }
    startStats() {
        this.statsAlreadyStarted = true;
        if (this.statsInterval !== "disable") {
            const execute = () => {
                this.prelimStats = {
                    guilds: 0,
                    users: 0,
                    clustersRam: 0,
                    voice: 0,
                    largeGuilds: 0,
                    shardCount: 0,
                    clusters: []
                };
                this.statsClustersCounted = 0;
                this.clusters.forEach((c) => {
                    master.workers[c.workerID].send({ op: "collectStats" });
                });
            };
            setInterval(() => {
                execute();
            }, this.statsInterval);
            // First execution
            execute();
        }
    }
    broadcast(op, msg) {
        this.clusters.forEach((c) => {
            process.nextTick(() => master.workers[c.workerID].send({ op, msg }));
        });
        this.services.forEach((s) => {
            process.nextTick(() => master.workers[s.workerID].send({ op, msg }));
        });
    }
    error(message) {
        this.emit("error", message);
    }
    debug(message) {
        this.emit("debug", message);
    }
    log(message) {
        this.emit("log", message);
    }
    warn(message) {
        this.emit("warn", message);
    }
}
exports.Admiral = Admiral;
//# sourceMappingURL=Admiral.js.map