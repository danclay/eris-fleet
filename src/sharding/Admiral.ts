import { EventEmitter } from 'events';
import {cpus} from 'os';
import * as master from 'cluster';
import {on} from 'cluster';
import {Collection} from '../util/Collection';
import {Queue} from '../util/Queue';
import * as Eris from 'eris';

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
    /** How long to wait for clusters to connect to discord */
    timeout?: number;
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
    guilds: number;
    users: number;
    uptime: number;
    voice: number;
    largeGuilds: number;
    exclusiveGuilds: number;
    shardStats: ShardStats[] | [];
}

interface Stats {
    guilds: number;
    users: number;
    totalRam: number;
    voice: number;
    exclusiveGuilds: number;
    largeGuilds: number;
    shardCount: number;
    clusters: ClusterStats[] | [];
}

export class Admiral extends EventEmitter {
    /** Map of clusters by  to worker by ID */
    public clusters: Map<number, {workerID: number, firstShardID: number, lastShardID: number}>;
    /** Map of services by name to worker ID */
    public services: Map<string, {workerID: number, path: string}>;
    /** Array of callbacks */
    private callbacks?: [number];
    private path: string;
    private token: string;
    public guildsPerShard: number;
    public shardCount: number | 'auto';
    public clusterCount: number | 'auto';
    public lastShardID: number;
    public firstShardID: number;
    private clientOptions: Eris.ClientOptions;
    public timeout: number;
    public clusterTimeout?: number;
    private nodeArgs?: string[];
    private statsInterval: number | 'disable';
    public stats?: Stats;
    /** Services to create */
    private servicesToCreate?: ServiceCreator[];
    private queue: Queue;
    private eris: Eris.Client;

    public constructor(options: Options) {
        super();
        this.path = options.path!;
        this.token = options.token!;
        this.guildsPerShard = options.guildsPerShard || 1300;
        this.shardCount = options.shards || 'auto';
        this.clusterCount = options.clusters || 'auto';
        this.clientOptions = options.clientOptions || {};
        this.timeout = options.timeout || 60e3;
        this.clusterTimeout = options.clusterTimeout || 5e3;
        this.nodeArgs = options.nodeArgs;
        this.statsInterval = options.statsInterval || 60e3;
        this.firstShardID = options.firstShardID || 0;
        this.lastShardID = options.lastShardID || 0;
        if (options.services) this.servicesToCreate = options.services;

            this.clusters = new Collection();
            this.services = new Collection();
            this.queue = new Queue();
            
            if (this.statsInterval !== 'disable') {
                this.stats = {
                    guilds: 0,
                    users: 0,
                    totalRam: 0,
                    voice: 0,
                    exclusiveGuilds: 0,
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
                this.log("Admiral | Started cluster manager");
                this.calculateShards().then(shards => {
                if (this.lastShardID === 0) {
                    this.lastShardID = shards - 1;
                }
                this.shardCount = shards;

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
                console.log(this.servicesToCreate || "none");
                if (this.servicesToCreate) {
                    this.startService(0);
                } else {
                    this.startCluster(0);
                }
            });
            });
        } else if (master.isWorker) {
            //console.log("Worker!");
            //new Cluster();
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
                    case "connected":
                        if (this.queue.queue[1].type === "service") {
                            this.queue.execute();
                        } else {
                            setTimeout(() => this.queue.execute(), this.clusterTimeout);
                        }
                        break;
                }
            }
        });
    }

    private startService(i: number) {
        if (i === this.servicesToCreate!.length) {
            this.log("Admiral | All services launched!");
            this.startCluster(0);
        } else {
            const service = this.servicesToCreate![i];
            const worker = master.fork({
                NODE_ENV: process.env.NODE_ENV
            });
            this.services?.set(service.name, {
                workerID: worker.id,
                path: service.path
            });

            this.queue.item({
                type: "service",
                workerID: worker.id,
                message: {
                    serviceName: service.name,
                    path: service.path
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

            let shards = [];
            for (let i = this.firstShardID; i <= this.lastShardID; i++) {
                shards.push(i);
            }

            const chunkedShards = this.chunk(shards, this.clusterCount);
            chunkedShards.forEach((chunk, clusterID) => {
                const workerID = this.clusters.get(clusterID)!.workerID;

                this.clusters.set(clusterID, {
                    workerID: workerID,
                    firstShardID: Math.min(...chunk),
                    lastShardID: Math.max(...chunk)
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
                        clientOptions: this.clientOptions,
                        timeout: this.timeout
                    }
                });
            }

            this.log("Admiral | All shards spread!");
        } else {
            const worker = master.fork({
                NODE_ENV: process.env.NODE_ENV
            });
            this.clusters.set(clusterID, {
                workerID: worker.id,
                firstShardID: 0,
                lastShardID: 0
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
            console.log(`Admiral | Gateway recommends ${gateway.shards} shards.`);
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