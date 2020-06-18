import {EventEmitter} from "events";
import {cpus} from "os";
import * as master from "cluster";
import {on} from "cluster";
import {Collection} from "../util/Collection";
import {Queue} from "../util/Queue";
import * as Eris from "eris";
import {Cluster} from "../clusters/Cluster";
import {Service} from "../services/Service";
import * as path from "path";

interface ServiceCreator {
	name: string;
	path: string;
}

export interface StartingStatus {
	status: "online" | "idle" | "dnd" | "offline";
	game?: {
		name: string;
		type: 0 | 1 | 2 | 3;
		url?: string;
	};
}

export interface Options {
	/** Absolute path to the js file */
	path: string;
	/** Bot token */
	token: string;
	/** Guilds per shard */
	guildsPerShard?: number;
	/** Number of shards */
	shards?: number | "auto";
	/** Number of clusters */
	clusters?: number | "auto";
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
	statsInterval?: number | "disable";
	/** Services to start by name and path */
	services?: ServiceCreator[];
	/** First shard ID to use on this instance of eris-fleet */
	firstShardID?: number;
	/** Last shard ID to use on this instance of eris-fleet */
	lastShardID?: number;
	/** Option to have less logging show up */
	lessLogging?: boolean;
	/** Allows for more logging customization (overrides generic lessLogging option) */
	whatToLog?: any;
	/** Amount of time to wait before doing a forced shutdown during shutdowns */
	killTimeout?: number;
	/** Whether to split the source in to an Object */
	objectLogging?: boolean;
	/** Custom starting status */
	startingStatus?: StartingStatus;
	/** Whether to use faster start */
	fasterStart?: boolean;
	/** How long to wait before giving up on a fetch */
	fetchTimeout?: number;
}

interface ShardStats {
	latency: number;
	id: number;
	ready: boolean;
	status: "disconnected" | "connecting" | "handshaking" | "ready";
	guilds: number;
	users: number;
}

interface ClusterStats {
	id: number;
	guilds: number;
	users: number;
	uptime: number;
	voice: number;
	largeGuilds: number;
	ram: number;
	shardStats: ShardStats[] | [];
}

interface ServiceStats {
	name: number;
	ram: number;
}

export interface Stats {
	guilds: number;
	users: number;
	clustersRam: number;
	servicesRam: number;
	masterRam: number;
	totalRam: number;
	voice: number;
	largeGuilds: number;
	shardCount: number;
	clusters: ClusterStats[];
	services: ServiceStats[];
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

interface WorkerCollection {
	service?: {
		path: string;
		serviceName: string;
		workerID: number;
	};
	cluster?: {
		firstShardID: number;
		lastShardID: number;
		clusterID: number;
		workerID: number;
	};
}

export class Admiral extends EventEmitter {
	/** Map of clusters by  to worker by ID */
	public clusters!: Collection;
	/** Map of services by name to worker ID */
	public services: Collection;
	/** Maps of workers currently launching by ID */
	private launchingWorkers: Collection;
	private path: string;
	private token: string;
	public guildsPerShard: number;
	public shardCount: number | "auto";
	public clusterCount: number | "auto";
	public lastShardID: number;
	public firstShardID: number;
	private clientOptions: Eris.ClientOptions;
	public serviceTimeout: number;
	public clusterTimeout: number;
	public killTimeout: number;
	private nodeArgs?: string[];
	private statsInterval: number | "disable";
	public stats?: Stats;
	/** Services to create */
	private servicesToCreate?: ServiceCreator[];
	private queue: Queue;
	private eris: Eris.Client;
	private prelimStats?: Stats;
	private statsWorkersCounted?: number;
	private chunks?: number[][];
	private pauseStats!: boolean;
	private whatToLog: string[];
	private softKills: Map<
		number,
		{ fn: () => void; type?: "cluster" | "service"; id?: string | number }
	>;
	private launchingManager: Map<number, { waiting: () => void } | "launched">;
	private objectLogging: boolean;
	private startingStatus?: StartingStatus;
	private fasterStart: boolean;
	private resharding: boolean;
	private statsStarted: boolean;
	private fetches: Map<string, {
		op: string;
		id: number | string;
		UUID: number;
		checked: number;
	}>;
	private fetchTimeout: number;

