import {worker} from "cluster";
import {BaseServiceWorker} from "./BaseServiceWorker";
import {inspect} from "util";

export class Service {
	path!: string;
	serviceName!: string;
	app?: BaseServiceWorker;
	timeout!: number;
	whatToLog!: string[];

	constructor() {

		console.log = (str: unknown) => {if (process.send) process.send({op: "log", msg: str});};
		console.debug = (str: unknown) => {if (process.send) process.send({op: "debug", msg: str});};
		console.error = (str: unknown) => {if (process.send) process.send({op: "error", msg: str});};
		console.warn = (str: unknown) => {if (process.send) process.send({op: "warn", msg: str});};

		// Spawns
		process.on("uncaughtException", (err: Error) => {
			if (process.send) process.send({op: "error", msg: inspect(err)});
		});

		process.on("unhandledRejection", (reason, promise) => {
			if (process.send) process.send({op: "error", msg: "Unhandled Rejection at: " + inspect(promise) + " reason: " + reason});
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
					if (this.app) this.app.ipc.emit(message.id, message.value);
					break;
				}
				case "command": {
					const noHandle = () => {
						const res = {err: `Service ${this.serviceName} cannot handle commands!`};
						if (process.send) process.send({op: "return", value: {
							id: message.command.UUID,
							value: res
						}, UUID: message.UUID});
						console.error("I can't handle commands!");
					};
					if (this.app) {
						if (this.app.handleCommand) {
							const res = await this.app.handleCommand(message.command.msg);
							if (message.command.receptive) {
								if (process.send) process.send({op: "return", value: {
									id: message.command.UUID,
									value: res
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
				case "shutdown": {
					if (this.app) {
						if (this.app.shutdown) {
							let safe = false;
							// Ask app to shutdown
							this.app.shutdown(() => {
								safe = true;
								if (process.send) process.send({op: "shutdown"});
							});
							if (message.killTimeout > 0) {
								setTimeout(() => {
									if (!safe) {
										console.error(`Service ${this.serviceName} took too long to shutdown. Performing shutdown anyway.`);
											
										if (process.send) process.send({op: "shutdown"});
									}
								}, message.killTimeout);
							}
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
						ram: process.memoryUsage().rss / 1e6
					}});

					break;
				}
				}
			}
		});
	}
 
	private async loadCode() {
		if (this.whatToLog.includes("service_start")) console.log(`Starting service ${this.serviceName}`);

		let App = (await import(this.path));
		if (App.ServiceWorker) {
			App = App.ServiceWorker;
		} else {
			App = App.default ? App.default : App;
		}
		this.app = new App({serviceName: this.serviceName, workerID: worker.id});

		let ready = false;
		if (this.app) this.app.readyPromise.then(() => {
			if (this.whatToLog.includes("service_ready")) console.log(`Service ${this.serviceName} is ready!`);
			if (process.send) process.send({op: "connected"});
			ready = true;
		}).catch((err: unknown) => {
			console.error(`Service ${this.serviceName} had an error starting: ${inspect(err)}`);
			process.kill(0);
		});

		// Timeout
		if (this.timeout !== 0) {
			setTimeout(() => {
				if (!ready) {
					console.error(`Service ${this.serviceName} took too long to start.`);
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