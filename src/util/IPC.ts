import {EventEmitter} from "events";
import * as Admiral from "../sharding/Admiral";
import crypto from "crypto";
import { errorToJSON } from "./ErrorHandler";
import path from "path";
import { Collection } from "../util/Collection";
import { isMaster } from "cluster";

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
	messageHandler?: (message: any) => void;
}

/**
 * Handles communication between clusters, services, and the admiral.
 */
export class IPC extends EventEmitter {
	private events: Map<string | number, Array<(msg: any) => void>>;
	private ipcEventListeners: Map<string | number, Array<(msg: any) => void>>;
	private fetchTimeout: number;
	private messageHandler?: (message: any) => void

	public constructor(setup: Setup) {
		super();
		this.fetchTimeout = setup.fetchTimeout;
		this.events = new Map();
		this.ipcEventListeners = new Map();
		this.messageHandler = setup.messageHandler;

		// register user event listener
		this.ipcEventListeners.set("ipcEvent", [(msg) => {
			const event = this.events.get(msg.event);
			if (event) {
				event.forEach(fn => {
					fn(msg.msg);
				});
			}
		}]);

		const ipcEventListener = (msg: any) => {
			const event = this.ipcEventListeners.get(msg.op);
			if (event) {
				event.forEach(fn => {
					fn(msg);
				});
			}
		};
		if (isMaster) {
			this.on("ipcEvent", ipcEventListener);
		} else {
			process.on("message", ipcEventListener);
		}
	}

	private sendMessage(message: any) {
		if (this.messageHandler) {
			return this.messageHandler(message);
		} else if (process.send) {
			process.send(message);
		}
	}

	private sendLog(type: "log" | "error" | "warn" | "debug", value: unknown, source?: string) {
		let valueToSend = value;
		let valueTranslatedFrom: string | undefined = undefined;

		if (value instanceof Error) {
			valueTranslatedFrom = "Error";
			valueToSend = errorToJSON(value);
		}
		this.sendMessage({
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
	 * Register for an event. This will receive broadcasts and messages sent to this cluster.
	 * Events can be sent using {@link sendTo} and {@link broadcast}
	 * @param event Name of the event
	 * @param callback Function run when event is received
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
		this.sendMessage({op: "broadcast", event: {op, msg: message}});
	}

	/**
	 * Send to the master process.
	 * The event can be listened to using `Admiral.on("event", listener);`
	 * @param op Name of the event
	 * @param message Message to send
	 * @example
	 * ```js
	 * this.ipc.sendToAdmiral("Hello", "I'm working!");
	 * ```
	*/
	public sendToAdmiral(op: string, message?: unknown): void {
		if (!message) message = null;
		this.sendMessage({op: "admiralBroadcast", event: {op, msg: message}});
	}

	/**
	 * @deprecated Use {@link IPC.sendToAdmiral}
	*/
	public admiralBroadcast(op: string, message?: unknown): void {
		return this.sendToAdmiral(op, message);
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
		this.sendMessage({op: "sendTo", cluster: cluster, event: {msg: message, op}});
	}

	/**
	 * Fetch a cached user from the Eris client on any cluster
	 * @param id User ID
	 * @returns The Eris user object converted to JSON
	 * @example
	 * ```js
	 * await this.ipc.fetchUser('123456789');
	 * ```
	*/
	public fetchUser(id: string): Promise<any> {
		return new Promise((resolve) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
			this.sendMessage({op: "fetchUser", id});
		});
	}

	/**
	 * Fetch a cached guild from the Eris client on any cluster
	 * @param id Guild ID
	 * @returns The Eris guild object converted to JSON
	 * @example
	 * ```js
	 * await this.ipc.fetchGuild('123456789');
	 * ```
	*/
	public fetchGuild(id: string): Promise<any> {
		return new Promise((resolve) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
			this.sendMessage({op: "fetchGuild", id});
		});
	}

	/**
	 * Fetch a cached channel from the Eris client on any cluster
	 * @param id Channel ID
	 * @returns The Eris channel object converted to JSON
	 * @example
	 * ```js
	 * await this.ipc.fetchChannel('123456789');
	 * ```
	*/
	public fetchChannel(id: string): Promise<any> {
		return new Promise((resolve) => {
			this.once(id, (r: any) => {
				resolve(r);
			});
			this.sendMessage({op: "fetchChannel", id});
		});
	}

