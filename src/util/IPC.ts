import { ReshardOptions } from "./../sharding/Admiral";
import {EventEmitter} from "events";
import * as Admiral from "../sharding/Admiral";
import crypto from "crypto";
import { errorToJSON } from "./ErrorHandler";
import path from "path";
import * as master from "cluster";
import { inspect } from "util";

export interface IpcHandledLog {
	op: "log" | "error" | "warn" | "debug",
	ipcLogObject: boolean,
	msg: unknown,
	source?: string,
	valueTranslatedFrom?: "Error", 
	valueTypeof: string,
	timestamp: number
}

export class IPC extends EventEmitter {
	private events: Map<string | number, Array<(msg: any) => void>>;
	private ipcEventListeners: Map<string | number, Array<(msg: any) => void>>;

	public constructor() {
		super();
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

	private sendLog(type: "log" | "error" | "warn" | "debug", value: unknown, source?: string) {
		let valueToSend = value;
		let valueTranslatedFrom: string | undefined = undefined;

		if (value instanceof Error) {
			valueTranslatedFrom = "Error";
			valueToSend = errorToJSON(value);
		}
		if (process.send) process.send({
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
	 */
	public log(message: unknown, source?: string): void {
		this.sendLog("log", message, source);
	}

	/**
	 * Sends an error log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 */
	public error(message: unknown, source?: string): void {
		this.sendLog("error", message, source);
	}

	/**
	 * Sends a warn log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 */
	public warn(message: unknown, source?: string): void {
		this.sendLog("warn", message, source);
	}

	/**
	 * Sends a debug log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 */
	public debug(message: unknown, source?: string): void {
		this.sendLog("debug", message, source);
	}

	/** 
	 * Register for an event. This will recieve broadcasts and messages sent to this cluster
	 * @param event Name of the event
	 * @param callback Function run when event is recieved
	*/
	public register(event: string, callback: (msg: unknown) => void): void {
		const existingEvent = this.events.get(event);
		if (existingEvent) {
			this.events.set(event, existingEvent.concat([callback]));
		} else {
			this.events.set(event, [callback]);
		}
	}

	/** 
	 * Unregisters an event
	 * @param event Name of the event
	*/
	public unregister(event:string): void {
		this.events.delete(event);
	}

	/**
	 * Broadcast an event to all clusters and services
	 * @param op Name of the event
	 * @param message Message to send
	*/
	public broadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "broadcast", event: {op, msg: message}});
	}

	/**
	 * Broadcast to the master process
	 * @param op Name of the event
	 * @param message Message to send
	*/
	public admiralBroadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "admiralBroadcast", event: {op, msg: message}});
	}

	/**
	 * Send a message to a specific cluster
	 * @param cluster ID of the cluster
	 * @param op Name of the event
	 * @param message Message to send
	*/
	public sendTo(cluster: number, op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "sendTo", cluster: cluster, event: {msg: message, op}});
	}

	/**
	 * Fetch a user from the Eris client on any cluster
	 * @param id User ID
	 * @returns The Eris user object converted to JSON
	*/
	public async fetchUser(id: string): Promise<any> {
		if (process.send) process.send({op: "fetchUser", id});

		return new Promise((resolve, reject) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
		});
	}

	/**
	 * Fetch a guild from the Eris client on any cluster
	 * @param id Guild ID
	 * @returns The Eris guild object converted to JSON
	*/
	public async fetchGuild(id: string): Promise<any> {
		if (process.send) process.send({op: "fetchGuild", id});

		return new Promise((resolve, reject) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
		});
	}

	/**
	 * Fetch a Channel from the Eris client on any cluster
	 * @param id Channel ID
	 * @returns The Eris channel object converted to JSON
	*/
	public async fetchChannel(id: string): Promise<any> {
		if (process.send) process.send({op: "fetchChannel", id});

		return new Promise((resolve, reject) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
		});
	}

	/**
	 * Fetch a user from the Eris client on any cluster
	 * @param guildID Guild ID
	 * @param memberID the member's user ID
	 * @returns The Eris member object converted to JSON
	*/
	public async fetchMember(guildID: string, memberID: string): Promise<any> {
		const UUID = JSON.stringify({guildID, memberID});
		if (process.send) process.send({op: "fetchMember", id: UUID});

		return new Promise((resolve, reject) => {
			this.once(UUID, (r: any) => {
				if (r) r.id = memberID;
				resolve(r);
			});
		});
	}

	/**
	 * Execute a service command
	 * @param service Name of the service
	 * @param message Whatever message you want to send with the command
	 * @param receptive Whether you expect something to be returned to you from the command
	*/
	public async command(service: string, message?: unknown, receptive?: boolean): Promise<unknown> {
		if (!message) message = null;
		if (!receptive) receptive = false;
		const UUID = "serviceCommand" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "serviceCommand", 
			command: {
				service,
				msg: message,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				this.once(UUID, (r: any) => {
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				});
			});
		}
	}

	/**
	 * Execute a cluster command
	 * @param clusterID ID of the cluster
	 * @param message Whatever message you want to send with the command
	 * @param receptive Whether you expect something to be returned to you from the command
	*/
	public async clusterCommand(clusterID: string, message?: unknown, receptive?: boolean): Promise<unknown> {
		if (!message) message = null;
		if (!receptive) receptive = false;
		const UUID = "clusterCommand" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "clusterCommand", 
			command: {
				clusterID,
				msg: message,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				this.once(UUID, (r: any) => {
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				});
			});
		}
	}
	
	/**
	 * Execute a cluster command on all clusters
	 * @param clusterID ID of the cluster
	 * @param message Whatever message you want to send with the command
	 * @param receptive Whether you expect something to be returned to you from the command. WIll return an object with each response mapped to the cluster's ID
	*/
	public async allClustersCommand(clusterID: string, message?: unknown, receptive?: boolean): Promise<unknown> {
		if (!message) message = null;
		if (!receptive) receptive = false;
		const UUID = "allClusterCommand" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "allClustersCommand", 
			command: {
				msg: message,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				this.on(UUID, (r: any) => {
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				});
			});
		}
	}

	/**
	 * @returns The latest stats
	*/
	public async getStats(): Promise<Admiral.Stats> {
		if (process.send) process.send({op: "getStats"});

		return new Promise((resolve, reject) => {
			const callback = (r: Admiral.Stats) => {
				this.removeListener("statsReturn", callback);
				resolve(r);
			};

			if (process.send) this.on("statsReturn", callback);
		});
	}

	/**
	 * Restarts a specific cluster
	 * @param clusterID ID of the cluster to restart
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartCluster(clusterID: number, hard?: boolean): void {
		if (process.send) process.send({op: "restartCluster", clusterID, hard: hard ? true : false});
	}

	/**
	 * Restarts all clusters
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartAllClusters(hard?: boolean): void {
		if (process.send) process.send({op: "restartAllClusters", hard: hard ? true : false});
	}

	/**
	 * Restarts a specific service
	 * @param serviceName Name of the service
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartService(serviceName: string, hard?: boolean): void {
		if (process.send) process.send({op: "restartService", serviceName, hard: hard ? true : false});
	}

	/**
	 * Restarts all services
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartAllServices(hard?: boolean): void {
		if (process.send) process.send({op: "restartAllServices", hard: hard ? true : false});
	}

	/**
	 * Shuts down a cluster
	 * @param clusterID The ID of the cluster to shutdown
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public shutdownCluster(clusterID: number, hard?: boolean): void {
		if (process.send) process.send({op: "shutdownCluster", clusterID, hard: hard ? true : false});
	}

	/**
	 * Shuts down a service
	 * @param serviceName The name of the service
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public shutdownService(serviceName: string, hard?: boolean): void {
		if (process.send) process.send({op: "shutdownService", serviceName, hard: hard ? true : false});
	}

	/** 
	 * Create a service
	 * @param serviceName Unique ame of the service
	 * @param servicePath Absolute path to the service file
	 */
	public createService(serviceName: string, servicePath: string): void {
		// if path is not absolute
		if (!path.isAbsolute(servicePath)) {
			this.error("Service path must be absolute!");
			return;
		}

		if (process.send) process.send({op: "createService", serviceName, servicePath});
	}

	/**
	 * Shuts down everything and exits the master process
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public totalShutdown(hard?: boolean): void {
		if (process.send) process.send({op: "totalShutdown", hard: hard ? true : false});
	}

	/**
	 * Reshards all clusters
	 * @param options Change the resharding options
	*/
	public reshard(options?: ReshardOptions): void {
		if (process.send) process.send({op: "reshard", options});
	}

	public async clusterEval(clusterID: string, stringToEvaluate: string, receptive?: boolean): Promise<unknown> {
		if (!receptive) receptive = false;
		const UUID = "clusterEval" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "clusterEval", 
			request: {
				clusterID,
				stringToEvaluate: stringToEvaluate,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				this.once(UUID, (r: any) => {
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				});
			});
		}
	}
}