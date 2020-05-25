import { EventEmitter } from 'events';
import {cpus} from 'os';
import * as master from 'cluster';
import {on} from 'cluster';
import {Collection} from '../util/Collection';
import {Queue} from '../util/Queue';
import * as Eris from 'eris';
import {Cluster} from '../clusters/Cluster';
import {Service} from '../services/Service';
import {UUID as Gen} from '../util/UUID';
import { runInThisContext } from 'vm';
import * as path from 'path';

interface ServiceCreator {
    name: string;
    path: string;
}

interface Options {
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
    exclusiveGuilds: number;
    ram: number;
    shardStats: ShardStats[] | [];
}

interface Stats {
    guilds: number;
    users: number;
    clustersRam: number;
    voice: number;
    largeGuilds: number;
    shardCount: number;
    clusters: ClusterStats[];
}

interface ClusterCollection {
    workerID: number;
    firstShardID: number;
    lastShardID: number;
    clusterID: number;
}

interface ServiceCollection {
    serviceName: string;
    workerID: number;
    path: string;
}

export class Admiral extends EventEmitter {
    /** Map of clusters by  to worker by ID */
    public clusters: Collection;
    /** Map of services by name to worker ID */
    public services: Collection;
    /** Array of callbacks */
    private callbacks: Map<string, number>;
    private path: string;
    private token: string;
    public guildsPerShard: number;
    public shardCount: number | 'auto';
    public clusterCount: number | 'auto';
    public lastShardID: number;
    public firstShardID: number;
    private clientOptions: Eris.ClientOptions;
    public serviceTimeout: number;
    public clusterTimeout: number;
    private nodeArgs?: string[];
    private statsInterval: number | 'disable';
    public stats?: Stats;
    /** Services to create */
    private servicesToCreate?: ServiceCreator[];
    private queue: Queue;
    private eris: Eris.Client;
    private prelimStats?: Stats;
    private statsClustersCounted?: number;
    private chunks?: number[][];
    private statsAlreadyStarted?: Boolean;

    public constructor(options: Options) {
        super();
        this.path = options.path!;
        this.token = options.token!;
        this.guildsPerShard = options.guildsPerShard || 1300;
        this.shardCount = options.shards || 'auto';
        this.clusterCount = options.clusters || 'auto';
        this.clientOptions = options.clientOptions || {};
        this.clusterTimeout = options.clusterTimeout || 5e3;
        this.serviceTimeout = options.serviceTimeout || 0;
        this.nodeArgs = options.nodeArgs;
        this.statsInterval = options.statsInterval || 60e3;
        this.firstShardID = options.firstShardID || 0;
        this.lastShardID = options.lastShardID || 0;

        if (!options.token) throw "No token!";
        if (!path.isAbsolute(options.path)) throw "The path needs to be absolute!";
        if (options.services) {
            options.services.forEach(e => {
                if (!path.isAbsolute(e.path)) throw `Path for service ${e.name} needs to be absolute!`;
                if (options.services!.filter(s => s.name == e.name).length > 1) throw `Duplicate service names for service ${e.name}!`;
            });
        }

        if (options.timeout) this.clientOptions.connectionTimeout = options.timeout;

        if (options.services) this.servicesToCreate = options.services;

            this.clusters = new Collection();
            this.services = new Collection();
            this.queue = new Queue();
            this.callbacks = new Map();
            
            if (this.statsInterval !== 'disable') {
                this.stats = {
                    guilds: 0,
                    users: 0,
                    clustersRam: 0,
                    voice: 0,
                    largeGuilds: 0,
                    shardCount: 0,
                    clusters: []
                }
            }

            if (this.clusterCount === 'auto') this.clusterCount = cpus().length;

            this.eris = new Eris.Client(this.token);

            this.launch();
        }

