"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CentralRequestHandler = void 0;
const crypto_1 = __importDefault(require("crypto"));
class CentralRequestHandler {
    constructor(ipc, options) {
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
    request(...args) {
        const UUID = crypto_1.default.randomBytes(16).toString("hex");
        if (process.send)
            process.send({ op: "centralApiRequest", request: { UUID, data: args } });
        return new Promise((resolve, reject) => {
            // timeout
            const timeout = setTimeout(() => {
                reject(`Request timed out (>${this.timeout}ms)`);
            }, this.timeout);
            const callback = (r) => {
                this.requests.delete(UUID);
                clearTimeout(timeout);
                if (r.resolved) {
                    resolve(r.value);
                }
                else {
                    reject(r.value);
                }
            };
            this.requests.set(UUID, callback);
        });
    }
}
exports.CentralRequestHandler = CentralRequestHandler;
//# sourceMappingURL=CentralRequestHandler.js.map