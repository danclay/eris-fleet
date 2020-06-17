import {EventEmitter} from "events";
import * as Admiral from "../sharding/Admiral";

export class IPC extends EventEmitter {
	private events: Map<string | number, {fn: (msg: unknown) => void}>;

	public constructor() {
		super();
		this.events = new Map();

		process.on("message", msg => {
			const event = this.events.get(msg.op);
			if (event) {
				event.fn(msg);
			}
		});
	}

	public register(event: string, callback: (msg: unknown) => void): void {
		if (this.events.get(event)) {
			if (process.send) process.send({op: "error", msg: "IPC | Can't register 2 events with the same name."});
		} else {
			this.events.set(event, {fn: callback});
		}
	}

	public unregister(event:string): void {
		this.events.delete(event);
	}

	public broadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "broadcast", event: {op, msg: message}});
	}

	public admiralBroadcast(op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "admiralBroadcast", event: {op, msg: message}});
	}

	public sendTo(cluster: number, op: string, message?: unknown): void {
		if (!message) message = null;
		if (process.send) process.send({op: "sendTo", cluster: cluster, event: {msg: message, op}});
	}

	public async fetchUser(id: number): Promise<any> {
		if (process.send) process.send({op: "fetchUser", id});

		return new Promise((resolve, reject) => {
			const callback = (r: unknown) => {
				this.removeListener(id.toString(), callback);
				resolve(r);
			};

			this.on(id.toString(), callback);
		});
	}

	public async fetchGuild(id: number): Promise<any> {
		if (process.send) process.send({op: "fetchGuild", id});

		return new Promise((resolve, reject) => {
			const callback = (r: unknown) => {
				this.removeListener(id.toString(), callback);
				resolve(r);
			};

			this.on(id.toString(), callback);
		});
	}

	public async fetchChannel(id: number): Promise<any> {
		if (process.send) process.send({op: "fetchChannel", id});

		return new Promise((resolve, reject) => {
			const callback = (r: unknown) => {
				this.removeListener(id.toString(), callback);
				resolve(r);
			};

			this.on(id.toString(), callback);
		});
	}

	public async fetchMember(guildID: number, memberID: number): Promise<any> {
		const UUID = JSON.stringify({guildID, memberID});
		if (process.send) process.send({op: "fetchMember", id: UUID});

		return new Promise((resolve, reject) => {
			const callback = (r: any) => {
				if (r) r.id = memberID;
				this.removeListener(UUID, callback);
				resolve(r);
			};

			this.on(UUID, callback);
		});
	}

	public async command(service: string, message?: unknown, receptive?: boolean): Promise<unknown> {
		if (!message) message = null;
		if (!receptive) receptive = false;
		const UUID = JSON.stringify({timestamp: Date.now(), message, service, receptive});
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
				const callback = (r: any) => {
					this.removeListener(UUID, callback);
					if (r.value.err) {
						reject(r.value.err);
					} else {
						resolve(r.value);
					}
				};
	
				this.on(UUID, callback);
			});
		}
	}

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

	public restartCluster(clusterID: number, hard?: boolean): void {
		if (process.send) process.send({op: "restartCluster", clusterID, hard: hard ? true : false});
	}

	public restartAllClusters(hard?: boolean): void {
		if (process.send) process.send({op: "restartAllClusters", hard: hard ? true : false});
	}

	public restartService(serviceName: string, hard?: boolean): void {
		if (process.send) process.send({op: "restartService", serviceName, hard: hard ? true : false});
	}

	public restartAllServices(hard?: boolean): void {
		if (process.send) process.send({op: "restartAllServices", hard: hard ? true : false});
	}

	public shutdownCluster(clusterID: number, hard?: boolean): void {
		if (process.send) process.send({op: "shutdownCluster", clusterID, hard: hard ? true : false});
	}

	public shutdownService(serviceName: string, hard?: boolean): void {
		if (process.send) process.send({op: "shutdownService", serviceName, hard: hard ? true : false});
	}

	/** Total shutdown of fleet */
	public totalShutdown(hard?: boolean): void {
		if (process.send) process.send({op: "totalShutdown", hard: hard ? true : false});
	}

	public reshard(): void {
		if (process.send) process.send({op: "reshard"});
	}
}