import { IPC } from "./IPC";
import crypto from "crypto";
import { inspect } from "util";
import { reconstructError } from "./ErrorHandler";
import Eris from "eris";


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

	public request(method: Eris.RequestMethod, url: string, auth?: boolean, body?: { [s: string]: unknown }, file?: Eris.MessageFile, _route?: string, short?: boolean): Promise<unknown> {
		const UUID = crypto.randomBytes(16).toString("hex");

		let fileString;
		if (file) {
			if (file.file) {
				fileString = Buffer.from(file.file).toString("base64");
				file.file = "";
			}
		}
		const data = {method, url, auth, body, file, fileString, _route, short};

		if (process.send) process.send({op: "centralApiRequest", request: {UUID, data}});

		return new Promise((resolve, reject) => {
			// timeout
			const timeout = setTimeout(() => {
				this.requests.delete(UUID);
				reject(`Request timed out (>${this.timeout}ms)`);
			}, this.timeout);

			const callback = (r: {resolved: boolean, value: unknown}) => {
				this.requests.delete(UUID);
				clearTimeout(timeout);
				if (r.resolved) {
					resolve(r.value);
				} else {
					reject(reconstructError(r.value));
				}
			};

			this.requests.set(UUID, callback);
		});
	}
}