	public constructor(options: Options) {
		super();
		this.objectLogging = options.objectLogging || false;
		this.path = options.path;
		this.token = options.token;
		this.guildsPerShard = options.guildsPerShard || 1300;
		this.shardCount = options.shards || "auto";
		this.clusterCount = options.clusters || "auto";
		this.clientOptions = options.clientOptions || {};
		this.clusterTimeout = options.clusterTimeout || 5e3;
		this.serviceTimeout = options.serviceTimeout || 0;
		this.killTimeout = options.killTimeout || 0;
		this.nodeArgs = options.nodeArgs;
		this.statsInterval = options.statsInterval || 60e3;
		this.firstShardID = options.firstShardID || 0;
		this.lastShardID = options.lastShardID || 0;
		this.fasterStart = options.fasterStart || false;
		this.fetchTimeout = options.fetchTimeout || 10e3;
		this.resharding = false;
		this.statsStarted = false;
		if (options.startingStatus) this.startingStatus = options.startingStatus;
		// Deals with needed components
		if (!options.token) throw "No token!";
		if (!path.isAbsolute(options.path)) throw "The path needs to be absolute!";
		if (options.services) {
			options.services.forEach((e) => {
				if (!path.isAbsolute(e.path)) {
					throw `Path for service ${e.name} needs to be absolute!`;
				}
				if (options.services!.filter((s) => s.name == e.name).length > 1) {
					throw `Duplicate service names for service ${e.name}!`;
				}
			});
		}

		if (options.timeout) this.clientOptions.connectionTimeout = options.timeout;

		const allLogOptions = [
			"gateway_shards",
			"admiral_start",
			"shards_spread",
			"stats_update",
			"all_clusters_launched",
			"all_services_launched",
			"cluster_launch",
			"service_launch",
			"cluster_start",
			"service_start",
			"service_ready",
			"cluster_ready",
			"shard_connect",
			"shard_ready",
			"shard_disconnect",
			"shard_resume",
			"service_restart",
			"cluster_restart",
			"service_shutdown",
			"cluster_shutdown",
			"total_shutdown",
			"resharding_transition_complete",
			"resharding_transition",
			"resharding_worker_killed",
		];
		this.whatToLog = allLogOptions;
		if (options.lessLogging) {
			this.whatToLog = [
				"admiral_start",
				"shard_disconnect",
				"shard_resume",
				"cluster_ready",
				"service_ready",
				"cluster_start",
				"all_services_launched",
				"all_clusters_launched",
				"total_shutdown",
				"cluster_shutdown",
				"service_shutdown",
				"resharding_transition_complete",
			];
		}

		if (options.whatToLog) {
			if (options.whatToLog.blacklist) {
				options.whatToLog.blacklist.forEach((t: string) => {
					if (this.whatToLog.includes(t)) {
						this.whatToLog.splice(this.whatToLog.indexOf(t), 1);
					}
				});
			} else if (options.whatToLog.whitelist) {
				this.whatToLog = options.whatToLog.whitelist;
			}
		}
		if (options.services) this.servicesToCreate = options.services;

		this.services = new Collection();
		this.clusters = new Collection();
		this.launchingWorkers = new Collection();
		this.queue = new Queue();
		this.softKills = new Map();
		this.fetches = new Map();
		this.launchingManager = new Map();

		if (this.statsInterval !== "disable") {
			this.stats = {
				guilds: 0,
				users: 0,
				clustersRam: 0,
				servicesRam: 0,
				masterRam: 0,
				totalRam: 0,
				voice: 0,
				largeGuilds: 0,
				shardCount: 0,
				clusters: [],
				services: [],
			};
		}

		if (this.clusterCount === "auto") this.clusterCount = cpus().length;

		this.eris = new Eris.Client(this.token);

		this.launch();

		if (master.isMaster) {
			on("message", (worker, message) => {
				if (message.op) {
					switch (message.op) {
					case "log": {
						let source;
						if (message.source) {
							source = message.source;
						} else {
							let cluster = this.clusters.find((c: ClusterCollection) => c.workerID == worker.id);
							let service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);
							if (!service && !cluster) {
								const soft = this.softKills.get(worker.id);
								const launching = this.launchingWorkers.get(worker.id);
								if (soft) {
									if (soft.type == "cluster") {
										cluster = {clusterID: soft.id};
									} else if (soft.type == "service") {
										service = {serviceName: soft.id};
									}
								} else if (launching) {
									if (launching.cluster) {
										cluster = {clusterID: launching.cluster.clusterID};
									} else if (launching.service) {
										service = {serviceName: launching.service.serviceName};
									}
								}
							}
							if (cluster) {
								source = `Cluster ${cluster.clusterID}`;
							} else if (service) {
								source = `Service ${service.serviceName}`;
							}
						}
						this.log(message.msg, source);
						break;
					}
					case "debug": {
						let source;
						if (message.source) {
							source = message.source;
						} else {
							let cluster = this.clusters.find(
								(c: ClusterCollection) => c.workerID == worker.id,
							);
							let service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);
							if (!service && !cluster) {
								const soft = this.softKills.get(worker.id);
								const launching = this.launchingWorkers.get(worker.id);
								if (soft) {
									if (soft.type == "cluster") {
										cluster = {clusterID: soft.id};
									} else if (soft.type == "service") {
										service = {serviceName: soft.id};
									}
								} else if (launching) {
									if (launching.cluster) {
										cluster = {clusterID: launching.cluster.clusterID};
									} else if (launching.service) {
										service = {serviceName: launching.service.serviceName};
									}
								}
							}
							if (cluster) {
								source = `Cluster ${cluster.clusterID}`;
							} else if (service) {
								source = `Service ${service.serviceName}`;
							}
						}
						this.debug(message.msg, source);
						break;
					}
					case "error": {
						let source;
						if (message.source) {
							source = message.source;
						} else {
							let cluster = this.clusters.find(
								(c: ClusterCollection) => c.workerID == worker.id,
							);
							let service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);
							if (!service && !cluster) {
								const soft = this.softKills.get(worker.id);
								const launching = this.launchingWorkers.get(worker.id);
								if (soft) {
									if (soft.type == "cluster") {
										cluster = {clusterID: soft.id};
									} else if (soft.type == "service") {
										service = {serviceName: soft.id};
									}
								} else if (launching) {
									if (launching.cluster) {
										cluster = {clusterID: launching.cluster.clusterID};
									} else if (launching.service) {
										service = {serviceName: launching.service.serviceName};
									}
								}
							}
							if (cluster) {
								source = `Cluster ${cluster.clusterID}`;
							} else if (service) {
								source = `Service ${service.serviceName}`;
							}
						}
						this.error(message.msg, source);
						break;
					}
					case "warn": {
						let source;
						if (message.source) {
							source = message.source;
						} else {
							let cluster = this.clusters.find(
								(c: ClusterCollection) => c.workerID == worker.id,
							);
							let service = this.services.find((s: ServiceCollection) => s.workerID == worker.id);
							if (!service && !cluster) {
								const soft = this.softKills.get(worker.id);
								const launching = this.launchingWorkers.get(worker.id);
								if (soft) {
									if (soft.type == "cluster") {
										cluster = {clusterID: soft.id};
									} else if (soft.type == "service") {
										service = {serviceName: soft.id};
									}
								} else if (launching) {
									if (launching.cluster) {
										cluster = {clusterID: launching.cluster.clusterID};
									} else if (launching.service) {
										service = {serviceName: launching.service.serviceName};
									}
								}
							}
							if (cluster) {
								source = `Cluster ${cluster.clusterID}`;
							} else if (service) {
								source = `Service ${service.serviceName}`;
							}
						}
						this.warn(message.msg, source);
						break;
					}
					case "launched": {
						const lr = this.launchingManager.get(worker.id);
						if (lr) {
							if (lr !== "launched") lr.waiting();
							this.launchingManager.delete(worker.id);
						} else {
							this.launchingManager.set(worker.id, "launched");
						}

						break;
					}
					case "connected": {
						const launchedWorker = this.launchingWorkers.get(worker.id);
						if (launchedWorker) {
							if (this.queue.queue[0].type == "cluster") {
								this.clusters.set(launchedWorker.cluster.clusterID, {
									workerID: worker.id,
									clusterID: launchedWorker.cluster.clusterID,
									firstShardID: launchedWorker.cluster.firstShardID,
									lastShardID: launchedWorker.cluster.lastShardID,
								});
								this.fetches.forEach((fetch) => {
									process.nextTick(() => worker.send(fetch));
								});
							} else if (this.queue.queue[0].type == "service") {
								this.services.set(launchedWorker.service.serviceName, {
									workerID: worker.id,
									serviceName: launchedWorker.service.serviceName,
									path: launchedWorker.service.path,
								});
							}
						}
						this.launchingWorkers.delete(worker.id);
						if (!this.resharding && !this.softKills.get(worker.id)) {
							worker.send({op: "loadCode"});
						}
						if (this.softKills.get(worker.id)) {
							this.softKills.get(worker.id)?.fn();
						}
						if (this.queue.queue[1]) {
							if (this.queue.queue[1].type == "cluster" && this.queue.queue[0].type == "cluster") {
								setTimeout(() => this.queue.execute(), this.clusterTimeout);
							} else {
								this.queue.execute();
							}
						} else {
							this.queue.execute();
							this.emit("ready");
							// After all clusters and services are ready
							if (this.stats && this.pauseStats) {
								if (!this.resharding) {
									if (!this.statsStarted) this.startStats();
								} else {
									this.pauseStats = false;
								}
							}
						}
						break;
					}
					case "shutdown": {
						const workerID = this.queue.queue[0].workerID;
						if (this.softKills.get(workerID)) {
								this.softKills.get(workerID)?.fn();
						}
						// if (!this.queue.queue[1]) this.emit("ready");
						break;
					}
					case "fetchGuild":
					case "fetchMember":
					case "fetchChannel":
					case "fetchUser": {
						this.fetchInfo(message.op, message.id, worker.id);

						break;
					}
					case "serviceCommand": {
						const service = this.services.get(message.command.service);
						if (service) {
							const serviceWorker = master.workers[service.workerID];
							if (serviceWorker) {
								serviceWorker.send({
									op: "command",
									command: message.command,
									UUID: worker.id,
								});
							} else {
								worker.send({
									op: "return",
									id: message.command.UUID,
									value: {
										value: {
											err: `Service ${message.command.service} is unavailable.`,
										},
									},
								});
								this.error(
									`Cluster ${
										this.clusters.find(
											(c: ClusterCollection) => c.workerID == worker.id,
										).clusterID
									} | A service I requested (${
										message.command.service
									}) is unavailable.`,
								);
							}
						} else {
							worker.send({
								op: "return",
								id: message.command.UUID,
								value: {
									value: {
										err: `Service ${message.command.service} does not exist.`,
									},
								},
							});
							this.error(
								`Cluster ${
									this.clusters.find(
										(c: ClusterCollection) => c.workerID == worker.id,
									).clusterID
								} | A service I requested (${
									message.command.service
								}) does not exist.`,
							);
						}

						break;
					}
					case "return": {
						const worker = master.workers[message.UUID];
						if (worker) {
							const UUID = JSON.stringify({
								id: message.value.id,
								UUID: message.UUID,
							});
							const fetch = this.fetches.get(UUID);
							if (message.value.noValue) {
								if (fetch !== undefined) {
									let clustersLaunching = 0;
									this.launchingWorkers.forEach((w) => {
										if (w.cluster) clustersLaunching++;
									});

									if (fetch.checked + 1 == this.clusters.size + clustersLaunching) {
										worker.send({
											op: "return",
											id: message.value.id,
											value: null,
										});
										this.fetches.delete(UUID);
									} else {
										this.fetches.set(UUID, Object.assign(fetch, {checked: fetch.checked + 1}));
									}
								}
							} else {
								this.fetches.delete(UUID);
								worker.send({
									op: "return",
									id: message.value.id,
									value: message.value,
								});
							}
						}

						break;
					}
					case "collectStats": {
						if (this.prelimStats && !this.pauseStats) {
							const cluster = this.clusters.find(
								(c: ClusterCollection) => c.workerID == worker.id,
							);
							const service = this.services.find(
								(s: ServiceCollection) => s.workerID == worker.id,
							);
							if (cluster) {
								this.prelimStats.guilds += message.stats.guilds;
								this.prelimStats.users += message.stats.guilds;
								this.prelimStats.voice += message.stats.voice;
								this.prelimStats.clustersRam += message.stats.ram;
								this.prelimStats.largeGuilds += message.stats.largeGuilds;
								this.prelimStats.shardCount +=
										message.stats.shardStats.length;

								this.prelimStats.clusters.push(
									Object.assign(message.stats, {id: cluster.clusterID}),
								);
							} else if (service) {
								this.prelimStats.servicesRam += message.stats.ram;
								this.prelimStats.services.push(
									Object.assign(message.stats, {name: service.serviceName}),
								);
							}
							this.prelimStats.totalRam += message.stats.ram;
							if (this.statsWorkersCounted) this.statsWorkersCounted++;
						}

						if (this.statsWorkersCounted === this.clusters.size + this.services.size) {
								this.prelimStats!.masterRam = process.memoryUsage().rss / 1e6;
								this.prelimStats!.totalRam += this.prelimStats!.masterRam;
								const compare = (a: ClusterStats, b: ClusterStats) => {
									if (a.id < b.id) return -1;
									if (a.id > b.id) return 1;
									return 0;
								};
								this.stats = Object.assign(this.prelimStats, {
									clusters: this.prelimStats!.clusters.sort(compare),
								});
								this.emit("stats", this.stats);
								if (this.whatToLog.includes("stats_update")) {
									this.log("Admiral | Stats updated.");
								}

								// Sends the clusters the latest stats
								this.broadcast("stats", this.stats);
						}

						break;
					}
					case "getStats": {
							// Sends the latest stats upon request from the IPC
							master.workers[worker.id]?.send({
								op: "return",
								id: "statsReturn",
								value: this.stats,
							});

							break;
					}
					case "broadcast": {
						this.broadcast(message.event.op, message.event.msg);
						break;
					}
					case "sendTo": {
						const worker = master.workers[this.clusters.get(message.cluster).workerID];
						if (worker) {
							worker.send({op: message.event.op, msg: message.event.msg});
						}

						break;
					}
					case "restartCluster": {
						const workerID = this.clusters.find((c: ClusterCollection) => c.clusterID == message.clusterID).workerID;
						if (workerID) {
							const worker = master.workers[workerID];
							if (worker) {
								this.restartWorker(worker, true, message.hard ? false : true);
							}
						}

						break;
					}
					case "restartAllClusters": {
						this.clusters.forEach((cluster) => {
							process.nextTick(() => {
								const workerID = this.clusters.find(
									(c: ClusterCollection) => c.clusterID == cluster.clusterID,
								).workerID;
								const worker = master.workers[workerID];
								if (worker) this.restartWorker(worker, true, message.hard ? false : true);
							});
						});

						break;
					}
					case "restartService": {
						const workerID = this.services.find(
							(s: ServiceCollection) => s.serviceName == message.serviceName,
						).workerID;
						if (workerID) {
							const worker = master.workers[workerID];
							if (worker) this.restartWorker(worker, true, message.hard ? false : true);
						}

						break;
					}
					case "restartAllServices": {
						this.services.forEach((service) => {
							process.nextTick(() => {
								const workerID = this.services.find(
									(s: ServiceCollection) =>
										s.serviceName == service.serviceName,
								).workerID;
								const worker = master.workers[workerID];
								if (worker) this.restartWorker(worker, true, message.hard ? false : true);
							});
						});

						break;
					}
					case "shutdownCluster": {
						const workerID = this.clusters.find(
							(c: ClusterCollection) => c.clusterID == message.clusterID,
						).workerID;
						if (workerID) {
							const worker = master.workers[workerID];
							if (worker) this.shutdownWorker(worker, message.hard ? false : true);
						}

						break;
					}
					case "shutdownService": {
						const workerID = this.services.find(
							(s: ServiceCollection) => s.serviceName == message.serviceName,
						).workerID;
						if (workerID) {
							const worker = master.workers[workerID];
							if (worker) this.shutdownWorker(worker, message.hard ? false : true);
						}

						break;
					}
					case "totalShutdown": {
						if (this.whatToLog.includes("total_shutdown")) {
							this.log("Admiral | Starting total fleet shutdown.");
						}
						if (message.hard) {
							if (this.whatToLog.includes("total_shutdown")) {
								this.log(
									"Admiral | Total fleet hard shutdown complete. Ending process.",
								);
							}
							process.exit(0);
						} else {
							let total = 0;
							this.clusters.forEach((cluster) => {
								total++;
								process.nextTick(() => {
									const workerID = this.clusters.find((c: ClusterCollection) => c.clusterID == cluster.clusterID).workerID;
									if (workerID) {
										const worker = master.workers[workerID];
										if (worker) this.shutdownWorker(worker, message.hard ? false : true);
									}
								});
							});
							this.services.forEach((service) => {
								total++;
								process.nextTick(() => {
									const workerID = this.services.find((s: ServiceCollection) => s.serviceName == service.serviceName).workerID;
									if (workerID) {
										const worker = master.workers[workerID];
										if (worker) this.shutdownWorker(worker, message.hard ? false : true);
									}
								});
							});

							let done = 0;
							on("message", (worker, message) => {
								if (message.op == "shutdown") {
									done++;
									if (done == total) {
										if (this.whatToLog.includes("total_shutdown")) {
											this.log("Admiral | Total fleet shutdown complete. Ending process.");
										}
										process.exit(0);
									}
								}
							});
						}

						break;
					}
					case "reshard": {
						this.reshard();

						break;
					}
					case "admiralBroadcast": {
						this.emit(message.event.op, message.event.msg);

						break;
					}
					}
				}
			});