	/**
	 * Fetch a cached member from the Eris client on any cluster
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
		return new Promise((resolve) => {
			this.once(UUID, (r: any) => {
				if (r) r.id = memberID;
				resolve(r);
			});
			this.sendMessage({op: "fetchMember", id: UUID});
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
		const sendCommand = () => {
			this.sendMessage({op: "serviceCommand", 
				command: {
					service,
					msg: message,
					UUID,
					receptive
				}
			});
		};

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
				sendCommand();
			});
		} else {
			sendCommand();
			return;
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
		const sendCommand = () => {
			this.sendMessage({op: "clusterCommand", 
				command: {
					clusterID,
					msg: message,
					UUID,
					receptive
				}
			});
		};

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
				sendCommand();
			});
		} else {
			sendCommand();
			return;
		}
	}
	
	/**
	 * Execute a cluster command on all clusters
	 * 
	 * @param message Whatever message you want to send with the command (defaults to `null`)
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @param callback Function which will be run everytime a new command return is received
	 * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.allClustersCommand("hello clusters!", true, undefined, (id, data) => {
	 * 	console.log(`I just received ${data} from ${id}!`);
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
			this.sendMessage({op: "allClustersCommand", 
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
				new Promise((res: (value: Record<number, Admiral.ClusterCollection>) => void) => {
					this.once("admiralInfo", data => {
						res(data.clusters as Record<number, Admiral.ClusterCollection>);
					});
					this.sendMessage({op: "getAdmiralInfo"});
				}).then((clusterInfo) => {
					// get responses
					let clustersReturned = 0;
					const datareceived: Map<number, any> = new Map();
					let timeout: NodeJS.Timeout | undefined = undefined;
					const dataReturnCallback = (msg: {clusterID: number, value: any}) => {
						if (datareceived.get(msg.clusterID)) return;
						clustersReturned++;
						if (callback) {
							callback(msg.clusterID, msg.value);
						}
						datareceived.set(msg.clusterID, msg.value);

						// end if done
						if (clustersReturned === Object.keys(clusterInfo).length) {
							if (timeout) clearTimeout(timeout);
							resolve(datareceived);
							this.removeListener(UUID, dataReturnCallback);
						}
					};
					
					timeout = setTimeout(() => {
						reject("Timeout");
						this.removeListener(UUID, dataReturnCallback);
					}, returnTimeout ? returnTimeout : this.fetchTimeout);

					this.on(UUID, dataReturnCallback);

					sendCommand();
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
	public getStats(): Promise<Admiral.Stats> {
		return new Promise((resolve) => {
			const callback = (r: Admiral.Stats) => {
				//this.removeListener("statsReturn", callback);
				resolve(r);
			};

			this.on("statsReturn", callback);
			this.sendMessage({op: "getStats"});
		});
	}

	/**
	 * @returns Collection of clusters and collection of services
	 */
	public getWorkers(): Promise<{clusters: Collection<number, Admiral.ClusterCollection>, services: Collection<string, Admiral.ServiceCollection>}> {
		return new Promise((resolve) => {
			const callback = (r: {clusters: {dataType: "Map", value: never}, services: {dataType: "Map", value: never}}) => {
				const parsed = {
					clusters: new Collection<number, Admiral.ClusterCollection>(r.clusters.value),
					services: new Collection<string, Admiral.ServiceCollection>(r.services.value)
				};
				resolve(parsed);
			};

			this.once("workersReturn", callback);
			this.sendMessage({op: "getWorkers"});
		});
	}
	
	/**
	 * Force eris-fleet to fetch fresh stats
	 * @returns Promise with stats
	 */
	public collectStats(): Promise<Admiral.Stats> {
		return new Promise((resolve) => {
			const callback = (r: Admiral.Stats) => {
				resolve(r);
			};
			this.once("statsReturn", callback);
			this.sendMessage({op: "executeStats"});
		});
	}

	/**
	 * Restarts a specific cluster
	 * @param clusterID ID of the cluster to restart
	 * @param hard Whether to ignore the soft shutdown function
	 * @returns Promise which resolves with the cluster object when it restarts
	*/
	public restartCluster(clusterID: number, hard?: boolean): Promise<Admiral.ClusterCollection | undefined> {
		return new Promise((res) => {
			this.once(`clusterReady${clusterID}`, res);
			this.sendMessage({op: "restartCluster", clusterID, hard: hard ? true : false});
		});
	}

	/**
	 * Restarts all clusters
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartAllClusters(hard?: boolean): void {
		this.sendMessage({op: "restartAllClusters", hard: hard ? true : false});
	}

	/**
	 * Restarts a specific service
	 * @param serviceName Name of the service
	 * @param hard Whether to ignore the soft shutdown function
	 * @returns Promise which resolves with the service object when it restarts
	*/
	public restartService(serviceName: string, hard?: boolean): Promise<Admiral.ServiceCollection | undefined> {
		return new Promise((res) => {
			this.once(`serviceReady${serviceName}`, res);
			this.sendMessage({op: "restartService", serviceName, hard: hard ? true : false});
		});
	}

	/**
	 * Restarts all services
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public restartAllServices(hard?: boolean): void {
		this.sendMessage({op: "restartAllServices", hard: hard ? true : false});
	}

	/**
	 * Shuts down a cluster
	 * @param clusterID The ID of the cluster to shutdown
	 * @param hard Whether to ignore the soft shutdown function
	 * @returns Promise which resolves with the cluster object when it shuts down
	*/
	public shutdownCluster(clusterID: number, hard?: boolean): Promise<Admiral.ClusterCollection | undefined> {
		return new Promise((res) => {
			this.once(`clusterShutdown${clusterID}`, res);
			this.sendMessage({op: "shutdownCluster", clusterID, hard: hard ? true : false});
		});
	}

