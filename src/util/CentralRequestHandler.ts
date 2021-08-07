import { IPC } from "./IPC";
import crypto from "crypto";


interface CentralRequestHandlerOptions {
	timeout: number;
}

export class CentralRequestHandler {
	private timeout: number;
	private ipc: IPC;
	private requests: Map<string, (r: {resolved: boolean, value: unknown}) => void>

	constructor(ipc: IPC, options: CentralRequestHandlerOptions) {
		this.timeout = options.timeout;
		this.ipc = ipc;
		this.requests = new Map();

		process.on("message", message => {
			if (message.op === "centralApiResponse") {
				const request = this.requests.get(message.id);
				if (request) {
					request(message.value);
				}
			}
		});
	}

	public request(...args: any[]): Promise<unknown> {
		const UUID = crypto.randomBytes(16).toString("hex");

		if (process.send) process.send({op: "centralApiRequest", request: {UUID, data: args}});

		return new Promise((resolve, reject) => {
			// timeout
			const timeout = setTimeout(() => {
				reject(`Request timed out (>${this.timeout}ms)`);
			}, this.timeout);

			const callback = (r: {resolved: boolean, value: unknown}) => {
				this.requests.delete(UUID);
				clearTimeout(timeout);
				if (r.resolved) {
					resolve(r.value);
				} else {
					reject(r.value);
				}
			};

			this.requests.set(UUID, callback);
		});
	}
}