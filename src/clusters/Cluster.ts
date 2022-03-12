import { ClusterConnectMessage } from "./../util/Queue";
import * as Eris from "eris";
import {worker} from "cluster";
import {BaseClusterWorker} from "./BaseClusterWorker";
import {inspect} from "util";
import {LoggingOptions, StartingStatus, ShardStats} from "../sharding/Admiral";
import { CentralRequestHandler } from "../util/CentralRequestHandler";
import { IPC } from "../util/IPC";

interface ClusterInput {
	erisClient: typeof Eris.Client;
	fetchTimeout: number;
	overrideConsole: boolean;
	BotWorker?: typeof BaseClusterWorker;
}

export class Cluster {
	private erisClient: typeof Eris.Client;
	firstShardID!: number;
	lastShardID!: number;
	path?: string;
	clusterID!: number;
	clusterCount!: number;
	shardCount!: number;
	shards!: number;
	clientOptions!: Eris.ClientOptions;
	whatToLog!: LoggingOptions[];
	useCentralRequestHandler!: boolean;
	bot!: Eris.Client;
	private token!: string;
	app?: BaseClusterWorker;
	App!: typeof BaseClusterWorker;
	ipc: IPC;
	shutdown?: boolean;
	private startingStatus?: StartingStatus;
	private loadClusterCodeImmediately!: boolean;
	private resharding!: boolean;
	private BotWorker?: typeof BaseClusterWorker;