			on("disconnect", (worker) => {
				const cluster = this.clusters.find(
					(c: ClusterCollection) => c.workerID == worker.id,
				);
				const service = this.services.find(
					(s: ServiceCollection) => s.workerID == worker.id,
				);
				if (cluster) {
					this.warn(`Admiral | Cluster ${cluster.clusterID} disconnected :(`);
				} else if (service) {
					this.warn(`Admiral | Service ${service.serviceName} disconnected :(`);
				}
			});

			on("exit", (worker, code, signal) => {
				this.restartWorker(worker);
			});

			this.queue.on("execute", (item) => {
				const worker = master.workers[item.workerID];
				if (worker) {
					if (item.message.op == "connect") {
						const lr = this.launchingManager.get(item.workerID);
						if (lr) {
							worker.send(item.message);
							this.launchingManager.delete(item.workerID);
						} else {
							this.launchingManager.set(item.workerID, {
								waiting: () => {
									worker.send(item.message);
								},
							});
						}
					} else {
						worker.send(item.message);
					}
				}
			});
		}
	}

	private launch() {
		this.launchingWorkers.clear();
		this.pauseStats = true;

		if (master.isMaster) {
			process.on("uncaughtException", (e) => this.error(e));

			process.nextTick(() => {
				if (this.whatToLog.includes("admiral_start")) {
					if (this.resharding) {
						this.log("Fleet | Resharding");
					} else {
						this.log("Fleet | Started Admiral");
					}
				}
				this.calculateShards().then((shards) => {
					if (this.lastShardID === 0) {
						this.lastShardID = shards - 1;
					}
					this.shardCount = shards;

					// Chunk
					const shardsByID = [];
					for (let i = this.firstShardID; i <= this.lastShardID; i++) {
						shardsByID.push(i);
					}
					this.chunks = this.chunk(shardsByID, Number(this.clusterCount));
					this.clusterCount = this.chunks.length;

					if (this.whatToLog.includes("admiral_start")) {
						this.log(
							`Admiral | Starting ${shards} shard(s) in ${this.clusterCount} cluster(s)`,
						);
					}

					let opts;
					if (this.nodeArgs) {
						opts = {
							silent: false,
							execArgv: this.nodeArgs,
						};
					} else {
						opts = {
							silent: false,
						};
					}
					master.setupMaster(opts);

					// Start stuff
					if (this.servicesToCreate && !this.resharding) {
						this.startService();
					} else {
						this.startCluster();
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
	}

	/** Reshard */
	public reshard(): void {
		if (!this.resharding) {
			const oldClusters = new Collection;
			this.clusters.forEach((o: ClusterCollection) => {
				oldClusters.set(o.clusterID, o);
			});
			this.resharding = true;
			this.launch();
			this.once("ready", () => {
				this.resharding = false;
				if (this.whatToLog.includes("resharding_worker_killed")) {
					this.log("Admiral | Killing old clusters");
				}
				let i = 0;
				oldClusters.forEach((c) => {
					const oldWorker = master.workers[c.workerID];
					if (oldWorker) {
						this.shutdownWorker(oldWorker, true, () => {
							if (this.whatToLog.includes("resharding_worker_killed")) {
								this.log(`Admiral | Killed old worker for cluster ${c.clusterID}`);
							}
							const newWorker = master.workers[this.clusters.find((newC: ClusterCollection) => newC.clusterID == c.clusterID).workerID];
							if (this.whatToLog.includes("resharding_transition")) {
								this.log(`Admiral | Transitioning to new worker for cluster ${c.clusterID}`);
							}
							if (newWorker) newWorker.send({op: "loadCode"});
							i++;
							if (i == oldClusters.size) {
								if (this.whatToLog.includes("resharding_transition_complete")) {
									this.log(
										"Admiral | Transitioned all clusters to the new workers!",
									);
								}
							}
						}, {clusters: oldClusters});
					}
				});
			});
		} else {
			this.error("Already resharding!", "Admiral");
		}
	}

	private async startService() {
		if (this.servicesToCreate) {
			for (let i = 0; i < this.servicesToCreate.length; i++) {
				const service = this.servicesToCreate[i];
				const worker = master.fork({
					type: "service",
					NODE_ENV: process.env.NODE_ENV,
				});
				/* this.services.set(service.name, {
					workerID: worker.id,
					path: service.path,
					serviceName: service.name,
				}); */
	
				this.launchingWorkers.set(worker.id, {
					service: {
						path: service.path,
						serviceName: service.name,
						workerID: worker.id,
					},
				});
	
				this.queue.item({
					type: "service",
					workerID: worker.id,
					message: {
						serviceName: service.name,
						path: service.path,
						op: "connect",
						timeout: this.serviceTimeout,
						whatToLog: this.whatToLog,
					},
				});
				if (this.whatToLog.includes("service_launch")) {
					this.log("Admiral | Launching service " + service.name);
				}
			}
		}
		process.nextTick(() => {
			if (this.whatToLog.includes("all_services_launched")) {
				this.log("Admiral | All services launched!");
			}
			this.startCluster();
		});
	}

	private startCluster() {
		for (let i = 0; i < this.clusterCount; i++) {
			const worker = master.fork({
				type: "cluster",
				NODE_ENV: process.env.NODE_ENV,
			});
			/* this.clusters.set(i, {
				workerID: worker.id,
				firstShardID: 0,
				lastShardID: 0,
				clusterID: i,
			}); */
			this.launchingWorkers.set(worker.id, {
				cluster: {
					firstShardID: 0,
					lastShardID: 0,
					clusterID: i,
					workerID: worker.id,
				},
			});
			if (this.whatToLog.includes("cluster_launch")) this.log("Admiral | Launching cluster " + i);
		}

		if (this.whatToLog.includes("all_clusters_launched")) this.log("Admiral | All clusters launched!");

		if (this.chunks) this.chunks.forEach((chunk, clusterID) => {
			const workerID = this.launchingWorkers.find((w: WorkerCollection) => w.cluster?.clusterID == clusterID).cluster.workerID;

			/* this.clusters.set(clusterID, {
				workerID: workerID,
				firstShardID: Math.min(...chunk),
				lastShardID: Math.max(...chunk),
				clusterID: clusterID,
			}); */
			this.launchingWorkers.set(workerID, {
				cluster: {
					firstShardID: Math.min(...chunk),
					lastShardID: Math.max(...chunk),
					clusterID: clusterID,
					workerID: workerID,
				},
			});
		});
		// Connects shards
		for (const i in [...Array(this.clusterCount).keys()]) {
			const ID = Number(i);

			const cluster = this.launchingWorkers.find((w: WorkerCollection) => w.cluster?.clusterID == ID).cluster;

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
					whatToLog: this.whatToLog,
					startingStatus: this.startingStatus,
				},
			});
		}
		if (this.whatToLog.includes("shards_spread")) this.log("Admiral | All shards spread!");
	}

	private async calculateShards() {
		let shards = this.shardCount;
		if (shards === "auto") {
			const gateway = await this.eris.getBotGateway();
			if (this.whatToLog.includes("gateway_shards")) {
				this.log(`Admiral | Gateway recommends ${gateway.shards} shards.`);
			}
			shards = Number(gateway.shards);
			if (shards === 1) {
				return Promise.resolve(shards);
			} else {
				return Promise.resolve(
					Math.ceil((shards * 1000) / this.guildsPerShard),
				);
			}
		} else {
			return Promise.resolve(shards);
		}
	}

	private chunk(shards: number[], clusters: number) {
		if (clusters < 2) return [shards];

		const length = shards.length;
		const r = [];
		let i = 0;
		let size;

		if (length % clusters === 0) {
			size = Math.floor(length / clusters);
			while (i < length) {
				r.push(shards.slice(i, (i += size)));
			}
		} else {
			while (i < length) {
				size = Math.ceil((length - i) / clusters--);
				r.push(shards.slice(i, (i += size)));
			}
		}

		return r;
	}

	private shutdownWorker(worker: master.Worker, soft?: boolean, callback?: () => void, customMaps?: { clusters?: Collection; services?: Collection }) {
		let cluster: ClusterCollection;
		let service: ServiceCollection;
		if (customMaps) {
			if (customMaps.clusters) {
				cluster = customMaps.clusters.find(
					(c: ClusterCollection) => c.workerID == worker.id,
				);
			} else {
				cluster = this.clusters.find(
					(c: ClusterCollection) => c.workerID == worker.id,
				);
			}
			if (customMaps.services) {
				service = customMaps.services.find(
					(s: ServiceCollection) => s.workerID == worker.id,
				);
			} else {
				service = this.services.find(
					(s: ServiceCollection) => s.workerID == worker.id,
				);
			}
		} else {
			cluster = this.clusters.find(
				(c: ClusterCollection) => c.workerID == worker.id,
			);
			service = this.services.find(
				(s: ServiceCollection) => s.workerID == worker.id,
			);
		}

		const item = {
			workerID: worker.id,
			type: "n",
			message: {
				op: "shutdown",
				killTimeout: this.killTimeout,
			},
		};
		if (cluster) {
			if (soft) {
				// Preform soft shutdown
				this.softKills.set(worker.id, {
					fn: () => {
						this.log(`Admiral | Safely shutdown cluster ${cluster.clusterID}`);
						worker.kill();
						if (!customMaps) this.clusters.delete(cluster.clusterID);
						this.softKills.delete(worker.id);
						this.queue.execute();
						if (callback) callback();
					},
				});
				if (this.whatToLog.includes("cluster_shutdown")) {
					this.log(
						`Admiral | Performing soft shutdown of cluster ${cluster.clusterID}`,
					);
				}
			} else {
				worker.kill();
				if (this.whatToLog.includes("cluster_shutdown")) {
					this.log(
						`Admiral | Hard shutdown of cluster ${cluster.clusterID} complete`,
					);
				}
				if (!customMaps) this.clusters.delete(cluster.clusterID);
			}

			item.type = "cluster";
		} else if (service) {
			if (soft) {
				// Preform soft shutdown
				this.softKills.set(worker.id, {
					fn: () => {
						this.log(
							`Admiral | Safely shutdown service ${service.serviceName}`,
						);
						worker.kill();
						if (!customMaps) this.services.delete(service.serviceName);
						this.softKills.delete(worker.id);
						this.queue.execute();
						if (callback) callback();
					},
				});
				if (this.whatToLog.includes("service_shutdown")) {
					this.log(
						`Admiral | Performing soft shutdown of service ${service.serviceName}`,
					);
				}
			} else {
				worker.kill();
				if (this.whatToLog.includes("service_shutdown")) {
					this.log(
						`Admiral | Hard shutdown of service ${service.serviceName} complete`,
					);
				}
				if (!customMaps) this.services.delete(service.serviceName);
			}

			item.type = "service";
		}

		if (service || cluster) {
			if (this.queue.queue[0]) {
				if (this.queue.queue[0].workerID == worker.id) {
					this.queue.queue[0] = item;
					this.queue.execute(true);
				} else {
					this.queue.item(item);
				}
			} else {
				this.queue.item(item);
			}
		}
	}

	private restartWorker(worker: master.Worker, manual?: boolean, soft?: boolean) {
		const cluster = this.clusters.find(
			(c: ClusterCollection) => c.workerID == worker.id,
		);
		const service = this.services.find(
			(s: ServiceCollection) => s.workerID == worker.id,
		);

		let item;
		if (cluster) {
			const newWorker = master.fork({
				NODE_ENV: process.env.NODE_ENV,
				type: "cluster",
			});
			if (soft) {
				// Preform soft restart
				this.pauseStats = true;
				this.softKills.set(newWorker.id, {
					fn: () => {
						this.softKills.delete(newWorker.id);
						if (this.whatToLog.includes("cluster_restart")) {
							this.log(
								`Admiral | Killing old worker for cluster ${cluster.clusterID}`,
							);
						}
						this.shutdownWorker(worker, true, () => {
							if (this.whatToLog.includes("cluster_restart")) {
								this.log(
									`Admiral | Killed old worker for cluster ${cluster.clusterID}`,
								);
							}
							newWorker.send({op: "loadCode"});
							this.clusters.delete(cluster.clusterID);
							this.clusters.set(
								cluster.clusterID,
								Object.assign(cluster, {workerID: newWorker.id}),
							);
							this.pauseStats = false;
						});
					},
					type: "cluster",
					id: cluster.clusterID,
				});
				if (this.whatToLog.includes("cluster_restart")) {
					this.log(
						`Admiral | Performing soft restart of cluster ${cluster.clusterID}`,
					);
				}
			} else {
				if (manual) {
					worker.kill();
					this.warn(
						`Admiral | Cluster ${cluster.clusterID} killed upon request`,
					);
				} else {
					this.warn(`Admiral | Cluster ${cluster.clusterID} died :(`);
				}
				this.clusters.delete(cluster.clusterID);
				this.clusters.set(
					cluster.clusterID,
					Object.assign(cluster, {workerID: newWorker.id}),
				);
				if (this.whatToLog.includes("cluster_restart")) {
					this.log(`Admiral | Restarting cluster ${cluster.clusterID}`);
				}
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
					startingStatus: this.startingStatus,
				},
			};
		} else if (service) {
			const newWorker = master.fork({
				NODE_ENV: process.env.NODE_ENV,
				type: "service",
			});
			if (soft) {
				// Preform soft restart
				this.softKills.set(newWorker.id, {
					fn: () => {
						this.softKills.delete(newWorker.id);
						if (this.whatToLog.includes("service_restart")) {
							this.log(
								`Admiral | Killing old worker for service ${service.serviceName}`,
							);
						}
						this.shutdownWorker(worker, true, () => {
							if (this.whatToLog.includes("service_restart")) {
								this.log(
									`Admiral | Killed old worker for service ${service.serviceName}`,
								);
							}
							this.services.delete(service.serviceName);
							this.services.set(
								service.serviceName,
								Object.assign(service, {workerID: newWorker.id}),
							);
						});
					},
					type: "service",
					id: service.serviceName,
				});
				if (this.whatToLog.includes("service_restart")) {
					this.log(
						`Admiral | Performing soft restart of service ${service.serviceName}`,
					);
				}
			} else {
				if (manual) {
					worker.kill();
					this.warn(
						`Admiral | Service ${service.serviceName} killed upon request`,
					);
				} else {
					this.warn(`Admiral | Service ${service.serviceName} died :(`);
				}
				this.services.delete(service.serviceName);
				this.services.set(
					service.serviceName,
					Object.assign(service, {workerID: newWorker.id}),
				);
				if (this.whatToLog.includes("service_restart")) {
					this.log(`Admiral | Restarting service ${service.serviceName}`);
				}
			}

			item = {
				workerID: newWorker.id,
				type: "service",
				message: {
					serviceName: service.serviceName,
					path: service.path,
					op: "connect",
					timeout: this.serviceTimeout,
					whatToLog: this.whatToLog,
				},
			};
		}

		if ((service || cluster) && item) {
			if (this.queue.queue[0]) {
				if (this.queue.queue[0].workerID == worker.id) {
					this.queue.queue[0] = item;
					this.queue.execute(true);
				} else {
					this.queue.item(item);
				}
			} else {
				this.queue.item(item);
			}
		}
	}

	private fetchInfo(op: string, id: number | string, UUID: number) {
		const mapUUID = JSON.stringify({id, UUID});
		this.fetches.set(mapUUID, {UUID, op, id, checked: 0});
		for (let i = 0; this.clusters.get(i); i++) {
			process.nextTick(() => {
				const cluster = this.clusters.get(i);
				const worker = master.workers[cluster.workerID];
				if (worker) worker.send({op, id, UUID});
			});
		}
		setTimeout(() => {
			if (this.fetches.get(mapUUID)) {
				this.fetches.delete(mapUUID);
				const worker = master.workers[UUID];
				if (worker) {
					worker.send({
						op: "return",
						id: id,
						value: null,
					});
				}
			}
		}, this.fetchTimeout);
	}

	private startStats() {
		this.pauseStats = false;
		this.statsStarted = true;
		if (this.statsInterval !== "disable") {
			const execute = () => {
				this.prelimStats = {
					guilds: 0,
					users: 0,
					clustersRam: 0,
					servicesRam: 0,
					masterRam: 0,
					totalRam: 0,
					voice: 0,
					largeGuilds: 0,
					shardCount: 0,
					clusters: [],
					services: [],
				};
				this.statsWorkersCounted = 0;
				this.clusters.forEach((c: ClusterCollection) => {
					process.nextTick(() => {
						const worker = master.workers[c.workerID];
						if (worker) worker.send({op: "collectStats"});
					});
				});
				this.services.forEach((s: ServiceCollection) => {
					process.nextTick(() => {
						const worker = master.workers[s.workerID];
						if (worker) worker.send({op: "collectStats"});
					});
				});
			};

			setInterval(() => {
				if (!this.pauseStats) execute();
			}, this.statsInterval);

			// First execution
			execute();
		}
	}

	public broadcast(op: string, msg: unknown): void {
		if (!msg) msg = null;
		this.clusters.forEach((c: ClusterCollection) => {
			const worker = master.workers[c.workerID];
			if (worker) process.nextTick(() => worker.send({op, msg}));
		});
		this.services.forEach((s: ServiceCollection) => {
			const worker = master.workers[s.workerID];
			if (worker) process.nextTick(() => worker.send({op, msg}));
		});
	}

	public error(message: any, source?: string): void {
		let log = message;
		if (this.objectLogging) {
			log = {
				source: "",
				message: message,
				timestamp: new Date().getTime(),
			};
			if (source) {
				log.source = source;
			} else {
				if (typeof message == "string") {
					const split = message.split("|");
					log.source = split[0].trim();
					log.message = split[1].trim();
				}
			}
		} else {
			if (source) {
				log = `${source} | ${message}`;
			}
		}
		this.emit("error", log);
	}

	public debug(message: any, source?: string): void {
		let log = message;
		if (this.objectLogging) {
			log = {
				source: "",
				message: message,
				timestamp: new Date().getTime(),
			};
			if (source) {
				log.source = source;
			} else {
				if (typeof message == "string") {
					const split = message.split("|");
					log.source = split[0].trim();
					log.message = split[1].trim();
				}
			}
		} else {
			if (source) {
				log = `${source} | ${message}`;
			}
		}
		this.emit("debug", log);
	}

	public log(message: any, source?: string): void {
		let log = message;
		if (this.objectLogging) {
			log = {
				source: "",
				message: message,
				timestamp: new Date().getTime(),
			};
			if (source) {
				log.source = source;
			} else {
				if (typeof message == "string") {
					const split = message.split("|");
					log.source = split[0].trim();
					log.message = split[1].trim();
				}
			}
		} else {
			if (source) {
				log = `${source} | ${message}`;
			}
		}
		this.emit("log", log);
	}

	public warn(message: any, source?: string): void {
		let log = message;
		if (this.objectLogging) {
			log = {
				source: "",
				message: message,
				timestamp: new Date().getTime(),
			};
			if (source) {
				log.source = source;
			} else {
				if (typeof message == "string") {
					const split = message.split("|");
					log.source = split[0].trim();
					log.message = split[1].trim();
				}
			}
		} else {
			if (source) {
				log = `${source} | ${message}`;
			}
		}
		this.emit("warn", log);
	}
}
