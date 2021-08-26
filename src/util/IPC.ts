import {EventEmitter} from "events";
import * as Admiral from "../sharding/Admiral";
import crypto from "crypto";
import { errorToJSON } from "./ErrorHandler";
import path from "path";

export interface IpcHandledLog {
	op: "log" | "error" | "warn" | "debug",
	ipcLogObject: boolean,
	msg: unknown,
	source?: string,
	valueTranslatedFrom?: "Error", 
	valueTypeof: string,
	timestamp: number
}

export interface Setup {
	fetchTimeout: number;
}

/**
 * Handles communication between clusters, services, and the admiral.
 */
export class IPC extends EventEmitter {
	private events: Map<string | number, Array<(msg: any) => void>>;
	private ipcEventListeners: Map<string | number, Array<(msg: any) => void>>;
	private fetchTimeout: number;

	public constructor(setup: Setup) {
		super();
		this.fetchTimeout = setup.fetchTimeout;
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
	 * @example
	 * ```js
	 * this.ipc.log("You have reached this line of code");
	 * ```
	 */
	public log(message: unknown, source?: string): void {
		this.sendLog("log", message, source);
	}

	/**
	 * Sends an error log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 * @example
	 * ```js
	 * this.ipc.error(new Error("big yikes"));
	 * ```
	 */
	public error(message: unknown, source?: string): void {
		this.sendLog("error", message, source);
	}

	/**
	 * Sends a warn log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 * @example
	 * ```js
	 * this.ipc.warn("uh oh!");
	 * ```
	 */
	public warn(message: unknown, source?: string): void {
		this.sendLog("warn", message, source);
	}

	/**
	 * Sends a debug log to the Admiral
	 * @param message Item to log
	 * @param source Custom error source
	 * @example
	 * ```js
	 * this.ipc.debug("I'm here!");
	 * ```
	 */
	public debug(message: unknown, source?: string): void {
		this.sendLog("debug", message, source);
	}

	/** 
	 * Register for an event. This will recieve broadcasts and messages sent to this cluster.
	 * Events can be sent using {@link sendTo} and {@link broadcast}
	 * @param event Name of the event
	 * @param callback Function run when event is recieved
	 * @example
	 * ```js
	 * this.ipc.register("hello!", (message) => {
	 * 	// Do stuff
	 * 	console.log(message);
	 * });
	 * ```
	*/
	public register(event: string, callback: (msg: any) => void): void {
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
	 * @param callback Function which was listening. Leave empty if you want to delete all listeners registered to this event name.
	 * @example
	 * ```js
	 * this.ipc.unregister("stats");
	 * ```
	*/
	public unregister(event: string, callback?: (msg: any) => void): void {
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
		if (!listenerIndex && listenerIndex !== 0) return;
		eventListeners.splice(listenerIndex, 1);
	}

	/**
	 * Broadcast an event to all clusters and services. 
	 * The event can be listened to with {@link register}
	 * @param op Name of the event
	 * @param message Message to send
	 * @example
	 * ```js
	 * this.ipc.broadcast("hello clusters!", "Want to chat?");
	 * ```
	*/
	public broadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "broadcast", event: {op, msg: message}});
	}

	/**
	 * Broadcast to the master process.
	 * The event can be listened to using `Admiral.on("event", callback);`
	 * @param op Name of the event
	 * @param message Message to send
	 * @example
	 * ```js
	 * this.ipc.admiralBroadcast("Hello", "I'm working!");
	 * ```
	*/
	public admiralBroadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "admiralBroadcast", event: {op, msg: message}});
	}

	/**
	 * Send a message to a specific cluster.
	 * The event can be listened to with {@link register}
	 * @param cluster ID of the cluster
	 * @param op Name of the event
	 * @param message Message to send
	 * @example
	 * ```js
	 * this.ipc.sendTo(1, "Hello cluster 1!", "Squad up?");
	 * ```
	*/
	public sendTo(cluster: number, op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "sendTo", cluster: cluster, event: {msg: message, op}});
	}

	/**
	 * Fetch a user from the Eris client on any cluster
	 * @param id User ID
	 * @returns The Eris user object converted to JSON
	 * @example
	 * ```js
	 * await this.ipc.fetchUser('123456789');
	 * ```
	*/
	public fetchUser(id: string): Promise<any> {
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
	 * @example
	 * ```js
	 * await this.ipc.fetchGuild('123456789');
	 * ```
	*/
	public fetchGuild(id: string): Promise<any> {
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
	 * @example
	 * ```js
	 * await this.ipc.fetchChannel('123456789');
	 * ```
	*/
	public fetchChannel(id: string): Promise<any> {
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
	 * @example
	 * ```js
	 * await this.ipc.fetchMember('123456789', '987654321');
	 * ```
	*/
	public fetchMember(guildID: string, memberID: string): Promise<any> {
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
	 * @deprecated Use {@link IPC.serviceCommand}
	*/
	public command(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void {
		return this.serviceCommand(service, message, receptive, returnTimeout);
	}

	/**
	 * Execute a service command
	 * @param service Name of the service
	 * @param message Whatever message you want to send with the command (defaults to `null`)
	 * @param receptive Whether you expect something to be returned to you from the command  (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @returns Promise with data if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.serviceCommand("ServiceName", "hello service!", true)
	 * .then((message) => console.log(message))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	*/
	public serviceCommand(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void {
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
				// timeout
				let timeout: NodeJS.Timeout | undefined = undefined;
				const listener = (r: any) => {
					if (timeout) clearTimeout(timeout);
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				};

				timeout = setTimeout(() => {
					reject("Timeout");
					this.removeListener(UUID, listener);
				}, returnTimeout ? returnTimeout : this.fetchTimeout);

				this.once(UUID, listener);
			});
		}
	}

	/**
	 * Execute a cluster command
	 * @param clusterID ID of the cluster
	 * @param message Whatever message you want to send with the command (defaults to `null`)
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @returns Promise with data if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.clusterCommand(1, "hello cluster!", true)
	 * .then((message) => console.log(message))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	*/
	public clusterCommand(clusterID: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void {
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
				// timeout
				let timeout: NodeJS.Timeout | undefined = undefined;
				const listener = (r: any) => {
					if (timeout) clearTimeout(timeout);
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				};

				timeout = setTimeout(() => {
					reject("Timeout");
					this.removeListener(UUID, listener);
				}, returnTimeout ? returnTimeout : this.fetchTimeout);

				this.once(UUID, listener);
			});
		}
	}
	
	/**
	 * Execute a cluster command on all clusters
	 * 
	 * @param message Whatever message you want to send with the command (defaults to `null`)
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @param callback Function which will be run everytime a new command return is recieved
	 * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.allClustersCommand("hello clusters!", true, undefined, (id, data) => {
	 * 	console.log(`I just recieved ${data} from ${id}!`);
	 * })
	 * .then((data) => this.ipc.log(`All my clusters responded and my data in a map. Here is the data from cluster 0: ${data.get(0)}`))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	*/
	public allClustersCommand(message?: unknown, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void {
		if (!message) message = null;
		if (!receptive) receptive = false;
		const UUID = "allClusterCommand" + crypto.randomBytes(16).toString("hex");

		const sendCommand = () => {
			if (process.send) process.send({op: "allClustersCommand", 
				command: {
					msg: message,
					UUID,
					receptive
				}
			});
		};

		if (receptive) {
			return new Promise((resolve, reject) => {
				// wait for cluster info first
				new Promise((res: (value: Record<number, Admiral.ClusterCollection>) => void, rej) => {
					if (process.send) process.send({op: "getAdmiralInfo"});
					this.once("admiralInfo", data => {
						res(data.clusters as Record<number, Admiral.ClusterCollection>);
					});
				}).then((clusterInfo) => {
					sendCommand();

					// get responses
					let clustersReturned = 0;
					const dataRecieved: Map<number, any> = new Map();
					let timeout: NodeJS.Timeout | undefined = undefined;
					const dataReturnCallback = (msg: {clusterID: number, value: any}) => {
						if (dataRecieved.get(msg.clusterID)) return;
						clustersReturned++;
						if (callback) {
							callback(msg.clusterID, msg.value);
						}
						dataRecieved.set(msg.clusterID, msg.value);

						// end if done
						if (clustersReturned === Object.keys(clusterInfo).length) {
							if (timeout) clearTimeout(timeout);
							resolve(dataRecieved);
							this.removeListener(UUID, dataReturnCallback);
						}
					};
					
					timeout = setTimeout(() => {
						reject("Timeout");
						this.removeListener(UUID, dataReturnCallback);
					}, returnTimeout ? returnTimeout : this.fetchTimeout);

					this.on(UUID, dataReturnCallback);
				});
			});
		} else {
			sendCommand();
			return;
		}
	}

	/**
	 * @returns The latest stats
	*/
	public async getStats(): Promise<Admiral.Stats> {
		if (process.send) process.send({op: "getStats"});

		return new Promise((resolve, reject) => {
			const callback = (r: Admiral.Stats) => {
				//this.removeListener("statsReturn", callback);
				resolve(r);
			};

			this.once("statsReturn", callback);
		});
	}
	
	/**
	 * Force eris-fleet to fetch fresh stats
	 * @returns Promise with stats
	 */
	public async collectStats(): Promise<Admiral.Stats> {
		if (process.send) process.send({op: "executeStats"});
		
		return new Promise((resolve, reject) => {
			const callback = (r: Admiral.Stats) => {
				resolve(r);
			};
			this.once("statsReturn", callback);
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
	 * @example
	 * ```js
	 * const path = require("path");
	 * this.ipc.createService("myService", path.join(__dirname, "./service.js"))
	 * ```
	 */
	public createService(serviceName: string, servicePath: string): void {
		// if path is not absolute
		if (!path.isAbsolute(servicePath)) {
			this.error("Service path must be absolute!");
			return;
		}

		// send to master process
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
	public reshard(options?: Admiral.ReshardOptions): void {
		if (process.send) process.send({op: "reshard", options});
	}

	/**
	 * Sends an eval to the mentioned cluster.
	 * The eval occurs from a function within the BaseClusterWorker class.
	 * NOTE: Use evals sparingly as they are a major security risk
	 * @param clusterID ID of the cluster
	 * @param stringToEvaluate String to send to eval
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @returns Promise with result if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.clusterEval(1, "return 'hey!'", true)
	 * .then((data) => this.ipc.log(data))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	 */
	public clusterEval(clusterID: number, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void {
		if (!receptive) receptive = false;
		const UUID = "clusterEval" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "clusterEval", 
			request: {
				clusterID,
				stringToEvaluate,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				// timeout
				let timeout: NodeJS.Timeout | undefined = undefined;
				const listener = (r: any) => {
					if (timeout) clearTimeout(timeout);
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				};

				timeout = setTimeout(() => {
					reject("Timeout");
					this.removeListener(UUID, listener);
				}, returnTimeout ? returnTimeout : this.fetchTimeout);

				this.once(UUID, listener);
			});
		}
	}

	/**
	 * Sends an eval to all clusters.
	 * The eval occurs from a function within the BaseClusterWorker class.
	 * NOTE: Use evals sparingly as they are a major security risk
	 * @param stringToEvaluate String to send to eval
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @param callback Function which will be run everytime a new command return is recieved
	 * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.allClustersCommand("return 'heyo!'", true, undefined, (id, data) => {
	 * 	console.log(`I just recieved ${data} from ${id}!`);
	 * })
	 * .then((data) => this.ipc.log(`All my clusters responded and my data in a map. Here is the data from cluster 0: ${data.get(0)}`))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	*/
	public allClustersEval(stringToEvaluate: string, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void {
		if (!receptive) receptive = false;
		const UUID = "allClustersEval" + crypto.randomBytes(16).toString("hex");

		const sendCommand = () => {
			if (process.send) process.send({op: "allClustersEval", 
				request: {
					stringToEvaluate: stringToEvaluate,
					UUID,
					receptive
				}
			});
		};

		if (receptive) {
			return new Promise((resolve, reject) => {
				// wait for cluster info first
				new Promise((res: (value: Record<number, Admiral.ClusterCollection>) => void, rej) => {
					if (process.send) process.send({op: "getAdmiralInfo"});
					this.once("admiralInfo", data => {
						res(data.clusters as Record<number, Admiral.ClusterCollection>);
					});
				}).then((clusterInfo) => {
					sendCommand();

					// get responses
					let clustersReturned = 0;
					const dataRecieved: Map<number, any> = new Map();
					let timeout: NodeJS.Timeout | undefined = undefined;
					const dataReturnCallback = (msg: {clusterID: number, value: any}) => {
						if (dataRecieved.get(msg.clusterID)) return;
						clustersReturned++;
						if (callback) {
							callback(msg.clusterID, msg.value);
						}
						dataRecieved.set(msg.clusterID, msg.value);

						// end if done
						if (clustersReturned === Object.keys(clusterInfo).length) {
							if (timeout) clearTimeout(timeout);
							resolve(dataRecieved);
							this.removeListener(UUID, dataReturnCallback);
						}
					};
					
					timeout = setTimeout(() => {
						reject("Timeout");
						this.removeListener(UUID, dataReturnCallback);
					}, returnTimeout ? returnTimeout : this.fetchTimeout);

					this.on(UUID, dataReturnCallback);
				});
			});
		} else {
			sendCommand();
			return;
		}
	}

	/**
	 * Sends an eval to the mentioned service.
	 * The eval occurs from a function within the BaseServiceWorker class.
	 * NOTE: Use evals sparingly as they are a major security risk
	 * @param serviceName Name of the service
	 * @param stringToEvaluate String to send to eval
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @returns Promise with result if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.serviceEval(1, "return 'hey!'", true)
	 * .then((data) => this.ipc.log(data))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	 */
	public serviceEval(serviceName: string, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void {
		if (!receptive) receptive = false;
		const UUID = "serviceEval" + crypto.randomBytes(16).toString("hex");
		if (process.send) process.send({op: "serviceEval", 
			request: {
				serviceName,
				stringToEvaluate,
				UUID,
				receptive
			}
		});

		if (receptive) {
			return new Promise((resolve, reject) => {
				// timeout
				let timeout: NodeJS.Timeout | undefined = undefined;
				const listener = (r: any) => {
					if (timeout) clearTimeout(timeout);
					if (r.value === undefined || r.value === null || r.value.constructor !== ({}).constructor) {
						resolve(r.value);
					} else {
						if (r.value.err) {
							reject(r.value.err);
						} else {
							resolve(r.value);
						}
					}
				};

				timeout = setTimeout(() => {
					reject("Timeout");
					this.removeListener(UUID, listener);
				}, returnTimeout ? returnTimeout : this.fetchTimeout);

				this.once(UUID, listener);
			});
		}
	}
}