	constructor(input: ClusterInput) {
		this.erisClient = input.erisClient;
		this.BotWorker = input.BotWorker;
		// add ipc
		this.ipc = new IPC({fetchTimeout: input.fetchTimeout});

		if (input.overrideConsole) {
			console.log = (str: unknown) => {this.ipc.log(str);};
			console.info = (str: unknown) => {this.ipc.info(str);};
			console.debug = (str: unknown) => {this.ipc.debug(str);};
			console.error = (str: unknown) => {this.ipc.error(str);};
			console.warn = (str: unknown) => {this.ipc.warn(str);};
		}

		//Spawns
		process.on("uncaughtException", (err: Error) => {
			this.ipc.error(err);
		});

		process.on("unhandledRejection", (reason, promise) => {
			this.ipc.error("Unhandled Rejection at: " + inspect(promise) + " reason: " + reason);
		});

		if (process.send) process.send({op: "launched"});
		
		process.on("message", async message => {
			if (message.op) {
				switch (message.op) {
				case "connect": {
					const connectMessage = message as ClusterConnectMessage;
					this.firstShardID = connectMessage.firstShardID;
					this.lastShardID = connectMessage.lastShardID;
					this.path = connectMessage.path;
					this.clusterID = connectMessage.clusterID;
					this.clusterCount = connectMessage.clusterCount;
					this.shardCount = connectMessage.shardCount;
					this.shards = (this.lastShardID - this.firstShardID) + 1;
					this.clientOptions = connectMessage.clientOptions;
					this.token = connectMessage.token;
					this.whatToLog = connectMessage.whatToLog;
					this.useCentralRequestHandler = connectMessage.useCentralRequestHandler;
					this.loadClusterCodeImmediately = connectMessage.loadClusterCodeImmediately;
					this.resharding = connectMessage.resharding;
					if (connectMessage.startingStatus) this.startingStatus = connectMessage.startingStatus;

					if (this.shards < 0) return;
					this.connect();

					break;
				}
				case "fetchUser": {
					if (!this.bot) return;
					const user = this.bot.users.get(message.id);
					if (user) {
						if (process.send) process.send({op: "return", value: user, UUID: message.UUID});
					} else {
						if (process.send) process.send({op: "return", value: {id: message.id, noValue: true}, UUID: message.UUID});
					}
						
					break;
				}
				case "fetchChannel": {
					if (!this.bot) return;
					const channel = this.bot.getChannel(message.id);
					if (channel) {
						if (process.send) process.send({op: "return", value: channel, UUID: message.UUID});
					} else {
						if (process.send) process.send({op: "return", value: {id: message.id, noValue: true}, UUID: message.UUID});
					}

					break;
				}
				case "fetchGuild": {
					if (!this.bot) return;
					const guild = this.bot.guilds.get(message.id);
					if (guild) {
						if (process.send) process.send({op: "return", value: guild, UUID: message.UUID});
					} else {
						if (process.send) process.send({op: "return", value: {id: message.id, noValue: true}, UUID: message.UUID});
					}

					break;
				}
				case "fetchMember": {
					if (!this.bot) return;
					const messageParsed = JSON.parse(message.id);
					const guild = this.bot.guilds.get(messageParsed.guildID);
					if (guild) {
						const member = guild.members.get(messageParsed.memberID);
						if (member) {
							const clean = member.toJSON();
							clean.id = message.id;
							if (process.send) process.send({op: "return", value: clean, UUID: message.UUID});
						} else {
							if (process.send) process.send({op: "return", value: {id: message.id, noValue: true}, UUID: message.UUID});
						}
					} else {
						if (process.send) process.send({op: "return", value: {id: message.id, noValue: true}, UUID: message.UUID});
					}

					break;
				}
				case "command": {
					const noHandle = () => {
						const res = {err: `Cluster ${this.clusterID} cannot handle commands!`};
						if (process.send) process.send({op: "return", value: {
							id: message.command.UUID,
							value: res,
							clusterID: this.clusterID
						}, UUID: message.UUID});
						this.ipc.error("I can't handle commands!");
					};
					if (this.app) {
						if (this.app.handleCommand) {
							const res = await this.app.handleCommand(message.command.msg as never);
							if (message.command.receptive) {
								if (process.send) process.send({op: "return", value: {
									id: message.command.UUID,
									value: res,
									clusterID: this.clusterID
								}, UUID: message.UUID});
							}
						} else {
							noHandle();
						}
					} else {
						noHandle();
					}

					break;
				}
				case "eval": {
					const errorEncountered = (err: unknown) => {
						if (message.request.receptive) {
							if (process.send) process.send({op: "return", value: {
								id: message.request.UUID,
								value: {err},
								clusterID: this.clusterID
							}, UUID: message.UUID});
						}
					};
					if (this.app) {
						this.app.runEval(message.request.stringToEvaluate)
							.then((res: unknown) => {
								if (message.request.receptive) {
									if (process.send) process.send({op: "return", value: {
										id: message.request.UUID,
										value: res,
										clusterID: this.clusterID
									}, UUID: message.UUID});
								}
							}).catch((error: unknown) => {
								errorEncountered(error);
							});
					} else {
						errorEncountered("Cluster is not ready!");
					}

					break;
				}
				case "return": {
					if (this.app) this.ipc.emit(message.id, message.value);
					break;
				}
				case "collectStats": {
					if (!this.bot) return;
					const shardStats: ShardStats[] = [];
					const getShardUsers = (id: number) => {
						let users = 0;
						this.bot.guildShardMap;
						this.bot.guilds.forEach(guild => {
							if (this.bot.guildShardMap[guild.id] !== id) return;
							users += guild.memberCount;
						});
						return users;
					};
					let totalMembers = 0;
					this.bot.shards.forEach(shard => {
						const shardUsers = getShardUsers(shard.id);
						totalMembers += shardUsers;
						shardStats.push({
							id: shard.id,
							ready: shard.ready,
							latency: shard.latency,
							status: shard.status,
							guilds: Object.values(this.bot.guildShardMap).filter(e => e === shard.id).length,
							users: shardUsers,
							members: shardUsers
						});
					});
					if (process.send) process.send({op: "collectStats", stats: {
						guilds: this.bot.guilds.size,
						users: this.bot.users.size,
						members: totalMembers,
						uptime: this.bot.uptime,
						voice: this.bot.voiceConnections.size,
						largeGuilds: this.bot.guilds.filter(g => g.large).length,
						shardStats: shardStats,
						shards: shardStats,
						ram: process.memoryUsage().rss / 1e6,
						ipcLatency: new Date().getTime(),
						requestHandlerLatencyRef: this.useCentralRequestHandler ? undefined : this.bot.requestHandler.latencyRef
					}});

					break;
				}
				case "shutdown": {
					this.shutdown = true;
					if (this.app) {
						if (this.app.shutdown) {
							// Ask app to shutdown
							this.app.shutdown(() => {
								this.bot.disconnect({reconnect: false});
								if (process.send) process.send({op: "shutdown"});
							});
						} else {
							this.bot.disconnect({reconnect: false});
							if (process.send) process.send({op: "shutdown"});
						}
					} else {
						if (this.bot) this.bot.disconnect({reconnect: false});
						if (process.send) process.send({op: "shutdown"});
					}

					break;
				}
				case "loadCode": {
					this.loadCode();

					break;
				}
				}
			}
		});
	}