	/**
	 * Shuts down a service
	 * @param serviceName The name of the service
	 * @param hard Whether to ignore the soft shutdown function
	 * @returns Promise which resolves with the service object when it shuts down
	*/
	public shutdownService(serviceName: string, hard?: boolean): Promise<Admiral.ServiceCollection | undefined> {
		return new Promise((res) => {
			this.once(`serviceShutdown${serviceName}`, res);
			this.sendMessage({op: "shutdownService", serviceName, hard: hard ? true : false});
		});
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
	 * @returns Promise which resolves with the service object when it is ready
	 */
	public createService(serviceName: string, servicePath: string): Promise<Admiral.ServiceCollection | undefined> {
		return new Promise((res, rej) => {
			// if path is not absolute
			if (!path.isAbsolute(servicePath)) {
				rej("Service path must be absolute!");
				return;
			}
			this.once(`serviceReady${serviceName}`, res);

			// send to master process
			this.sendMessage({op: "createService", serviceName, servicePath});
		});
	}

	/**
	 * Shuts down everything and exits the master process
	 * @param hard Whether to ignore the soft shutdown function
	*/
	public totalShutdown(hard?: boolean): void {
		this.sendMessage({op: "totalShutdown", hard: hard ? true : false});
	}

	/**
	 * Reshards all clusters
	 * @param options Change the resharding options
	 * @returns Promise which resolves when resharding is complete (note that this only resolves when using a service or the Admiral)
	*/
	public reshard(options?: Admiral.ReshardOptions): Promise<void> {
		return new Promise((res) => {
			this.once("reshardingComplete", res);
			this.sendMessage({op: "reshard", options});
		});
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
		const sendCommand = () => {
			this.sendMessage({op: "clusterEval", 
				request: {
					clusterID,
					stringToEvaluate,
					UUID,
					receptive
				}
			});
		};

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
				sendCommand();
			});
		} else {
			sendCommand();
			return;
		}
	}

	/**
	 * Sends an eval to all clusters.
	 * The eval occurs from a function within the BaseClusterWorker class.
	 * NOTE: Use evals sparingly as they are a major security risk
	 * @param stringToEvaluate String to send to eval
	 * @param receptive Whether you expect something to be returned to you from the command (defaults to `false`)
	 * @param returnTimeout How long to wait for a return (defaults to `options.fetchTimeout`)
	 * @param callback Function which will be run everytime a new command return is received
	 * @returns Promise which provides a map with the data replied mapped by cluster ID if `receptive = true`
	 * @example
	 * ```js
	 * this.ipc.allClustersCommand("return 'heyo!'", true, undefined, (id, data) => {
	 * 	console.log(`I just received ${data} from ${id}!`);
	 * })
	 * .then((data) => this.ipc.log(`All my clusters responded and my data in a map. Here is the data from cluster 0: ${data.get(0)}`))
	 * .catch((error) => this.ipc.error(error));
	 * ```
	*/
	public allClustersEval(stringToEvaluate: string, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void {
		if (!receptive) receptive = false;
		const UUID = "allClustersEval" + crypto.randomBytes(16).toString("hex");

		const sendCommand = () => {
			this.sendMessage({op: "allClustersEval", 
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
				/*new Promise((res: (value: Record<number, Admiral.ClusterCollection>) => void) => {
					this.once("admiralInfo", data => {
						res(data.clusters as Record<number, Admiral.ClusterCollection>);
					});
					this.sendMessage({op: "getAdmiralInfo"});
				})*/
				this.getWorkers().then((workers) => {
					// get responses
					let clustersReturned = 0;
					const datareceived: Map<number, any> = new Map();
					let timeout: NodeJS.Timeout | undefined = undefined;
					const dataReturnCallback = (msg: {clusterID: number, value: any}) => {
						if (datareceived.get(msg.clusterID)) return;
						clustersReturned++;
						if (callback) {
							callback(msg.clusterID, msg.value);
						}
						datareceived.set(msg.clusterID, msg.value);

						// end if done
						if (clustersReturned === workers.clusters.size) {
							if (timeout) clearTimeout(timeout);
							resolve(datareceived);
							this.removeListener(UUID, dataReturnCallback);
						}
					};
					
					timeout = setTimeout(() => {
						reject("Timeout");
						this.removeListener(UUID, dataReturnCallback);
					}, returnTimeout ? returnTimeout : this.fetchTimeout);

					this.on(UUID, dataReturnCallback);

					sendCommand();
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
		const sendCommand = () => {
			this.sendMessage({op: "serviceEval", 
				request: {
					serviceName,
					stringToEvaluate,
					UUID,
					receptive
				}
			});
		};

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

				sendCommand();
			});
		} else {
			sendCommand();
			return;
		}
	}
}