    private launch() {
        if (master.isMaster) {
            process.on("uncaughtException", e => this.error(e));

            process.nextTick(() => {
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

                this.log(`Admiral | Starting ${shards} shard(s) in ${this.clusterCount} cluster(s)`);

                let opts;
                if (this.nodeArgs) {
                    opts = {
                        silent: false,
                        execArgv: this.nodeArgs
                    };
                } else {
                    opts = {
                        silent: false
                    };
                }
                master.setupMaster(opts);

                // Start stuff
                if (this.servicesToCreate) {
                    this.startService(0);
                } else {
                    this.startCluster(0);
                }
            });
            });
        } else if (master.isWorker) {
            if (process.env.type === "cluster") {
                new Cluster();
            } else if (process.env.type === "service") {
                new Service();
            }
        }

        on('message', (worker, message, handle) => {
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
                    case "connected": {
                        if (this.queue.queue[1]) {
                            if (this.queue.queue[1].type === "service") {
                                this.queue.execute();
                            } else {
                                setTimeout(() => this.queue.execute(), this.clusterTimeout);
                            }
                        } else {
                            // Starts the stats
                            if (this.stats && !this.statsAlreadyStarted) this.startStats();
                        }
                        break;
                    }
                    case "fetchUser" || "fetchGuild" || "fetchChannel": {
                        const UUID = String(new Gen());
                        this.callbacks.set(UUID, worker.id);
                        this.fetchInfo(0, message.op, message.id, UUID);

                        break;
                    }
                    case "fetchMember": {
                        const UUID = String(new Gen());
                        this.callbacks.set(UUID, worker.id);
                        this.fetchInfo(0, "fetchMember", [message.guildID, message.memberID], UUID);

                        break;
                    }
                    case "serviceCommand": {
                        const service = this.services.get(message.command.service);
                        if (service) {
                            const UUID = String(new Gen());
                            this.callbacks.set(UUID, worker.id);
                            master.workers[service.workerID]!.send({op: "command", command: message.command, UUID});
                        } else {
                            this.error(`Cluster ${this.clusters.find((c: ClusterCollection) => c.workerID == worker.id).clusterID} | A service I requested (${message.command.service}) is unavailable.`);
                        }

                        break;
                    }
                    case "return": {
                        const worker = this.callbacks.get(message.UUID);
                        if (worker) {
                            this.callbacks.delete(message.UUID);
                            master.workers[worker]!.send({op: "return", id: message.value.id, value: message.value});
                        }

                        break;
                    }
                    case "collectStats": {
                        if (this.prelimStats) {
                            this.prelimStats.guilds += message.stats.guilds;
                            this.prelimStats.users += message.stats.guilds;
                            this.prelimStats.voice += message.stats.voice;
                            this.prelimStats.clustersRam += message.stats.ram;
                            this.prelimStats.largeGuilds += message.stats.largeGuilds;

                            this.prelimStats.clusters.push(Object.assign(message.stats, {id: this.clusters.find((c: ClusterCollection) => c.workerID == worker.id).clusterID}));
                            this.statsClustersCounted!++;
                        }

                        if (this.statsClustersCounted === this.clusters.size) {
                            const compare = (a: ClusterStats, b: ClusterStats) => {
                                if (a.id < b.id) return -1;
                                if (a.id > b.id) return 1;
                                return 0;
                            };
                            this.stats = Object.assign(this.prelimStats, {clusters: this.prelimStats!.clusters.sort(compare)});
                            this.emit("stats", this.stats);
                            this.log("Admiral | Stats updated.");

                            // Sends the clusters the latest stats
                            this.broadcast("stats", this.stats);
                        }

                        break;
                    }
                    case "getStats": {
                        // Sends the latest stats upon request from the IPC
                        master.workers[worker.id]?.send({op: "return", id: "statsReturn", value: this.stats});

                        break;
                    }
                    case "broadcast": {
                        this.broadcast(message.event.op, message.event.msg);
                        break;
                    }
                    case "sendTo": {
                        const worker = master.workers[this.clusters.get(message.cluster).workerID];
                        if (worker) worker.send({op: message.event.op, msg: message.event.msg});

                        break;
                    }
                }
            }
        });

        on('disconnect', worker => {
            const cluster = this.clusters.find((c: ClusterCollection) => c.workerID == worker.id);
            const service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);
            if (cluster) {
                this.error(`Admiral | Cluster ${cluster.clusterID} disconnected :(`);
            } else if (service) {
                this.error(`Admiral | Service ${service.serviceName} disconnected :(`);
            }
        });

        on('exit', (worker, code, signal) => {
            this.restartWorker(worker, code, signal);
        });

        this.queue.on("execute", (item) => {
            master.workers[item.workerID]!.send(item.message);
        });
    }

    private startService(i: number) {
        if (i === this.servicesToCreate!.length) {
            this.log("Admiral | All services launched!");
            this.startCluster(0);
        } else {
            const service = this.servicesToCreate![i];
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
                    timeout: this.serviceTimeout
                }
            });

            this.log("Admiral | Launching service " + service.name);
            i++;

            this.startService(i);
        }
    }

    private startCluster(clusterID: number) {
        if (clusterID === this.clusterCount) {
            this.log("Admiral | All clusters launched!");

            
            this.chunks!.forEach((chunk, clusterID) => {
                const workerID = this.clusters.get(clusterID)!.workerID;

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
    
                if (!cluster!.hasOwnProperty('firstShardID')) break;
    
                this.queue.item({
                    type: "cluster",
                    workerID: cluster!.workerID,
                    message: {
                        clusterID: ID,
                        clusterCount: this.clusterCount,
                        op: "connect",
                        firstShardID: cluster!.firstShardID,
                        lastShardID: cluster!.lastShardID,
                        shardCount: Number(this.shardCount),
                        token: this.token,
                        path: this.path,
                        clientOptions: this.clientOptions
                    }
                });
            }

            this.log("Admiral | All shards spread!");
        } else {
            const worker = master.fork({
                type: "cluster",
                NODE_ENV: process.env.NODE_ENV
            });
            this.clusters.set(clusterID, {
                workerID: worker.id,
                firstShardID: 0,
                lastShardID: 0,
                clusterID: clusterID
            });
            this.log("Admiral | Launching cluster " + clusterID);
            clusterID++;

            this.startCluster(clusterID);
        }
    }

    private async calculateShards() {
        let shards = this.shardCount;
        if (shards === 'auto') {
            const gateway = await this.eris.getBotGateway();
            this.log(`Admiral | Gateway recommends ${gateway.shards} shards.`);
            shards = gateway.shards;
            if (shards === 1) {
                return Promise.resolve(shards);
            } else {
                return Promise.resolve(Math.ceil((shards * 1000) / this.guildsPerShard));
            }
        } else {
            return Promise.resolve(shards);
        }
    }

    private chunk(shards: number[], clusters: number) {
        if (clusters < 2) return [shards];

        const length = shards.length;
        let r = [];
        let i = 0;
        let size;

        if (length % clusters === 0) {
            size = Math.floor(length / clusters);
            while (i < length) {
                r.push(shards.slice(i, i += size));
            }
        } else {
            while (i < length) {
                size = Math.ceil((length - i) / clusters--);
                r.push(shards.slice(i, i += size));
            }
        }

        return r;
    }

    private restartWorker(worker: master.Worker, code: number, signal: string) {
        const cluster = this.clusters.find((c: ClusterCollection) => c.workerID == worker.id);
        const service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);

        let item;
        if (cluster) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "cluster"
            });
            this.error(`Admiral | Cluster ${cluster.clusterID} died :(`);
            this.clusters.delete(cluster.clusterID);
            this.clusters.set(cluster.clusterID, Object.assign(cluster, {workerID: newWorker.id}));
            this.log(`Admiral | Restarting cluster ${cluster.clusterID}`);

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
                }
            };
        } else if (service) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "service"
            });
            this.error(`Admiral | Service ${service.serviceName} died :(`);
            this.services.delete(service.serviceName);
            this.services.set(service.serviceName, Object.assign(service, {workerID: newWorker.id}));
            this.log(`Admiral | Restarting service ${service.serviceName}`);
            //Removes old queue item if worker crashed during connect
            item = {
                workerID: newWorker.id,
                type: "service",
                message: {
                    serviceName: service.serviceName,
                    path: service.path,
                    op: "connect",
                    timeout: this.serviceTimeout
                }
            };
        }

        if (this.queue.queue[0]) {
            if (this.queue.queue[0].workerID == worker.id) {
                //@ts-ignore
                this.queue.queue[0] = item;
                this.queue.execute(true);
            } else {
                //@ts-ignore
                this.queue.item(item);
            }
        }
    }

    private fetchInfo(i: number, op: string, id: number | [number, number], UUID: string) {
        const cluster = this.clusters.get(i);
        if (cluster) {
            master.workers[cluster.workerID]!.send({op, id, UUID});
            process.nextTick(() => {
                this.fetchInfo(i += 1, op, id, UUID);
            });
        }
    }

    private startStats() {
        this.statsAlreadyStarted = true;
        if (this.statsInterval !== "disable") {

            const execute = () => {
                this.clusters.forEach((c: ClusterCollection) => {
                    master.workers[c.workerID]!.send({op: "collectStats"});
                });
            };

            setInterval(() => {
                this.prelimStats = {
                    guilds: 0,
                    users: 0,
                    clustersRam: 0,
                    voice: 0,
                    largeGuilds: 0,
                    shardCount: 0,
                    clusters: []
                }
                this.statsClustersCounted = 0;
                execute();
            }, this.statsInterval);

            // First execution
            execute();
        }
    }

    private broadcast(op: string, msg: any) {
        this.clusters.forEach((c: ClusterCollection) => {
            master.workers[c.workerID]!.send({op, msg});
        });
    }

    public error(message: any) {
        this.emit("error", message);
    }

    public debug(message: any) {
        this.emit("debug", message);
    }

    public log(message: any) {
        this.emit("log", message);
    }
}