	private async connect() {
		if (this.whatToLog.includes("cluster_start")) this.ipc.log(`Connecting with ${this.shards} shard(s)`);

		const options = Object.assign(this.clientOptions, {autoreconnect: true, firstShardID: this.firstShardID, lastShardID: this.lastShardID, maxShards: this.shardCount});

		let bot;
		let App;
		if (this.BotWorker) {
			App = this.BotWorker;
			bot = new this.erisClient(this.token, options);
		} else {
			try {
				App = await import(this.path!);
				if (App.Eris) {
					bot = new App.Eris.Client(this.token, options);
					App = App.BotWorker;
				} else {
					bot = new this.erisClient(this.token, options);
					if (App.BotWorker) {
						App = App.BotWorker;
					} else {
						App = App.default ? App.default : App;
					}
				}
			} catch (e) {
				this.ipc.error(e);
				process.exit(1);
			}
		}
		this.App = App;

		// central request handler
		if (this.useCentralRequestHandler) {
			bot.requestHandler = new CentralRequestHandler(this.ipc, {
				timeout: bot.options.requestTimeout
			});
		}

		this.bot = bot;

		const setStatus = () => {
			if (this.startingStatus) {
				if (this.startingStatus.game) {
					this.bot.editStatus(this.startingStatus.status, this.startingStatus.game);
				} else {
					this.bot.editStatus(this.startingStatus.status);
				}
			}
		};

		// load code if immediate code loading is enabled
		if (this.loadClusterCodeImmediately && !this.resharding) this.loadCode();

		bot.on("connect", (id: number) => {
			if (process.send) process.send({
				op: "shardUpdate",
				shardID: id,
				clusterID: this.clusterID,
				type: "shardConnect"
			});
		});

		bot.on("shardDisconnect", (err: Error, id: number) => {
			if (process.send) process.send({
				op: "shardUpdate",
				shardID: id,
				clusterID: this.clusterID,
				type: "shardDisconnect",
				err: inspect(err)
			});
		});

		bot.once("shardReady", () => {
			setStatus();
		});

		bot.on("shardReady", (id: number) => {
			if (process.send) process.send({
				op: "shardUpdate",
				shardID: id,
				clusterID: this.clusterID,
				type: "shardReady"
			});
		});

		bot.on("shardResume", (id: number) => {
			if (process.send) process.send({
				op: "shardUpdate",
				shardID: id,
				clusterID: this.clusterID,
				type: "shardResume"
			});
		});

		bot.on("warn", (message: string, id?: number) => {
			this.ipc.warn(message, `Cluster ${this.clusterID}, Shard ${id}`);
		});

		bot.on("error", (error: Error, id?: number) => {
			this.ipc.error(error, `Cluster ${this.clusterID}, Shard ${id}`);
		});

		bot.on("ready", () => {
			if (this.whatToLog.includes("cluster_ready")) this.ipc.log(`Shards ${this.firstShardID} - ${this.lastShardID} are ready!`);
		});

		bot.once("ready", () => {
			if (process.send) process.send({op: "connected"});
		});

		// Connects the bot
		bot.connect();
	}

	
	private async loadCode() {
		if (this.app) return;
		//let App = (await import(this.path)).default;
		//App = App.default ? App.default : App;
		try {
			this.app = new this.App({bot: this.bot, clusterID: this.clusterID, workerID: worker.id, ipc: this.ipc});
			if (!this.app) return;
			if (process.send) process.send({op: "codeLoaded"});
		} catch (e) {
			this.ipc.error(e);
			// disconnect bot
			if (this.bot) this.bot.disconnect({reconnect: false});
			// kill cluster
			process.exit(1);
		}
	}
}