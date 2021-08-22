import {worker} from "cluster";
import {BaseServiceWorker} from "./BaseServiceWorker";
import {inspect} from "util";
import { IPC } from "../util/IPC";
import { LoggingOptions } from "../sharding/Admiral";

interface ServiceInput {
	fetchTimeout: number;
	overrideConsole: boolean;
}

export class Service {
	path!: string;
	serviceName!: string;
	app?: BaseServiceWorker;
	timeout!: number;
	whatToLog!: LoggingOptions[];
	ipc: IPC;
	connectedTimestamp?: number;

	constructor(input: ServiceInput) {
		this.ipc = new IPC({fetchTimeout: input.fetchTimeout});

		if (input.overrideConsole) {
			console.log = (str: unknown) => {this.ipc.log(str);};
			console.debug = (str: unknown) => {this.ipc.debug(str);};
			console.error = (str: unknown) => {this.ipc.error(str);};
			console.warn = (str: unknown) => {this.ipc.warn(str);};
		}

		// Spawns
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
					this.path = message.path;
					this.serviceName = message.serviceName;
					this.timeout = message.timeout;
					this.whatToLog = message.whatToLog;
					this.loadCode();
					break;
				}
				case "return": {
					if (this.app) this.ipc.emit(message.id, message.value);
					break;
				}
				case "command": {
					const noHandle = () => {
						const res = {err: `Service ${this.serviceName} cannot handle commands!`};
						if (process.send) process.send({op: "return", value: {
							id: message.command.UUID,
							value: res,
							serviceName: this.serviceName
						}, UUID: message.UUID});
						this.ipc.error("I can't handle commands!");
					};
					if (this.app) {
						if (this.app.handleCommand) {
							const res = await this.app.handleCommand(message.command.msg);
							if (message.command.receptive) {
								if (process.send) process.send({op: "return", value: {
									id: message.command.UUID,
									value: res,
									serviceName: this.serviceName
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
								serviceName: this.serviceName
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
										serviceName: this.serviceName
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
				case "shutdown": {
					if (this.app) {
						if (this.app.shutdown) {
							// Ask app to shutdown
							this.app.shutdown(() => {
								if (process.send) process.send({op: "shutdown"});
							});
						} else {
							if (process.send) process.send({op: "shutdown"});
						}
					} else {
						if (process.send) process.send({op: "shutdown"});
					}

					break;
				}
				case "collectStats": {
					if (process.send) process.send({op: "collectStats", stats: {
						uptime: this.connectedTimestamp ? new Date().getTime() - this.connectedTimestamp : 0,
						ram: process.memoryUsage().rss / 1e6,
						ipcLatency: new Date().getTime()
					}});

					break;
				}
				}
			}
		});
	}
 
	private async loadCode() {
		if (this.app) return;
		if (this.whatToLog.includes("service_start")) this.ipc.log(`Starting service ${this.serviceName}`);

		let App = (await import(this.path));
		if (App.ServiceWorker) {
			App = App.ServiceWorker;
		} else {
			App = App.default ? App.default : App;
		}
		this.app = new App({serviceName: this.serviceName, workerID: worker.id, ipc: this.ipc});

		let ready = false;
		if (this.app) this.app.readyPromise.then(() => {
			if (this.whatToLog.includes("service_ready")) this.ipc.log(`Service ${this.serviceName} is ready!`);
			if (process.send) process.send({op: "connected"});
			ready = true;
			this.connectedTimestamp = new Date().getTime();
		}).catch((err: unknown) => {
			this.ipc.error(`Service ${this.serviceName} had an error starting: ${inspect(err)}`);
			process.kill(0);
		});

		// Timeout
		if (this.timeout !== 0) {
			setTimeout(() => {
				if (!ready) {
					this.ipc.error(`Service ${this.serviceName} took too long to start.`);
					process.kill(0);
				}
			}, this.timeout);
		}

		/* this.app.admiral.on("broadcast", (m) => {
			if (!m.event) console.error(`Service ${this.serviceName} | My emit cannot be completed since the message doesn't have a "message"!`);
			if (!m.msg) m.msg = null;
			//@ts-ignore
			process.send({op: "broadcast", event: {op: m.event, msg: m.msg}});
		}) */
	}
}